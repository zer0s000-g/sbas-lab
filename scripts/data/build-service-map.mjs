// Builds the ESSP-SAS service-area map of one real day (src/data/servicemap/<day>.json)
// from the files scripts/data/fetch-bkg.mjs cached: the GPS broadcast ephemeris and the
// EUREF stations. The simulation code runs through Vite (src/core is TypeScript), with
// the ESSP-SAS scenario active.
//
//   node scripts/data/fetch-bkg.mjs && node scripts/data/build-service-map.mjs
//
// With real EGNOS messages in data-cache/egnos/<day>/*.ems (EMS hourly files, e.g. from
// EDAS), the corrections come from them; otherwise from the page's ground-segment model
// on the real geometry, and the output says "modelled".
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createServer } from 'vite'
import { CACHE, DAY, STATIONS } from './fetch-bkg.mjs'

process.env.SBAS_SCENARIO = 'essp'
const ROOT = join(import.meta.dirname, '..', '..')
const OUT_DIR = join(ROOT, 'src', 'data', 'servicemap')
const SPEC = { lat0: 26, lat1: 70, lon0: -30, lon1: 40, stepDeg: 2 }
const MAP_STEP_S = 600
const STATION_STEP_S = 300
const IGP_BOX = { lat0: 20, lat1: 75, lon0: -40, lon1: 50 }
/** The EUREF stations: city, and the ID the page shows. */
const STATION_NAMES = {
  TLMF00FRA: 'Toulouse', VLFR00ITA: 'Villefranche-sur-Mer', MLVL00FRA: 'Marne-la-Vallée', ACOR00ESP: 'A Coruña', VALE00ESP: 'Valencia', IZAN00ESP: 'Izaña, Tenerife',
  TUC200GRC: 'Chania, Crete', KUU200FIN: 'Kuusamo', KEV200FIN: 'Kevo', WTZS00DEU: 'Wettzell', ASGA00CYP: 'Nicosia', MAH100IRL: 'Malin Head', LAMP00ITA: 'Lampedusa', COST00ROU: 'Constanța', ARGI00FRO: 'Argir, Faroe Islands',
}

const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (p) => vite.ssrLoadModule(p)
const { crxToRinex } = await load('/src/core/hatanaka.ts')
const { parseNav, parseObs, gpsSeconds, antennaPosition } = await load('/src/core/rinex.ts')
const { solveSpp, fixError } = await load('/src/core/spp.ts')
const sm = await load('/src/core/serviceMap.ts')
const { ecefToGeodetic } = await load('/src/core/geo.ts')
const { EGNOS_RIMS } = await load('/src/scenarios/essp/rimsNetwork.ts')
const { REGION } = await load('/src/core/region.ts')
const { parseEms, emptyState, decodeMessage, applyMessage, bitsFromHex } = await load('/src/core/sbasDecode.ts')

const tag = `${DAY.year}${String(DAY.doy).padStart(3, '0')}0000`
const nav = parseNav(gunzipSync(readFileSync(join(CACHE, `BRDC00IGS_R_${tag}_01D_MN.rnx.gz`))).toString())
if (!nav.klobuchar) throw new Error('no Klobuchar coefficients in the navigation file')
const [y, mo, d] = DAY.iso.split('-').map(Number)
const day0 = gpsSeconds(y, mo, d, 0, 0, 0)
// The model ionosphere reads local solar time from the scenario frame's origin: start it at 00 UTC.
const ionoAt = (secOfDay) => ({ tS: secOfDay, startLocalHour: REGION.origin.lonDeg / 15, storm: 0, scintillation: false })
const igps = sm.igpsOver(IGP_BOX)

// Real EGNOS messages, when present.
const emsDir = join(ROOT, 'data-cache', 'egnos', DAY.iso)
let ems = null
if (existsSync(emsDir)) {
  // One GEO's broadcast (EMS_PRN, default PRN 136, operational in the September 2026 notices).
  const prn = Number(process.env.EMS_PRN ?? 136)
  const recs = readdirSync(emsDir)
    .filter((f) => f.endsWith('.ems'))
    .sort()
    .flatMap((f) => parseEms(readFileSync(join(emsDir, f), 'utf8')))
    .filter((r) => r.prn === prn)
    .map((r) => ({ ...r, secOfDay: r.time.hour * 3600 + r.time.minute * 60 + r.time.second }))
  if (recs.length) ems = recs
}
const source = ems ? 'egnos' : 'modelled'
console.log(`corrections: ${source}${ems ? ` (${ems.length} messages)` : ''}`)

let emsIdx = 0
const decoder = emptyState()
function groundAt(secOfDay) {
  const sats = sm.realSatsAt(nav.ephemerides, day0 + secOfDay)
  if (!ems) return { sats, ground: sm.modelledGround(sats, EGNOS_RIMS, ionoAt(secOfDay), igps) }
  // Feed every message up to this second (EMS times are GPS time of day here, see the EMS ICD).
  while (emsIdx < ems.length && ems[emsIdx].secOfDay <= secOfDay) {
    const bits = bitsFromHex(ems[emsIdx].hex)
    if (bits) applyMessage(decoder, decodeMessage(bits), ems[emsIdx].secOfDay)
    emsIdx++
  }
  return { sats, ground: sm.groundFromDecoder(decoder, secOfDay) }
}

// The map: per epoch and grid point, three packed protection levels.
const points = sm.gridPoints(SPEC)
const epochs = []
for (let s = 0; s < 86400; s += MAP_STEP_S) epochs.push(s)
const layers = { hplPa: new Uint8Array(epochs.length * points.length), vplPa: new Uint8Array(epochs.length * points.length) }
// Non-precision approach: one bit per point and epoch, HPL within the NPA alert limit.
const npaOk = new Uint8Array(Math.ceil((epochs.length * points.length) / 8))
const { OPERATIONS } = await load('/src/core/operations.ts')
const t0 = Date.now()
const groundCache = new Map()
epochs.forEach((secOfDay, e) => {
  const g = groundAt(secOfDay)
  groundCache.set(secOfDay, g)
  points.forEach((p, k) => {
    const l = sm.levelsAt(p, g.sats, g.ground)
    const i = e * points.length + k
    layers.hplPa[i] = sm.packLevel(l.hplPaM)
    layers.vplPa[i] = sm.packLevel(l.vplPaM)
    if (l.hplNpaM !== null && l.hplNpaM <= OPERATIONS.npa.halM) npaOk[i >> 3] |= 1 << (i & 7)
  })
})
console.log(`map: ${points.length} points × ${epochs.length} epochs in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

// The stations: real GPS-alone error, and the SBAS protection levels at the station.
const stations = []
for (const id of STATIONS) {
  const file = join(CACHE, `${id}_R_${tag}_01D_30S_MO.crx.gz`)
  if (!existsSync(file)) {
    console.log(`missing ${id}, skipped`)
    continue
  }
  const obs = parseObs(crxToRinex(gunzipSync(readFileSync(file)).toString()), STATION_STEP_S)
  // The surveyed antenna position: the marker of the header plus the antenna height.
  const truth = antennaPosition(obs)
  const pos = ecefToGeodetic(truth)
  const rec = { id: id.slice(0, 4), name: STATION_NAMES[id] ?? id, latDeg: +pos.latDeg.toFixed(3), lonDeg: +pos.lonDeg.toFixed(3), tS: [], hErrCm: [], vErrCm: [], hplPa: [], vplPa: [] }
  for (const ep of obs.epochs) {
    const sod = Math.round(ep.tS - day0)
    if (sod < 0 || sod >= 86400) continue
    const fix = solveSpp(ep.tS, ep.c1, nav.ephemerides, nav.klobuchar, truth)
    const err = fix && fixError(fix.ecef, truth)
    const mapSod = Math.floor(sod / MAP_STEP_S) * MAP_STEP_S
    const g = groundCache.get(mapSod) ?? groundAt(mapSod)
    const l = sm.levelsAt({ latDeg: pos.latDeg, lonDeg: pos.lonDeg, hM: pos.hM }, g.sats, g.ground)
    rec.tS.push(sod)
    rec.hErrCm.push(err ? Math.round(err.hM * 100) : null)
    rec.vErrCm.push(err ? Math.round(err.vM * 100) : null)
    rec.hplPa.push(sm.packLevel(l.hplPaM))
    rec.vplPa.push(sm.packLevel(l.vplPaM))
  }
  const h = rec.hErrCm.filter((v) => v !== null).map(Math.abs).sort((a, b) => a - b)
  console.log(`${id}: ${rec.tS.length} epochs, GPS-alone H95 ${(h[Math.floor(h.length * 0.95)] / 100).toFixed(2)} m`)
  stations.push(rec)
}

const b64 = (u8) => Buffer.from(u8).toString('base64')
const out = {
  day: DAY.iso,
  source,
  spec: SPEC,
  stepS: MAP_STEP_S,
  epochs: epochs.length,
  layers: { hplPa: b64(layers.hplPa), vplPa: b64(layers.vplPa), npaOk: b64(npaOk) },
  stations,
  rims: EGNOS_RIMS.map((r) => ({ id: r.id, latDeg: r.latDeg, lonDeg: r.lonDeg })),
  satellites: { ephemerides: nav.ephemerides.length },
}
mkdirSync(OUT_DIR, { recursive: true })
const json = JSON.stringify(out)
writeFileSync(join(OUT_DIR, `${DAY.iso}.json`), json)
console.log(`wrote src/data/servicemap/${DAY.iso}.json: ${(json.length / 1e3).toFixed(0)} kB, ${(gzipSync(json).length / 1e3).toFixed(0)} kB gzipped`)
await vite.close()
