// End-to-end check of the one page on the real GPU (headless Chrome on Metal).
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/verify/page-e2e.mjs              # everything
//   ONLY=layout node scripts/verify/page-e2e.mjs  # one group: layout | keyboard | reduced
//
// Stage 0 covers the kit preview. For each width (1440, 768, 390) and theme it checks: no
// console errors, no sideways scroll, an axe audit with zero violations, a stage that is not
// black, and it saves a full-page screenshot. Then: every control is reachable with Tab and
// shows a focus ring, the phase timeline works with the arrow keys, and with reduced motion
// the clock starts paused. Stage 5 extends it to every journey phase, the guided stops, the
// debrief and the GPU-memory check. Screenshots go to OUT (default ./e2e-shots).
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const exe = process.env.CHROME || process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const HOST = process.env.HOST || 'http://localhost:4173'
const OUT = process.env.OUT || './e2e-shots'
const ONLY = process.env.ONLY
mkdirSync(OUT, { recursive: true })

let failures = 0
const fail = (msg) => {
  failures++
  console.log('FAIL ' + msg)
}
const ok = (msg) => console.log(' ok  ' + msg)
const check = (cond, msg) => (cond ? ok(msg) : fail(msg))

const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function open(size, theme, opts = {}) {
  const [width, height] = size.split('x').map(Number)
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
  await ctx.addInitScript((t) => localStorage.setItem('sbaslab.prefs', JSON.stringify({ state: { theme: t, reducedMotionOverride: null, soundOn: false, captionsOn: true, guidedStops: true }, version: 1 })), theme)
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    const t = m.text()
    if ((m.type() === 'error' || /GL_|WebGL|shader|context lost/i.test(t)) && !/THREE\.Clock/.test(t)) errors.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
  await page.goto(HOST + '/', { waitUntil: 'load' })
  await page.waitForFunction(() => { const c = document.querySelector('canvas[data-engine]'); return c && c.width > 200 && c.height > 150 }, null, { timeout: 30000 }).catch(() => errors.push('stage canvas never sized'))
  // Let the pen-plot reveal finish.
  await page.waitForTimeout(3500)
  return { ctx, page, errors, width, height }
}

/** Share of pure-black pixels in the stage (its background is never pure black), overall and in the centre 60 %. */
function blackFraction(buf) {
  const png = PNG.sync.read(buf)
  let black = 0, centre = 0, centreN = 0
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4
      const b = png.data[i] < 2 && png.data[i + 1] < 2 && png.data[i + 2] < 2
      const inside = x > png.width * 0.2 && x < png.width * 0.8 && y > png.height * 0.2 && y < png.height * 0.8
      if (b) black++
      if (inside) {
        centreN++
        if (b) centre++
      }
    }
  return { all: black / (png.width * png.height), centre: centre / centreN }
}

async function axe(page, label) {
  await page.addScriptTag({ content: AXE })
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ['violations'] })
    return res.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target?.join(' ')} — ${v.help}`)
  })
  check(r.length === 0, `${label}: axe finds no violations${r.length ? '\n      ' + r.join('\n      ') : ''}`)
}

const stage = (page) => page.locator('[aria-label^="Demo terrain table"]').first()

try {
  // -------------------------------------------------------------------------
  // Layout: every width and theme
  // -------------------------------------------------------------------------
  if (!ONLY || ONLY === 'layout') {
    for (const size of ['1440x900', '768x1024', '390x844']) {
      for (const theme of ['dark', 'light']) {
        const tag = `${size} ${theme}`
        const { ctx, page, errors, width } = await open(size, theme)
        const sw = await page.evaluate(() => document.documentElement.scrollWidth)
        check(sw <= width, `${tag}: no sideways scroll (${sw} ≤ ${width})`)
        await axe(page, tag)
        const black = blackFraction(await stage(page).screenshot())
        check(black.all < 0.005 && black.centre < 0.002, `${tag}: stage is not black (${(black.all * 100).toFixed(2)} %, centre ${(black.centre * 100).toFixed(2)} %)`)
        await stage(page).screenshot({ path: `${OUT}/${size}-${theme}-stage.png` })
        await page.screenshot({ path: `${OUT}/${size}-${theme}-full.png`, fullPage: true })
        // The zoom shot shows the protection cylinder inside the alert-limit wireframe.
        await page.getByRole('button', { name: 'Camera: zoom to the protection cylinder' }).click()
        await page.waitForTimeout(2500)
        await stage(page).screenshot({ path: `${OUT}/${size}-${theme}-zoom.png` })
        check(errors.length === 0, `${tag}: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
        await ctx.close()
      }
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard: Tab reaches everything and shows a focus ring; timeline arrows
  // -------------------------------------------------------------------------
  if (!ONLY || ONLY === 'keyboard') {
    const { ctx, page, errors } = await open('1440x900', 'dark')
    const seen = new Set()
    let ringMissing = []
    for (let i = 0; i < 160; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        // Accessible name, roughly: aria-label, aria-labelledby, a <label for>, then the text.
        const byId = el.getAttribute('aria-labelledby')?.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
        const label = el.getAttribute('aria-label') || byId || el.labels?.[0]?.textContent?.trim() || el.textContent?.trim().slice(0, 40) || el.tagName
        // A focus ring is an outline, or a box-shadow ring (the shadcn buttons draw theirs that way).
        return { label, ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && cs.boxShadow !== '') }
      })
      if (!info) continue
      seen.add(info.label)
      if (!info.ring) ringMissing.push(info.label)
    }
    // Segmented controls are one Tab stop each (arrow keys move inside), so any time-lapse item counts.
    const needed = ['Display and sound settings', 'Camera: follow the aircraft', 'Camera: reset the view', 'Phase 1: Gate', 'Phase 12: Landing', 'Pause', 'Time-lapse', 'Guided stops', 'Demo dial']
    const missing = needed.filter((n) => ![...seen].some((s) => s.startsWith(n)))
    check(missing.length === 0, `Tab reaches the controls (${seen.size} stops)${missing.length ? '; missing ' + missing.join(', ') : ''}`)
    ringMissing = [...new Set(ringMissing)]
    check(ringMissing.length === 0, `every focused control shows a focus ring${ringMissing.length ? ': missing on ' + ringMissing.slice(0, 5).join(', ') : ''}`)
    // The timeline: focus the active phase, then arrow keys move it.
    await page.getByRole('button', { name: 'Phase 11: Final' }).focus()
    await page.keyboard.press('ArrowRight')
    const cur = await page.getAttribute('[aria-current="step"]', 'aria-label')
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    check(cur === 'Phase 12: Landing' && focused === cur, `→ moves the timeline to the next phase and keeps focus (${cur})`)
    await page.keyboard.press('Home')
    check((await page.getAttribute('[aria-current="step"]', 'aria-label')) === 'Phase 1: Gate', 'Home jumps to the first phase')
    // The dial: arrow keys change its value.
    const dial = page.getByRole('slider', { name: 'Demo dial' })
    await dial.focus()
    const before = Number(await dial.getAttribute('aria-valuenow'))
    await page.keyboard.press('ArrowUp')
    check(Number(await dial.getAttribute('aria-valuenow')) === before + 1, 'the dial answers the arrow keys')
    check(errors.length === 0, `keyboard: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // Reduced motion: the clock starts paused and the stage holds still
  // -------------------------------------------------------------------------
  if (!ONLY || ONLY === 'reduced') {
    const { ctx, page, errors } = await open('1440x900', 'dark', { reduced: true })
    const timer = page.locator('[role="timer"]').first()
    const t0 = await timer.getAttribute('aria-label')
    await page.waitForTimeout(1500)
    const t1 = await timer.getAttribute('aria-label')
    check(t0 === t1 && /paused/.test(t1 ?? ''), `reduced motion: the clock starts paused (${t1})`)
    // The film grain (Noise) is a per-frame effect, so compare only for gross motion.
    const a = PNG.sync.read(await stage(page).screenshot())
    await page.waitForTimeout(600)
    const b = PNG.sync.read(await stage(page).screenshot())
    let diff = 0
    for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > 40) diff++
    check(diff / (a.width * a.height) < 0.01, `reduced motion: the stage holds still (${((diff / (a.width * a.height)) * 100).toFixed(2)} % of pixels changed)`)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.waitForTimeout(1500)
    check((await timer.getAttribute('aria-label')) !== t1, 'reduced motion: Play starts the clock')
    check(errors.length === 0, `reduced: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}
console.log(failures ? `${failures} failure(s)` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
