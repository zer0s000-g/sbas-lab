// Real-GPU render test for the 3D views. Software rendering (swiftshader) hides
// GPU-specific shader bugs: NaN from zero-width smoothstep or pow() of a negative
// base renders fine there but smears black/flicker on Metal and other drivers.
// This drives headless Chrome on the machine's real GPU, visits every journey phase
// from the timeline, grabs a burst of frames of the view per phase, and flags
// pure-black pixels (the stage background is never pure black) and brightness jumps.
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/verify/gpu-render.mjs                 # dark
//   THEME=light OUT=gpu-shots node scripts/verify/gpu-render.mjs
//   SCENARIO=essp node scripts/verify/gpu-render.mjs   # the ESSP-SAS scenario
//
// GL_ARGS overrides the GPU flags (default Metal).
//
// CHROME overrides the Chromium executable. Exits 1 when anything fails, so it can gate a push.
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { mkdirSync } from 'node:fs'

const exe = process.env.CHROME || process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const HOST = process.env.HOST || 'http://localhost:4173'
const OUT = process.env.OUT
const [w, h] = (process.env.SIZE || '1440x900').split('x').map(Number)
const theme = process.env.THEME || 'dark'
if (OUT) mkdirSync(OUT, { recursive: true })
const PHASES = ['gate', 'takeoff', 'climb', 'errors', 'reference', 'master', 'uplink', 'broadcast', 'cruise', 'descent', 'final', 'landing']

const GL_ARGS = (process.env.GL_ARGS || '--use-angle=metal --enable-gpu --ignore-gpu-blocklist').split(' ')
const SCENARIO = process.env.SCENARIO || 'indonesia'
const browser = await chromium.launch({ executablePath: exe, args: GL_ARGS })
let problems = 0
function stats(buf) {
  const png = PNG.sync.read(buf)
  let black = 0, sum = 0
  const n = png.width * png.height
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2]
    if (r < 2 && g < 2 && b < 2) black++
    sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  return { black: black / n, lum: sum / n }
}
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: theme, serviceWorkers: 'block' })
  await ctx.addInitScript((t) => localStorage.setItem('sbaslab.prefs', JSON.stringify({ state: { theme: t, reducedMotionOverride: null, soundOn: false, captionsOn: true, guidedStops: true }, version: 1 })), theme)
  const page = await ctx.newPage()
  const warn = []
  page.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || /GL_|WebGL|shader|context lost/i.test(t)) && !/THREE.Clock/.test(t)) warn.push(t.slice(0, 160)) })
  page.on('pageerror', (e) => warn.push('pageerror ' + e.message))
  await page.goto(HOST + (SCENARIO === 'essp' ? '/?scenario=essp' : '/'), { waitUntil: 'load' })
  // The stage loads after idle; wait until its WebGL canvas has been sized.
  await page.waitForFunction(() => { const c = document.querySelector('canvas[data-engine]'); return c && c.width > 300 && c.height > 150 }, null, { timeout: 20000 }).catch(() => warn.push('stage canvas never sized'))
  await page.waitForTimeout(3500)
  const stage = page.locator('[data-view]').first()
  await page.getByRole('button', { name: /pause the journey/i }).click()
  for (const [i, name] of PHASES.entries()) {
    await page.locator('nav[aria-label="Journey phases"] button').nth(i).click()
    await page.waitForTimeout(2200)
    const frames = []
    for (let k = 0; k < 6; k++) {
      const buf = await stage.screenshot({ scale: 'css' })
      frames.push(stats(buf))
      if (k === 0 && OUT) await stage.screenshot({ path: `${OUT}/${theme}-${String(i + 1).padStart(2, '0')}-${name}.png`, scale: 'css' })
      await page.waitForTimeout(180)
    }
    const maxBlack = Math.max(...frames.map((f) => f.black))
    const lums = frames.map((f) => f.lum)
    const jump = Math.max(...lums.slice(1).map((l, j) => Math.abs(l - lums[j])))
    const bad = maxBlack > 0.004 || jump > 6
    if (bad) problems++
    console.log(`${bad ? 'FAIL' : ' ok '} ${theme.padEnd(5)} ${name.padEnd(9)} black ${(maxBlack * 100).toFixed(2)}%  lum ${lums.map((l) => l.toFixed(0)).join(',')}  jump ${jump.toFixed(1)}`)
  }
  if (warn.length) { problems++; console.log(`WARN: ${[...new Set(warn)].slice(0, 4).join(' | ')}`) }
} catch (error) {
  problems++
  console.log(`FAIL ${error instanceof Error ? error.message : error}`)
} finally {
  await browser.close()
}
console.log(problems ? `${problems} problem(s)` : 'ALL CLEAN')
process.exit(problems ? 1 : 0)
