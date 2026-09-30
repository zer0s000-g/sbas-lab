#!/usr/bin/env node
// Static-hosting helpers after `vite build` for the one-page site:
//  - dist/404.html (a copy of index.html), so GitHub Pages serves the page for any path.
//  - Stamps a build id and the entry assets into dist/sw.js, so every deploy installs a
//    fresh service worker cache and the offline shell can start even after a cut-short visit.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// DIST_DIR lets the tests run this on a throwaway build folder.
const dist = process.env.DIST_DIR || join(import.meta.dirname, '..', 'dist')
if (!existsSync(join(dist, 'index.html'))) {
  console.error('postbuild: dist/index.html not found. Run `vite build` first.')
  process.exit(1)
}
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8')
writeFileSync(join(dist, '404.html'), indexHtml)
console.log('postbuild: wrote dist/404.html')

// Base path as built (e.g. "/" locally, "/sbas-lab/" on GitHub Pages), read from the entry script.
const entry = indexHtml.match(/<script type="module"[^>]*src="([^"]+)"/)
if (!entry) {
  console.error('postbuild: no module entry script in dist/index.html')
  process.exit(1)
}
const base = entry[1].slice(0, entry[1].indexOf('assets/'))

const sw = join(dist, 'sw.js')
if (!existsSync(sw)) {
  console.error('postbuild: dist/sw.js is missing (public/sw.js not copied?)')
  process.exit(1)
}
const src = readFileSync(sw, 'utf8')
if (!src.includes('__BUILD_ID__') || !src.includes('/* __SHELL_ASSETS__ */')) {
  console.error('postbuild: dist/sw.js is missing its __BUILD_ID__ or __SHELL_ASSETS__ placeholder')
  process.exit(1)
}
const id = process.env.GITHUB_SHA?.slice(0, 12) || Date.now().toString(36)
const shellAssets = [...indexHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
  .map((m) => m[1])
  .filter((u) => u.startsWith(base + 'assets/'))
  .map((u) => './' + u.slice(base.length))
writeFileSync(sw, src.replace('__BUILD_ID__', id).replace('/* __SHELL_ASSETS__ */', shellAssets.map((u) => JSON.stringify(u)).join(', ')))
console.log(`postbuild: stamped service worker build ${id} with ${shellAssets.length} shell assets`)
