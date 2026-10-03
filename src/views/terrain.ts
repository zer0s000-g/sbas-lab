/**
 * Terrain along the active scenario's route as a height function over the local NM frame
 * (Java, Madura and Bali; or southern France from Toulouse to Nice): the real coastline
 * (Natural Earth 1:10m), a coastal plain rising inland into hills, the main summits as
 * cones, and the sea deepening offshore. The two airfields are levelled to their field
 * elevation along their real runway courses. Pure, so the flight view, the sea's
 * shallows, the camera and the ground shadow share one surface. Simplified: heights
 * between the summits are procedural, not survey data.
 */
import { valueNoise } from '@/core/random'
import { AIRPORT_LIST, localNmToRunway, localOf, type Airport } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { SCENARIO } from '@/scenarios/active'
import { CoastIndex, decodeRings, projectRings } from './geo/coast'

const T = SCENARIO.terrain

/** Coast rings in local NM, and the index over them (2 NM cells). */
export const COAST_RINGS_NM = projectRings(decodeRings(T.coast), (lon, lat) => {
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

/** The scenario's summits (approximate positions and heights), in the local frame. */
export const PEAKS: readonly Peak[] = T.peaks.map(({ name, latDeg, lonDeg, heightM: m }) => {
  const l = localOf(latDeg, lonDeg)
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
  const P = ap.parallelOffsetM
  // A parallel runway on the terminal side (Jakarta): the terminal side reaches past it.
  const far = (P !== null && Math.sign(P) === t ? Math.abs(P) : 0) + 1600
  // A parallel runway on the other side (Toulouse, Nice): that side reaches past it too.
  const near = P !== null && Math.sign(P) !== t ? Math.abs(P) : 0
  const away = near + 1100
  const fillAway = near + 250
  const r0 = t < 0 ? -far : -away
  const r1 = t < 0 ? away : far
  return {
    airport: ap,
    level: { a0: -1400, a1: L + 1400, r0, r1 },
    fill: { a0: -350, a1: L + 1200, r0: t < 0 ? -(far - 300) : -fillAway, r1: t < 0 ? fillAway : far - 300 },
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
  // A wide, low coastal plain (Jakarta and the north coast of Java; the Languedoc) that rises
  // inland into hills, from an inland plain where the scenario has one (Toulouse, ~150 m).
  const inland = smooth((sd - 3) / 12)
  const hills = (valueNoise(eastNm * 0.16, northNm * 0.16, 7) * 0.7 + valueNoise(eastNm * 0.55, northNm * 0.55, 3) * 0.3) * T.hillsFt * inland
  let h = 6 + 18 * Math.min(sd, 3) + hills + T.inlandBaseFt * inland
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
