import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// scripts/postbuild.mjs and scripts/budget.mjs, run on a small fake build in a temp folder.
const root = join(import.meta.dirname, '../..')
let dir = ''
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

const index = (preload = '') => `<!doctype html><html><head><title>SBAS Lab</title>
<script type="module" crossorigin src="/sbas-lab/assets/index-a.js"></script>${preload}<link rel="stylesheet" crossorigin href="/sbas-lab/assets/index-b.css">
</head><body></body></html>`

function fakeBuild(opts: { bigPreload?: number; sw?: boolean } = {}) {
  dir = mkdtempSync(join(tmpdir(), 'sbaslab-build-'))
  mkdirSync(join(dir, 'assets'))
  const preload = opts.bigPreload ? '<link rel="modulepreload" crossorigin href="/sbas-lab/assets/vendor-c.js">' : ''
  writeFileSync(join(dir, 'index.html'), index(preload))
  writeFileSync(join(dir, 'assets/index-a.js'), 'console.log(1)')
  writeFileSync(join(dir, 'assets/index-b.css'), 'body{}')
  // A lazy chunk that no page loads up front: never counted.
  writeFileSync(join(dir, 'assets/Stage-d.js'), randomBytes(400 * 1024).toString('base64'))
  if (opts.bigPreload) writeFileSync(join(dir, 'assets/vendor-c.js'), randomBytes(opts.bigPreload).toString('base64'))
  if (opts.sw !== false) writeFileSync(join(dir, 'sw.js'), "const BUILD = '__BUILD_ID__'\nconst SHELL_ASSETS = [/* __SHELL_ASSETS__ */]\n")
}

const run = (script: string, env: Record<string, string>) =>
  spawnSync(process.execPath, [join(root, 'scripts', script)], { env: { ...process.env, ...env }, encoding: 'utf8' })

describe('postbuild', () => {
  it('writes the 404 fallback and stamps the service worker with the build id and shell assets', () => {
    fakeBuild()
    const r = run('postbuild.mjs', { DIST_DIR: dir, GITHUB_SHA: 'abcdef1234567890' })
    expect(r.status, r.stderr).toBe(0)
    expect(readFileSync(join(dir, '404.html'), 'utf8')).toBe(readFileSync(join(dir, 'index.html'), 'utf8'))
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8')
    expect(sw).toContain("const BUILD = 'abcdef123456'")
    expect(sw).toContain('"./assets/index-a.js", "./assets/index-b.css"')
  })

  it('fails loudly when the service worker is missing', () => {
    fakeBuild({ sw: false })
    const r = run('postbuild.mjs', { DIST_DIR: dir })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('sw.js is missing')
  })

  it('fails clearly when there is no build', () => {
    dir = mkdtempSync(join(tmpdir(), 'sbaslab-build-'))
    const r = run('postbuild.mjs', { DIST_DIR: dir })
    expect(r.status).toBe(1)
    expect(existsSync(join(dir, '404.html'))).toBe(false)
  })
})

describe('budget', () => {
  it('passes a small build and does not count the lazy 3D chunk', () => {
    fakeBuild()
    expect(run('postbuild.mjs', { DIST_DIR: dir }).status).toBe(0)
    const r = run('budget.mjs', { DIST_DIR: dir })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('(1 page checked)')
  })

  it('counts modulepreload hints and fails when the first load is over', () => {
    fakeBuild({ bigPreload: 400 * 1024 })
    expect(run('postbuild.mjs', { DIST_DIR: dir }).status).toBe(0)
    const r = run('budget.mjs', { DIST_DIR: dir })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('OVER on index.html')
  })

  it('fails clearly when there is no build', () => {
    dir = mkdtempSync(join(tmpdir(), 'sbaslab-build-'))
    const r = run('budget.mjs', { DIST_DIR: dir })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Run the build first')
  })
})
