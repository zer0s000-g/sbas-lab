// End-to-end check of the journey page on the real GPU (headless Chrome on Metal).
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/verify/page-e2e.mjs              # everything
//   ONLY=layout node scripts/verify/page-e2e.mjs  # one group: layout | stops | keyboard | reduced | scenario | essp | scorm
//   SCENARIOS=essp node scripts/verify/page-e2e.mjs   # layout for one scenario (default: indonesia,essp)
//
// CHROME sets the browser; GL_ARGS its GPU flags (default Metal; on Linux without a GPU:
// GL_ARGS="--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader").
//
// For each width (1440, 768, 390) and theme: no console errors, no sideways scroll, an axe
// audit with zero violations, and every journey phase reached from the timeline with the
// director's view and a view that is not black. Then: the guided stop card, keyboard reach
// and focus rings, and the reduced-motion start. Screenshots go to OUT (default ./e2e-shots).
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
const SCENARIOS = (process.env.SCENARIOS || 'indonesia,essp').split(',')
const GL_ARGS = (process.env.GL_ARGS || '--use-angle=metal --enable-gpu --ignore-gpu-blocklist').split(' ')
const urlOf = (scenario) => (scenario === 'essp' ? '/?scenario=essp' : '/')
mkdirSync(OUT, { recursive: true })
const PHASES = ['gate', 'takeoff', 'climb', 'errors', 'reference', 'master', 'uplink', 'broadcast', 'cruise', 'descent', 'final', 'landing']
// The director's view per phase (src/journey/director.ts).
const VIEW = { gate: 'flight', takeoff: 'flight', climb: 'space', errors: 'space', reference: 'network', master: 'network', uplink: 'space', broadcast: 'space', cruise: 'flight', descent: 'flight', final: 'flight', landing: 'flight' }
const SHOTS = new Set(['gate', 'climb', 'errors', 'master', 'broadcast', 'cruise', 'final'])

let failures = 0
const fail = (msg) => {
  failures++
  console.log('FAIL ' + msg)
}
const ok = (msg) => console.log(' ok  ' + msg)
const check = (cond, msg) => (cond ? ok(msg) : fail(msg))

const browser = await chromium.launch({ executablePath: exe, args: GL_ARGS })

async function open(size, theme, opts = {}) {
  const [width, height] = size.split('x').map(Number)
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
  await ctx.addInitScript(
    ([t, stops]) => localStorage.setItem('sbaslab.prefs', JSON.stringify({ state: { theme: t, reducedMotionOverride: null, soundOn: false, captionsOn: true, guidedStops: stops }, version: 1 })),
    [theme, opts.stops ?? false],
  )
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    const t = m.text()
    if ((m.type() === 'error' || /GL_|WebGL|shader|context lost/i.test(t)) && !/THREE\.Clock/.test(t)) errors.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
  await page.goto(HOST + (opts.path ?? urlOf(opts.scenario ?? 'indonesia')), { waitUntil: 'load' })
  await page.waitForFunction(() => { const c = document.querySelector('canvas[data-engine]'); return c && c.width > 200 && c.height > 150 }, null, { timeout: 30000 }).catch(() => errors.push('stage canvas never sized'))
  await page.waitForTimeout(3000)
  return { ctx, page, errors, width, height }
}

function blackFraction(buf) {
  const png = PNG.sync.read(buf)
  let black = 0, centre = 0, centreN = 0
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4
      const b = png.data[i] < 2 && png.data[i + 1] < 2 && png.data[i + 2] < 2
      const inside = x > png.width * 0.3 && x < png.width * 0.7 && y > png.height * 0.3 && y < png.height * 0.7
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

const phaseButton = (page, p) => page.locator('nav[aria-label="Journey phases"]:visible button').nth(PHASES.indexOf(p))
const view = (page) => page.locator('[data-view]').first()

try {
  if (!ONLY || ONLY === 'layout') {
    for (const scenario of SCENARIOS)
    for (const size of ['1440x900', '768x1024', '390x844']) {
      for (const theme of ['dark', 'light']) {
        const tag = `${scenario} ${size} ${theme}`
        const { ctx, page, errors, width } = await open(size, theme, { scenario })
        await page.getByRole('button', { name: /pause the journey/i }).click()
        const before = failures
        for (const p of PHASES) {
          await phaseButton(page, p).click()
          await page.waitForTimeout(p === 'reference' || p === 'master' ? 700 : 1300)
          const got = await view(page).getAttribute('data-phase')
          const v = await view(page).getAttribute('data-view')
          const shot = await view(page).screenshot()
          const black = blackFraction(shot)
          if (got !== p || v !== VIEW[p] || black.all > 0.01 || black.centre > 0.005) fail(`${tag} ${p}: phase ${got}, view ${v} (want ${VIEW[p]}), black ${(black.all * 100).toFixed(2)}% (centre ${(black.centre * 100).toFixed(2)}%)`)
          if (SHOTS.has(p)) await page.screenshot({ path: `${OUT}/${scenario}-${size}-${theme}-${p}.png`, fullPage: size !== '1440x900' })
          if (p === 'final') {
            const sw = await page.evaluate(() => document.documentElement.scrollWidth)
            check(sw <= width, `${tag}: no sideways scroll (${sw} ≤ ${width})`)
            await axe(page, `${tag} final`)
          }
        }
        check(failures === before, `${tag}: all 12 phases reached from the timeline, the director's view, never black`)
        await phaseButton(page, 'master').click()
        await page.waitForTimeout(600)
        await axe(page, `${tag} network map`)
        check(errors.length === 0, `${tag}: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
        await ctx.close()
      }
    }
  }

  if (!ONLY || ONLY === 'stops') {
    const { ctx, page, errors } = await open('1440x900', 'dark', { stops: true })
    await phaseButton(page, 'final').click()
    const dialog = page.getByRole('dialog', { name: 'LPV engaged' })
    await dialog.waitFor({ timeout: 5000 }).then(() => ok('a guided stop appears when LPV engages'), () => fail('the LPV guided stop never appeared'))
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
    check(focused === 'Continue', `focus moves to Continue (got "${focused}")`)
    const timer = page.locator('[role="timer"]').first()
    // The timer label is sampled (about 10 Hz): let it catch up with the jump first.
    await page.waitForTimeout(400)
    const t1 = await timer.getAttribute('aria-label')
    await page.waitForTimeout(1200)
    check((await timer.getAttribute('aria-label')) === t1, 'the journey waits at the stop')
    await page.screenshot({ path: `${OUT}/stop-lpv.png` })
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(1500)
    check((await page.getByRole('dialog').count()) === 0 && (await timer.getAttribute('aria-label')) !== t1, 'Continue resumes the journey')
    check(errors.length === 0, `stops: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }

  if (!ONLY || ONLY === 'keyboard') {
    const { ctx, page, errors } = await open('1440x900', 'dark')
    const seen = new Set()
    let ringMissing = []
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        const byId = el.getAttribute('aria-labelledby')?.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
        const label = el.getAttribute('aria-label') || byId || el.labels?.[0]?.textContent?.trim() || el.textContent?.trim().slice(0, 40) || el.tagName
        return { label, ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && cs.boxShadow !== '') }
      })
      if (!info) continue
      seen.add(info.label)
      if (!info.ring) ringMissing.push(info.label)
    }
    const needed = ['Pause the journey', 'Display and sound settings', 'Sources and review status', 'AirNav Indonesia', 'ESSP-SAS', 'View:', 'Camera: follow', 'Camera: reset', 'Phase 1: Gate', 'Phase 12: Landing', 'Automatic time-lapse', 'Guided stops']
    const missing = needed.filter((n) => ![...seen].some((s) => s.startsWith(n)))
    check(missing.length === 0, `Tab reaches the controls (${seen.size} stops)${missing.length ? '; missing ' + missing.join(', ') : ''}`)
    ringMissing = [...new Set(ringMissing)]
    check(ringMissing.length === 0, `every focused control shows a focus ring${ringMissing.length ? ': missing on ' + ringMissing.slice(0, 5).join(', ') : ''}`)
    // The arrows move from the active phase: make Climb active first.
    await page.getByRole('button', { name: 'Phase 3: Climb' }).click()
    await page.getByRole('button', { name: 'Phase 3: Climb' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    check((await view(page).getAttribute('data-phase')) === 'errors', '→ on the timeline jumps to the next phase')
    check(errors.length === 0, `keyboard: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }

  if (!ONLY || ONLY === 'reduced') {
    const { ctx, page, errors } = await open('1440x900', 'dark', { reduced: true })
    const timer = page.locator('[role="timer"]').first()
    const t0 = await timer.getAttribute('aria-label')
    await page.waitForTimeout(1500)
    const t1 = await timer.getAttribute('aria-label')
    check(t0 === t1 && /paused/.test(t1 ?? ''), `reduced motion: the journey starts paused (${t1})`)
    const a = PNG.sync.read(await view(page).screenshot())
    await page.waitForTimeout(600)
    const b = PNG.sync.read(await view(page).screenshot())
    let diff = 0
    for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > 40) diff++
    check(diff / (a.width * a.height) < 0.01, `reduced motion: the view holds still (${((diff / (a.width * a.height)) * 100).toFixed(2)} % changed)`)
    await page.getByRole('button', { name: 'Play the journey' }).click()
    await page.waitForTimeout(1500)
    check((await timer.getAttribute('aria-label')) !== t1, 'reduced motion: Play starts the journey')
    check(errors.length === 0, `reduced: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }
  if (!ONLY || ONLY === 'scenario') {
    const { ctx, page, errors } = await open('1440x900', 'dark')
    const nav = page.getByRole('navigation', { name: 'Scenario' })
    check((await nav.getByRole('link', { name: /AirNav Indonesia/ }).getAttribute('aria-current')) === 'page', 'the page opens on the AirNav Indonesia scenario')
    check(/Indonesia has no operational SBAS/.test(await page.locator('footer').innerText()), 'the Indonesian footer says Indonesia has no operational SBAS')
    await nav.getByRole('link', { name: /ESSP-SAS/ }).click()
    await page.waitForURL(/scenario=essp/)
    await page.waitForTimeout(2500)
    check((await nav.getByRole('link', { name: /ESSP-SAS/ }).getAttribute('aria-current')) === 'page', 'the ESSP-SAS tab loads the EGNOS scenario')
    check(/EGNOS/.test(await page.locator('footer').innerText()) && /Toulouse/.test(await page.getByRole('region', { name: 'Flight and phase panels' }).innerText()), 'ESSP-SAS: EGNOS footer and the Toulouse to Nice flight')
    check(/ESSP-SAS/.test(await page.title()), `ESSP-SAS: the page title names the scenario (${await page.title()})`)
    await nav.getByRole('link', { name: /AirNav Indonesia/ }).click()
    await page.waitForURL((u) => !u.search.includes('scenario'))
    await page.waitForTimeout(1500)
    check(/Jakarta/.test(await page.getByRole('region', { name: 'Flight and phase panels' }).innerText()), 'and back to Jakarta to Bali')
    check(errors.length === 0, `scenario switch: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }

  if (!ONLY || ONLY === 'essp') {
    const { ctx, page, errors } = await open('1440x900', 'dark', { scenario: 'essp' })
    await page.getByRole('button', { name: /pause the journey/i }).click()
    await phaseButton(page, 'final').click()
    await page.waitForTimeout(1500)
    const badge = page.getByLabel(/^Approach mode/).first()
    check((await badge.getAttribute('aria-label')) === 'Approach mode LPV', 'ESSP-SAS final: LPV')
    await page.getByRole('switch', { name: /Ionospheric storm/ }).click()
    await page.waitForTimeout(1200)
    check((await badge.getAttribute('aria-label')) === 'Approach mode LNAV', `a storm takes LPV-200 away (${await badge.getAttribute('aria-label')})`)
    await page.getByText(/A\) LFMN/).first().waitFor({ timeout: 10000 }).then(() => ok('the service panel proposes a NOTAM for Nice'), () => fail('no NOTAM proposed for the storm'))
    await page.getByRole('switch', { name: /EGNOS v3 preview/ }).click()
    await page.waitForTimeout(1200)
    check((await badge.getAttribute('aria-label')) === 'Approach mode LPV', 'the EGNOS v3 (DFMC) preview gives LPV back in the storm')
    await page.getByRole('button', { name: /Mend everything/ }).click()
    await page.getByText('valid', { exact: true }).first().waitFor({ timeout: 10000 }).then(() => ok('the real EGNOS signal replays with valid CRCs'), () => fail('the replay panel did not show'))
    await axe(page, 'ESSP-SAS panels')
    await page.getByRole('button', { name: /claims behind this phase/ }).click()
    await page.getByRole('article').first().waitFor({ timeout: 10000 })
    check((await page.getByRole('article').count()) >= 3, 'the source line opens the claims behind the phase')
    await axe(page, 'Sources sheet')
    await page.screenshot({ path: `${OUT}/essp-sources.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.getByRole('radio', { name: /^Exam$/ }).click()
    await page.getByRole('button', { name: 'Start the exam' }).click()
    await page.waitForTimeout(800)
    check((await page.getByText(/Locked while the assessment runs/).count()) === 1, 'an exam locks Break something')
    check((await view(page).getAttribute('data-phase')) === 'final', 'the exam starts on final')
    await page.getByRole('group', { name: /What failed/ }).getByRole('radio').first().click()
    await page.getByRole('group', { name: /What do the crew/ }).getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Hand in the exam' }).click()
    await page.waitForTimeout(500)
    check((await page.getByText(/Exam: \d \/ 2/).count()) === 1, 'the exam is marked')
    await axe(page, 'assessment result')
    check(errors.length === 0, `ESSP-SAS: no console errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }

  if (!ONLY || ONLY === 'scorm') {
    // A stand-in LMS on the same origin: a SCORM 1.2 API on the parent, the course in a frame.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
    await page.route('**/__lms.html', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><title>LMS</title><script>window.__calls=[];window.API={LMSInitialize:()=>(__calls.push('init'),'true'),LMSSetValue:(n,v)=>(__calls.push(n+'='+v),'true'),LMSCommit:()=>(__calls.push('commit'),'true'),LMSFinish:()=>(__calls.push('finish'),'true'),LMSGetLastError:()=>'0'}</script><iframe src="/?scenario=essp&lms=scorm" style="width:1400px;height:880px;border:0"></iframe>`,
      }),
    )
    await page.goto(HOST + '/__lms.html')
    const course = page.frameLocator('iframe')
    await course.getByRole('button', { name: /pause the journey/i }).click({ timeout: 30000 })
    for (let i = 0; i < 12; i++) {
      await course.getByRole('group', { name: new RegExp(`^${i + 1}\\. `) }).getByRole('radio').first().click()
      if (i < 11) await course.getByRole('button', { name: 'Next' }).click()
    }
    await course.getByRole('button', { name: 'Check my answers' }).click()
    await page.waitForTimeout(500)
    let calls = await page.evaluate(() => window.__calls)
    check(calls.includes('init') && calls.includes('cmi.core.lesson_status=incomplete'), 'SCORM: the quiz reaches the LMS (incomplete until the exam)')
    await course.getByRole('radio', { name: /^Exam$/ }).click()
    await course.getByRole('button', { name: 'Start the exam' }).click()
    await course.getByRole('group', { name: /What failed/ }).getByRole('radio').first().click()
    await course.getByRole('group', { name: /What do the crew/ }).getByRole('radio').first().click()
    await course.getByRole('button', { name: 'Hand in the exam' }).click()
    await page.waitForTimeout(500)
    calls = await page.evaluate(() => window.__calls)
    check(calls.some((c) => /^cmi\.core\.lesson_status=(passed|failed)$/.test(c)) && calls.some((c) => /^cmi\.core\.score\.max=14$/.test(c)), `SCORM: the result reaches the LMS (${calls.filter((c) => c.includes('lesson_status')).at(-1)})`)
    check((await course.getByText(/Result sent to your learning management system/).count()) === 1, 'SCORM: the page says the result was sent')
    check(errors.length === 0, `SCORM: no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`)
    await ctx.close()
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}
console.log(failures ? `${failures} failure(s)` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
