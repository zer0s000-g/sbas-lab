// Builds a SCORM 1.2 package of the ESSP-SAS scenario for a learning management system:
//
//   npm run scorm      → dist-scorm/sbas-lab-essp-sas-scorm12.zip
//
// The site is built with relative paths (base "./") so it runs from wherever the LMS
// unpacks it; the LMS launches index.html?scenario=essp&lms=scorm, and the assessment
// panel reports its score and status through the LMS's SCORM API (src/lms/scorm.ts).
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { manifest, zip } from './scorm/lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-scorm')
const site = join(out, 'site')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

await build({ root, configFile: join(root, 'vite.config.ts'), base: './', logLevel: 'warn', build: { outDir: site, emptyOutDir: true } })

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
// The service worker and the 404 page belong to the hosted site, not to an LMS package.
const files = walk(site)
  .map((f) => relative(site, f).split('\\').join('/'))
  .filter((f) => f !== 'sw.js' && f !== '404.html')
  .sort()
const xml = manifest({ title: 'SBAS Lab · ESSP-SAS: EGNOS from Toulouse to Nice', files })
const entries = [{ name: 'imsmanifest.xml', data: Buffer.from(xml, 'utf8') }, ...files.map((f) => ({ name: f, data: readFileSync(join(site, f)) }))]
const pkg = join(out, 'sbas-lab-essp-sas-scorm12.zip')
writeFileSync(pkg, zip(entries))
console.log(`scorm: ${relative(root, pkg)} (${files.length} files, ${(statSync(pkg).size / 1024).toFixed(0)} kB)`)
