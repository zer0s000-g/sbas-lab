// Fetch one day of real GNSS data from the BKG GNSS Data Center (igs.bkg.bund.de, public
// HTTPS): the IGS broadcast ephemeris, the IGS rapid orbits (to test the orbit code) and
// a fixed set of EUREF stations. Gentle on the server: one file at a time, a pause between
// files, at most two retries with backoff, and a local cache (data-cache/, not committed)
// so nothing is ever fetched twice.
//
//   node scripts/data/fetch-bkg.mjs
//
// EUREF Permanent Network data: CC BY 4.0 (docs/THIRD_PARTY.md).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const DAY = { year: 2026, doy: 273, iso: '2026-09-30', gpsWeek: 2438 }
export const STATIONS = ['TLMF00FRA', 'VLFR00ITA', 'MLVL00FRA', 'ACOR00ESP', 'VALE00ESP', 'IZAN00ESP', 'TUC200GRC', 'KUU200FIN', 'KEV200FIN', 'WTZS00DEU', 'ASGA00CYP', 'MAH100IRL', 'LAMP00ITA', 'COST00ROU', 'ARGI00FRO']
const BASE = 'https://igs.bkg.bund.de/root_ftp'
const tag = `${DAY.year}${String(DAY.doy).padStart(3, '0')}0000`
export const FILES = [
  { url: `${BASE}/IGS/BRDC/${DAY.year}/${DAY.doy}/BRDC00IGS_R_${tag}_01D_MN.rnx.gz`, name: `BRDC00IGS_R_${tag}_01D_MN.rnx.gz` },
  { url: `${BASE}/IGS/products/${DAY.gpsWeek}/IGS0OPSRAP_${tag}_01D_15M_ORB.SP3.gz`, name: `IGS0OPSRAP_${tag}_01D_15M_ORB.SP3.gz` },
  ...STATIONS.map((s) => ({ url: `${BASE}/EUREF/obs/${DAY.year}/${DAY.doy}/${s}_R_${tag}_01D_30S_MO.crx.gz`, name: `${s}_R_${tag}_01D_30S_MO.crx.gz` })),
]
export const CACHE = join(import.meta.dirname, '..', '..', 'data-cache', 'bkg', DAY.iso)

const PAUSE_MS = 3000
const UA = 'sbas-lab-educational-fetch/1.0 (one-off download of a single day; contact via the project repository)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      if (res.status === 404) throw new Error(`404 ${url}`)
      console.log(`  HTTP ${res.status}, retrying`)
    } catch (e) {
      if (String(e.message).startsWith('404')) throw e
      console.log(`  ${e.message}, retrying`)
    }
    await sleep(PAUSE_MS * 4 * (attempt + 1))
  }
  throw new Error(`gave up on ${url}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(CACHE, { recursive: true })
  let fetched = 0
  for (const f of FILES) {
    const out = join(CACHE, f.name)
    if (existsSync(out)) {
      console.log(`cached  ${f.name}`)
      continue
    }
    if (fetched++) await sleep(PAUSE_MS)
    const buf = await get(f.url)
    writeFileSync(out, buf)
    console.log(`fetched ${f.name} (${(buf.length / 1e6).toFixed(1)} MB)`)
  }
}
