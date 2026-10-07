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
import { AIRPORT_LIST, localNmToRunway, localOf, runwayToLocalNm, type Airport } from '@/core/region'
import { runwayExtentM } from '@/core/sites'
import { DEG, M_PER_FT, M_PER_NM } from '@/core/units'
import { SCENARIO } from '@/scenarios/active'
import { CoastIndex, decodeRings, projectRings } from './geo/coast'
import { terrainCoastData } from './geo/scenarioCoast'

const T = SCENARIO.terrain

/**
 * The coast index (2 NM cells) over the coastline in local NM. Built on first use, from
 * the coastline the 3D views' loaders fetched (geo/scenarioCoast), so importing this
 * module costs nothing until the terrain is needed.
 */
let coastIndex: CoastIndex | null = null
const coast = (): CoastIndex =>
  (coastIndex ??= new CoastIndex(
    projectRings(decodeRings(terrainCoastData()), (lon, lat) => {
      const l = localOf(lat, lon)
      return [l.eastNm, l.northNm]
    }),
    2,
  ))

/** Signed distance to the coast, NM: positive inland, negative at sea, capped at ±16 NM. */
export const coastNm = (eastNm: number, northNm: number) => coast().signed(eastNm, northNm, 16)

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
  // The runway's ends along the runway frame (a displaced threshold puts the start before a = 0).
  const { startM: s0, endM: s1 } = runwayExtentM(ap)
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
    level: { a0: s0 - 1400, a1: s1 + 1400, r0, r1 },
    fill: { a0: s0 - 350, a1: s1 + 1200, r0: t < 0 ? -(far - 300) : -fillAway, r1: t < 0 ? fillAway : far - 300 },
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

/**
 * The same as `airfieldFlat` for every airfield at once, with each runway course's sine
 * and cosine worked out once (the terrain is sampled hundreds of thousands of times).
 */
const FLAT_FRAMES = AIRFIELDS.map((f) => {
  const c = f.airport.runwayCourseDeg * DEG
  const q = f.level
  return { e0: f.airport.thresholdEastNm, n0: f.airport.thresholdNorthNm, sin: Math.sin(c), cos: Math.cos(c), ca: (q.a0 + q.a1) / 2, cr: (q.r0 + q.r1) / 2, ha: (q.a1 - q.a0) / 2, hr: (q.r1 - q.r0) / 2 }
})

/** The most levelled value over both airfields (Infinity far from either). */
export function anyAirfieldFlat(eastNm: number, northNm: number): number {
  let k = Infinity
  for (const f of FLAT_FRAMES) {
    // core/region localNmToRunway, then rectK.
    const e = (eastNm - f.e0) * M_PER_NM
    const n = (northNm - f.n0) * M_PER_NM
    const a = e * f.sin + n * f.cos
    const r = e * f.cos - n * f.sin
    k = Math.min(k, Math.max(Math.abs(a - f.ca) / f.ha, Math.abs(r - f.cr) / f.hr))
  }
  return k
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

/** Natural ground for a known signed distance to the coast (NM, as `coastNm` gives it). */
function naturalAt(eastNm: number, northNm: number, sd: number): number {
  if (sd < 0) {
    // The sea floor drops away from the beach: shallow near the coast, about 600 ft deep 4 NM out.
    return Math.max(-1200, 6 + 150 * sd)
  }
  // A wide, low coastal plain (Jakarta and the north coast of Java; the Languedoc) that rises
  // inland into hills, from an inland plain where the scenario has one (Toulouse, ~150 m).
  // No hills on the coastal plain itself, so the noise is skipped there.
  const inland = smooth((sd - 3) / 12)
  const hills = inland > 0 ? (valueNoise(eastNm * 0.16, northNm * 0.16, 7) * 0.7 + valueNoise(eastNm * 0.55, northNm * 0.55, 3) * 0.3) * T.hillsFt * inland : 0
  let h = 6 + 18 * Math.min(sd, 3) + hills + T.inlandBaseFt * inland
  // Volcano cones: steep near the summit, long gentle skirts.
  const onLand = smooth(sd / 0.8)
  for (const p of PEAKS) {
    const de = eastNm - p.eastNm
    const dn = northNm - p.northNm
    const reach = p.radiusNm * 7
    if (de * de + dn * dn > reach * reach) continue
    const d = Math.hypot(de, dn)
    h = Math.max(h, p.heightFt * Math.exp(-d / p.radiusNm) * onLand + hills * 0.3)
  }
  return h
}

/** Natural ground before the airfields are levelled, ft (below 0 is under the sea). */
export function naturalFtAt(eastNm: number, northNm: number): number {
  return naturalAt(eastNm, northNm, coastNm(eastNm, northNm))
}

/** Terrain height anywhere, ft (below 0 is under the sea). */
export function terrainFtAt(eastNm: number, northNm: number): number {
  let h = naturalFtAt(eastNm, northNm)
  if (anyAirfieldFlat(eastNm, northNm) >= 1) return h
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

/** Each airfield's levelled area as a box in local NM: the airfields change the ground only inside. */
const AIRFIELD_BOXES = AIRFIELDS.map((f) => {
  const q = f.level
  const c = [
    runwayToLocalNm(f.airport, q.a0, q.r0),
    runwayToLocalNm(f.airport, q.a1, q.r0),
    runwayToLocalNm(f.airport, q.a0, q.r1),
    runwayToLocalNm(f.airport, q.a1, q.r1),
  ]
  // A little margin for rounding.
  const pad = 0.01
  return {
    e0: Math.min(...c.map((p) => p[0])) - pad,
    e1: Math.max(...c.map((p) => p[0])) + pad,
    n0: Math.min(...c.map((p) => p[1])) - pad,
    n1: Math.max(...c.map((p) => p[1])) + pad,
  }
})

/** Does a box (local NM) touch either levelled airfield? */
const nearAirfield = (e0: number, e1: number, n0: number, n1: number) => AIRFIELD_BOXES.some((b) => e1 >= b.e0 && e0 <= b.e1 && n1 >= b.n0 && n0 <= b.n1)

/** The farthest the coast search ever needs to look, NM (coastNm's cap). */
const COAST_CAP_NM = 16

/**
 * Terrain height clamped to [loFt, hiFt]: exactly the clamped `terrainFtAt`, but much
 * cheaper where the clamp decides. Away from the airfields the ground only rises inland
 * (at least 18 ft per NM over the first 3 NM) and only falls out to sea (150 ft per NM),
 * so the coast is searched only as far as it can change the answer.
 */
export function terrainFtClamped(eastNm: number, northNm: number, loFt: number, hiFt: number): number {
  const clamp = (h: number) => Math.min(hiFt, Math.max(loFt, h))
  if (anyAirfieldFlat(eastNm, northNm) < 1) return clamp(terrainFtAt(eastNm, northNm))
  const land = coast().inside(eastNm, northNm)
  if (land) {
    // Land this far in is at least hiFt high.
    const sure = (hiFt - 6) / 18
    if (sure <= 0) return hiFt
    const cap = sure < 3 ? sure : COAST_CAP_NM
    const d = coast().distance(eastNm, northNm, cap)
    if (cap < COAST_CAP_NM && d >= cap) return hiFt
    return clamp(naturalAt(eastNm, northNm, d))
  }
  // Sea this far out is at least loFt deep (and never deeper than 1200 ft).
  const cap = loFt > -1200 ? Math.min(COAST_CAP_NM, Math.max(0, (6 - loFt) / 150)) : COAST_CAP_NM
  const d = coast().distance(eastNm, northNm, cap)
  if (cap < COAST_CAP_NM && d >= cap) return clamp(loFt)
  return clamp(naturalAt(eastNm, northNm, -d))
}

/** A rectangle in local NM. */
export interface NmRect {
  e0: number
  e1: number
  n0: number
  n1: number
}

/**
 * Clamped terrain heights (see `terrainFtClamped`) over a lattice of points, `eAt(x)` east
 * by `nAt(y)` north (both increasing), handed to `put`. Most of a large lattice is open
 * sea or land well inland, so it is visited in blocks, halved near the coast: the coast
 * distance changes by at most the distance moved, so if a block's centre is far enough
 * from the coast (and the block is clear of the airfields), every point of it is too, on
 * the same side, and needs no coast search of its own.
 */
function clampedLattice(
  nx: number,
  ny: number,
  eAt: (x: number) => number,
  nAt: (y: number) => number,
  loFt: number,
  hiFt: number,
  put: (x: number, y: number, h: number) => void,
  /** Points x0 ≤ x < x1, y0 ≤ y < y1 all at height h. */
  fill: (x0: number, x1: number, y0: number, y1: number, h: number) => void,
) {
  const clamp = (h: number) => Math.min(hiFt, Math.max(loFt, h))
  // How far from the coast the answer stops depending on the distance, NM, on land and at sea.
  const landSure = (hiFt - 6) / 18 < 3 ? Math.max(0, (hiFt - 6) / 18) : COAST_CAP_NM
  const seaSure = loFt > -1200 ? Math.min(COAST_CAP_NM, Math.max(0, (6 - loFt) / 150)) : COAST_CAP_NM
  const block = (bx: number, by: number, size: number) => {
    const x1 = Math.min(nx, bx + size)
    const y1 = Math.min(ny, by + size)
    if (bx >= x1 || by >= y1) return
    const e0 = eAt(bx)
    const e1 = eAt(x1 - 1)
    const n0 = nAt(by)
    const n1 = nAt(y1 - 1)
    let far = false
    let land = false
    if (!nearAirfield(e0, e1, n0, n1)) {
      const ce = (e0 + e1) / 2
      const cn = (n0 + n1) / 2
      land = coast().inside(ce, cn)
      const need = Math.hypot(e1 - e0, n1 - n0) / 2 + (land ? landSure : seaSure)
      far = coast().distance(ce, cn, need) >= need
    }
    if (!far && size > 2) {
      const h = size / 2
      block(bx, by, h)
      block(bx + h, by, h)
      block(bx, by + h, h)
      block(bx + h, by + h, h)
      return
    }
    const sure = land ? landSure : seaSure
    // Every point at least `sure` from the coast: the clamp decides…
    if (far && land && sure < COAST_CAP_NM) return fill(bx, x1, by, y1, hiFt)
    if (far && !land && loFt > -1200) return fill(bx, x1, by, y1, loFt)
    for (let y = by; y < y1; y++) {
      const n = nAt(y)
      for (let x = bx; x < x1; x++) {
        const e = eAt(x)
        // …or (16 NM out) the coast distance is capped anyway.
        put(x, y, far ? clamp(naturalAt(e, n, land ? sure : -sure)) : terrainFtClamped(e, n, loFt, hiFt))
      }
    }
  }
  const B = 32
  for (let by = 0; by < ny; by += B) for (let bx = 0; bx < nx; bx += B) block(bx, by, B)
}

/** Terrain heights, never below `loFt`, at the (nx+1) × (ny+1) vertices of a grid over a rectangle; vertex (i, j) at i·(ny+1)+j. */
export function terrainGridFt(r: NmRect, nx: number, ny: number, loFt: number): Float64Array {
  const out = new Float64Array((nx + 1) * (ny + 1))
  clampedLattice(
    nx + 1,
    ny + 1,
    (i) => r.e0 + ((r.e1 - r.e0) * i) / nx,
    (j) => r.n0 + ((r.n1 - r.n0) * j) / ny,
    loFt,
    Infinity,
    (i, j, h) => void (out[i * (ny + 1) + j] = h),
    (i0, i1, j0, j1, h) => {
      for (let i = i0; i < i1; i++) out.fill(h, i * (ny + 1) + j0, i * (ny + 1) + j1)
    },
  )
  return out
}

/** The sea's height maps are saturated below this depth and above this height, ft. */
export const SEA_MAP_LOW_FT = -80
export const SEA_MAP_HIGH_FT = 20

/**
 * A height map of a rectangle for the sea's shallows and surf, `width` pixels across:
 * one byte per pixel, 0 = 80 ft deep or deeper, 204 = sea level, 255 = 20 ft up or
 * higher; row 0 is the south edge.
 */
export function seaHeightMap(r: NmRect, width: number): { data: Uint8Array; width: number; height: number } {
  const W = width
  const H = Math.round((W * (r.n1 - r.n0)) / (r.e1 - r.e0))
  const data = new Uint8Array(W * H)
  const lo = SEA_MAP_LOW_FT
  const hi = SEA_MAP_HIGH_FT
  const byte = (h: number) => Math.round(Math.min(1, Math.max(0, (h - lo) / (hi - lo))) * 255)
  clampedLattice(
    W,
    H,
    (x) => r.e0 + ((x + 0.5) / W) * (r.e1 - r.e0),
    (y) => r.n0 + ((y + 0.5) / H) * (r.n1 - r.n0),
    lo,
    hi,
    (x, y, h) => void (data[y * W + x] = byte(h)),
    (x0, x1, y0, y1, h) => {
      for (let y = y0; y < y1; y++) data.fill(byte(h), y * W + x0, y * W + x1)
    },
  )
  return { data, width: W, height: H }
}
