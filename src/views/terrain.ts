/**
 * Terrain of Java, Madura and Bali as a height function over the local NM frame: the
 * real coastline (Natural Earth 1:10m), a low coastal plain rising inland into hills,
 * the main volcanoes as cones at their summits, and the sea deepening offshore. The two
 * airfields are levelled to their field elevation along their real runway courses.
 * Pure, so the flight view, the sea's shallows, the camera and the ground shadow share
 * one surface. Simplified: heights between the summits are procedural, not survey data.
 */
import { valueNoise } from '@/core/random'
import { AIRPORT_LIST, localNmToRunway, localOf, type Airport } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { CoastIndex, decodeRings, projectRings } from './geo/coast'
import { javaBali } from './geo/javaBali.data'

/** Coast rings in local NM, and the index over them (2 NM cells). */
export const COAST_RINGS_NM = projectRings(decodeRings(javaBali), (lon, lat) => {
  const l = localOf(lat, lon)
  return [l.eastNm, l.northNm]
})
export const COAST = new CoastIndex(COAST_RINGS_NM, 2)

/** Signed distance to the coast, NM: positive inland, negative at sea, capped at ±16 NM. */
export const coastNm = (eastNm: number, northNm: number) => COAST.signed(eastNm, northNm, 16)

interface Peak {
  name: string
  eastNm: number
  northNm: number
  heightFt: number
  /** Fall-off distance of the cone, NM. */
  radiusNm: number
}

// Summits, approximate positions and heights (metres above sea level).
const PEAKS_M: readonly [string, number, number, number][] = [
  ['Salak', -6.72, 106.73, 2211],
  ['Gede-Pangrango', -6.78, 106.97, 3019],
  ['Tangkuban Perahu', -6.77, 107.6, 2084],
  ['Papandayan', -7.32, 107.73, 2665],
  ['Cikuray', -7.32, 107.86, 2821],
  ['Ciremai', -6.89, 108.4, 3078],
  ['Slamet', -7.24, 109.21, 3428],
  ['Sindoro', -7.3, 109.99, 3136],
  ['Sumbing', -7.38, 110.07, 3371],
  ['Merbabu', -7.45, 110.43, 3145],
  ['Merapi', -7.54, 110.45, 2930],
  ['Muria', -6.62, 110.88, 1602],
  ['Lawu', -7.63, 111.19, 3265],
  ['Wilis', -7.81, 111.76, 2563],
  ['Kelud', -7.93, 112.31, 1731],
  ['Arjuno', -7.76, 112.59, 3339],
  ['Bromo-Tengger', -7.94, 112.95, 2329],
  ['Semeru', -8.11, 112.92, 3676],
  ['Argopuro', -7.97, 113.57, 3088],
  ['Raung', -8.12, 114.04, 3332],
  ['Ijen', -8.06, 114.24, 2769],
  ['Batukaru', -8.33, 115.09, 2276],
  ['Batur', -8.24, 115.38, 1717],
  ['Agung', -8.34, 115.51, 3031],
  ['Rinjani', -8.41, 116.46, 3726],
]

export const PEAKS: readonly Peak[] = PEAKS_M.map(([name, lat, lon, m]) => {
  const l = localOf(lat, lon)
  return { name, eastNm: l.eastNm, northNm: l.northNm, heightFt: m / M_PER_FT, radiusNm: 2.4 + m / 1400 }
})

/** Where each airfield is levelled, runway-frame metres (`a` along the runway in use, `r` to its right). */
export interface Airfield {
  airport: Airport
  /** The levelled area (hills cut down): fully flat inside 70 % of the half-extents, natural ground beyond 100 %. */
  level: { a0: number; a1: number; r0: number; r1: number }
  /**
   * Low ground and sea filled only here: the pavement and the terminal area. At Bali the
   * runway is built largely on reclaimed land; the fill reaches east to the coastline
   * (which at 1:10m lies a little east of the real shore).
   */
  fill: { a0: number; a1: number; r0: number; r1: number }
}

const airfield = (ap: Airport): Airfield => {
  const L = ap.runwayLengthM
  const t = ap.terminalSide
  // The terminal side reaches past the parallel runway, if there is one.
  const far = (ap.parallelOffsetM !== null ? Math.abs(ap.parallelOffsetM) : 0) + 1600
  const r0 = t < 0 ? -far : -1100
  const r1 = t < 0 ? 1100 : far
  return {
    airport: ap,
    level: { a0: -1400, a1: L + 1400, r0, r1 },
    fill: { a0: -350, a1: L + 1200, r0: t < 0 ? -(far - 300) : -250, r1: t < 0 ? 250 : far - 300 },
  }
}

export const AIRFIELDS: readonly Airfield[] = AIRPORT_LIST.map(airfield)

const rectK = (a: number, r: number, q: Airfield['level']) => {
  const ca = (q.a0 + q.a1) / 2
  const cr = (q.r0 + q.r1) / 2
  return Math.max(Math.abs(a - ca) / ((q.a1 - q.a0) / 2), Math.abs(r - cr) / ((q.r1 - q.r0) / 2))
}

/**
 * Where the levelled airfield is, for one airport: below 0.7 fully flat, blending out to
 * 1, natural ground beyond. The runways, aprons, terminal and landside lie inside.
 */
export function airfieldFlat(f: Airfield, eastNm: number, northNm: number): number {
  const [a, r] = localNmToRunway(f.airport, eastNm, northNm)
  return rectK(a, r, f.level) / 1
}

/** The most levelled value over both airfields (Infinity far from either). */
export function anyAirfieldFlat(eastNm: number, northNm: number): number {
  let k = Infinity
  for (const f of AIRFIELDS) k = Math.min(k, airfieldFlat(f, eastNm, northNm))
  return k
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

/** Natural ground before the airfields are levelled, ft (below 0 is under the sea). */
export function naturalFtAt(eastNm: number, northNm: number): number {
  const sd = coastNm(eastNm, northNm)
  if (sd < 0) {
    // The sea floor drops away from the beach: shallow near the coast, about 600 ft deep 4 NM out.
    return Math.max(-1200, 6 + 150 * sd)
  }
  // A wide, low coastal plain (Jakarta, the north coast) that rises inland into hills.
  const inland = smooth((sd - 3) / 12)
  const hills = (valueNoise(eastNm * 0.16, northNm * 0.16, 7) * 0.7 + valueNoise(eastNm * 0.55, northNm * 0.55, 3) * 0.3) * 1500 * inland
  let h = 6 + 18 * Math.min(sd, 3) + hills
  // Volcano cones: steep near the summit, long gentle skirts.
  const onLand = smooth(sd / 0.8)
  for (const p of PEAKS) {
    const d = Math.hypot(eastNm - p.eastNm, northNm - p.northNm)
    if (d > p.radiusNm * 7) continue
    h = Math.max(h, p.heightFt * Math.exp(-d / p.radiusNm) * onLand + hills * 0.3)
  }
  return h
}

/** Terrain height anywhere, ft (below 0 is under the sea). */
export function terrainFtAt(eastNm: number, northNm: number): number {
  let h = naturalFtAt(eastNm, northNm)
  for (const f of AIRFIELDS) {
    const k = airfieldFlat(f, eastNm, northNm)
    if (k >= 1) continue
    const elev = f.airport.elevationFt
    const [a, r] = localNmToRunway(f.airport, eastNm, northNm)
    // Hills are cut down over the whole airfield; low ground and sea are filled only
    // around the pavement and the terminal (the approach lights beyond stand on piers).
    if (h > elev) h = elev + (h - elev) * smooth((k - 0.7) / 0.3)
    else {
      // Fully filled inside the fill area, an embankment 150 m wide around it.
      const q = f.fill
      const out = Math.max(q.a0 - a, a - q.a1, q.r0 - r, r - q.r1)
      h = elev + (h - elev) * smooth(out / 150)
    }
  }
  return h
}
