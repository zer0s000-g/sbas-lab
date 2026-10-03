/**
 * The two airports as plain data: pavement, markings, lights, buildings and parked
 * aircraft. The runways in use sit at their real positions and courses (core/region);
 * the rest of each layout is simplified, not a survey of the real airport (Jakarta has
 * three runways and several terminals, shown here as two runways and one terminal; a
 * parallel runway is drawn as long as the runway in use and abreast of it).
 * Positions are metres in the runway
 * frame: `a` along the runway from the landing threshold, `r` to the right of the
 * landing direction. The taxi routes are LAB201's own simulated ground track
 * (core/flight `stepFlight`), so the aircraft rolls along the yellow centreline,
 * through the fillets of every turn. Markings and lights follow ICAO Annex 14
 * Vol I (§5.2 markings, §5.3 lights) in simplified form. Pure, so it can be tested
 * without three.js.
 */
import { DEPARTURE, DESTINATION, localNmToRunway, nearestAirport, runwayToLocalNm, type Airport } from '@/core/region'
import { ROUTE, initialAircraft, stepFlight } from '@/core/flight'
import { makeFasDataBlock } from '@/core/approach'

export type RA = [a: number, r: number]

export interface Rect {
  a0: number
  a1: number
  r0: number
  r1: number
}
export interface Box extends Rect {
  /** Height above the field, m. */
  h: number
  kind: 'terminal' | 'pier' | 'tower' | 'cab' | 'hangar' | 'block' | 'bridge'
}
export interface Lamp {
  a: number
  r: number
  kind: 'edge' | 'threshold' | 'end' | 'approach' | 'taxi'
}
export interface Papi {
  a: number
  r: number
  /** Angle above which the unit shows white, degrees (below: red). */
  settingDeg: number
}
export interface Stand {
  a: number
  r: number
  /** True heading of the parked aircraft, degrees. */
  headingDeg: number
}
export interface Designator {
  a: number
  /** Across the runway in use: 0 on it, the offset of a parallel runway otherwise. */
  r: number
  /** Reads upright for an aircraft landing in this direction (+1 along a, −1 against). */
  dir: 1 | -1
  text: string
}

export interface AirportLayout {
  airport: Airport
  lengthM: number
  widthM: number
  /** Runway pavement, shoulders and blast pads: the runway in use, and a parallel runway if there is one. */
  runway: Rect
  extraRunways: Rect[]
  shoulders: Rect[]
  /** Taxiway centrelines (23 m pavement around each). */
  taxiways: RA[][]
  aprons: Rect[]
  /** White runway markings. */
  markings: Rect[]
  designators: Designator[]
  /** Yellow taxiway centrelines and holding-position lines. */
  taxiLines: RA[][]
  holdBars: Rect[]
  buildings: Box[]
  /** Car parks and roads (concrete, flat). */
  landside: Rect[]
  stands: Stand[]
  lamps: Lamp[]
  papi: Papi[]
}

export const TAXIWAY_WIDTH_M = 23
export const RUNWAY_WIDTH_M = 45

/** Runway-frame metres to local NM east/north. */
export const airportToLocalNm = (ap: Airport, a: number, r: number): [number, number] => runwayToLocalNm(ap, a, r)

/** Local NM east/north to runway-frame metres. */
export const localNmToAirport = (ap: Airport, eastNm: number, northNm: number): RA => localNmToRunway(ap, eastNm, northNm)

const wpRA = (ap: Airport, id: string): RA => {
  const w = ROUTE.find((p) => p.id === id)
  if (!w) throw new Error(`no waypoint ${id}`)
  return localNmToAirport(ap, w.eastNm, w.northNm)
}

/**
 * LAB201's ground tracks off the runway, runway-frame metres: from the gate to the
 * runway at the departure airport, and from leaving the runway to the gate at the
 * destination. Thinned to a point every 12 m or 4° of turn.
 */
function groundTracks(): { out: RA[]; in: RA[] } {
  const tracks = { out: [] as RA[], in: [] as RA[] }
  let s = initialAircraft()
  const add = (list: RA[], p: RA, hdg: number, last: { hdg: number }) => {
    const q = list[list.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 12 || Math.abs(hdg - last.hdg) > 4) {
      list.push(p)
      last.hdg = hdg
    }
  }
  const lastOut = { hdg: NaN }
  const lastIn = { hdg: NaN }
  let departed = false
  for (let i = 0; i < 40_000 && !s.parked; i++) {
    const ap = nearestAirport(s.eastNm, s.northNm)
    const p = localNmToAirport(ap, s.eastNm, s.northNm)
    if (s.onGround && !departed) {
      add(tracks.out, p, s.headingDeg, lastOut)
      if (Math.abs(p[1]) < 1 && Math.abs(s.headingDeg - ap.runwayCourseDeg) < 1) departed = true
    } else if (s.onGround && ap === DESTINATION && Math.abs(p[1]) > 5) add(tracks.in, p, s.headingDeg, lastIn)
    s = stepFlight(s, 0.25)
  }
  const a = DESTINATION
  tracks.in.push(localNmToAirport(a, s.eastNm, s.northNm))
  // Join the arrival track to the runway centreline it turns off.
  const first = tracks.in[0]
  if (first) tracks.in.unshift([first[0] - 30, 0])
  return tracks
}

const TRACKS = groundTracks()

/** The designator for the other end of a runway: 07R → 25L, 09 → 27. */
export function reciprocal(designator: string): string {
  const num = Number.parseInt(designator, 10)
  const letter = designator.replace(/^\d+/, '')
  const swap: Record<string, string> = { L: 'R', R: 'L', C: 'C', '': '' }
  return String(((num + 17) % 36) + 1).padStart(2, '0') + (swap[letter] ?? '')
}

/** Annex 14 runway markings for one landing direction (simplified), on a runway centred at `rc`. */
function runwayMarkings(L: number, W: number, dir: 1 | -1, text: string, out: AirportLayout, rc = 0) {
  const at = (d: number) => (dir === 1 ? d : L - d)
  const span = (d0: number, d1: number, r0: number, r1: number): Rect => {
    const x = at(d0)
    const y = at(d1)
    return { a0: Math.min(x, y), a1: Math.max(x, y), r0: rc + r0, r1: rc + r1 }
  }
  // Threshold: stripes 30 m long, 1.8 m wide, from 6 m in: 12 on a 45 m runway, 16 on a 60 m one.
  const pairs = W >= 60 ? 8 : 6
  for (let k = 0; k < pairs; k++) {
    const c = 2.7 + k * 3.6
    out.markings.push(span(6, 36, c - 0.9, c + 0.9), span(6, 36, -c - 0.9, -c + 0.9))
  }
  out.designators.push({ a: at(48 + 4.5), r: rc, dir, text })
  // Aiming point: 45 m long, 9 m wide, 400 m in, inner edges 18 m apart.
  out.markings.push(span(400, 445, 9, 18), span(400, 445, -18, -9))
  // Touchdown zone: pairs every 150 m, fewer stripes further in; none next to the aiming point.
  const tdz: [number, number][] = [
    [150, 3],
    [300, 2],
    [600, 2],
    [750, 1],
    [900, 1],
  ]
  for (const [d, n] of tdz)
    for (let k = 0; k < n; k++) {
      const r0 = 9 + k * 3.3
      out.markings.push(span(d, d + 22.5, r0, r0 + 1.8), span(d, d + 22.5, -r0 - 1.8, -r0))
    }
}

/** Pavement, edge and centre lines, markings both ways and edge lights of one runway centred at `rc`. */
function runwayAt(out: AirportLayout, L: number, W: number, rc: number, designator: string) {
  out.markings.push({ a0: 0, a1: L, r0: rc + W / 2 - 1.35, r1: rc + W / 2 - 0.45 }, { a0: 0, a1: L, r0: rc - W / 2 + 0.45, r1: rc - W / 2 + 1.35 })
  for (let d = 69; d + 30 <= L - 69; d += 50) out.markings.push({ a0: d, a1: d + 30, r0: rc - 0.45, r1: rc + 0.45 })
  runwayMarkings(L, W, 1, designator, out, rc)
  runwayMarkings(L, W, -1, reciprocal(designator), out, rc)
  for (let a = 0; a <= L + 0.1; a += 60) out.lamps.push({ a, r: rc + W / 2 + 1.5, kind: 'edge' }, { a, r: rc - W / 2 - 1.5, kind: 'edge' })
  for (let r = -W / 2; r <= W / 2 + 0.1; r += 3) out.lamps.push({ a: -2, r: rc + r, kind: 'threshold' }, { a: L + 2, r: rc + r, kind: 'end' })
}

function build(ap: Airport, side: 1 | -1, taxiRoute: RA[], laneR: number, gate: RA, approachLights: boolean, gpaDeg: number, hold?: RA): AirportLayout {
  const L = ap.runwayLengthM
  const W = ap.runwayWidthM
  const P = ap.parallelOffsetM
  const out: AirportLayout = {
    airport: ap,
    lengthM: L,
    widthM: W,
    runway: { a0: -60, a1: L + 60, r0: -W / 2, r1: W / 2 },
    extraRunways: P !== null ? [{ a0: -60, a1: L + 60, r0: P - W / 2, r1: P + W / 2 }] : [],
    shoulders: [0, ...(P !== null ? [P] : [])].flatMap((rc): Rect[] => [
      { a0: -60, a1: L + 60, r0: rc + W / 2, r1: rc + W / 2 + 7.5 },
      { a0: -60, a1: L + 60, r0: rc - W / 2 - 7.5, r1: rc - W / 2 },
    ]),
    taxiways: [],
    aprons: [],
    markings: [],
    designators: [],
    taxiLines: [],
    holdBars: [],
    buildings: [],
    landside: [],
    stands: [],
    lamps: [],
    papi: [],
  }
  // Runways: edge lines, centreline, both landing directions and edge lights.
  runwayAt(out, L, W, 0, ap.runway)
  if (P !== null && ap.parallelRunway && Math.sign(P) !== side) {
    // A parallel runway on the side away from the terminal (Toulouse, Nice): crossings
    // from the runway in use at both ends and mid-way, with holding positions.
    runwayAt(out, L, W, P, ap.parallelRunway)
    const cross: RA[][] = [0, L / 2, L].map((a) => [
      [a, 0],
      [a, P],
    ])
    out.taxiways.push(...cross)
    out.taxiLines.push(...cross.map(([p, q]): RA[] => [[p[0], Math.sign(P) * (W / 2 + 8)], [q[0], P - Math.sign(P) * (W / 2 + 8)]]))
  } else if (P !== null && ap.parallelRunway) {
    runwayAt(out, L, W, P, ap.parallelRunway)
    // Its own parallel taxiway on the terminal side, with connectors at the ends and mid-way.
    const lane = P - side * Math.abs(laneR)
    const par: RA[] = [
      [-20, lane],
      [L + 20, lane],
    ]
    const con: RA[][] = [0, L / 2, L].map((a) => [
      [a, lane],
      [a, P],
    ])
    out.taxiways.push(par, ...con)
    out.taxiLines.push(par, ...con.map(([p, q]): RA[] => [p, [q[0], P - side * (W / 2 + 8)]]))
  }

  // Taxiways: LAB201's route, a full-length parallel taxiway on the terminal side and
  // connectors at both ends and mid-way.
  const parallel: RA[] = [
    [-20, laneR],
    [L + 20, laneR],
  ]
  const connectors: RA[][] = [0, L / 2, L].map((a) => [
    [a, laneR],
    [a, 0],
  ])
  out.taxiways.push(taxiRoute, parallel, ...connectors)
  out.taxiLines.push(taxiRoute, parallel, ...connectors.map(([p, q]): RA[] => [p, [q[0], side * (W / 2 + 8)]]))
  // Holding positions on every connector, 90 m from the runway centreline (Annex 14 code 4 instrument runway).
  if (hold) out.holdBars.push({ a0: hold[0] - TAXIWAY_WIDTH_M / 2, a1: hold[0] + TAXIWAY_WIDTH_M / 2, r0: hold[1] + side * 6 - 0.6, r1: hold[1] + side * 6 + 0.6 })
  for (const a of [0, L / 2, L]) out.holdBars.push({ a0: a - TAXIWAY_WIDTH_M / 2, a1: a + TAXIWAY_WIDTH_M / 2, r0: side * 90 - 0.6, r1: side * 90 + 0.6 })

  // Apron in front of the terminal, around LAB201's stand.
  const near = Math.min(Math.abs(laneR), Math.abs(gate[1])) - 35
  const front = Math.max(Math.abs(laneR), Math.abs(gate[1])) + 110
  const rr = (m: number) => side * m
  const span = (a0: number, a1: number, m0: number, m1: number): Rect => ({ a0, a1, r0: Math.min(rr(m0), rr(m1)), r1: Math.max(rr(m0), rr(m1)) })
  out.aprons.push(span(gate[0] - 420, gate[0] + 420, near, front))
  // Terminal with glazed front, piers and jet bridges.
  out.buildings.push({ ...span(gate[0] - 330, gate[0] + 330, front + 8, front + 70), h: 18, kind: 'terminal' })
  for (const da of [-230, 230]) out.buildings.push({ ...span(gate[0] + da - 22, gate[0] + da + 22, front - 30, front + 8), h: 12, kind: 'pier' })
  // Parked airliners nose-in at the terminal, with jet bridges.
  for (const da of [-300, -170, 170, 300]) {
    const a = gate[0] + da
    out.stands.push({ a, r: rr(front - 24), headingDeg: (ap.runwayCourseDeg + (side === 1 ? 90 : -90) + 360) % 360 })
    out.buildings.push({ ...span(a + 6, a + 9, front - 18, front + 8), h: 5, kind: 'bridge' })
  }
  // Control tower beside the apron, hangars past the other end, and landside blocks.
  const towerA = gate[0] - 560
  out.buildings.push({ ...span(towerA - 4, towerA + 4, front - 20, front - 12), h: 42, kind: 'tower' })
  out.buildings.push({ ...span(towerA - 7, towerA + 7, front - 23, front - 9), h: 48, kind: 'cab' })
  for (const da of [520, 640]) out.buildings.push({ ...span(gate[0] + da, gate[0] + da + 95, front - 60, front + 15), h: 24, kind: 'hangar' })
  out.aprons.push(span(gate[0] + 500, gate[0] + 760, near, front - 60))
  out.landside.push(span(gate[0] - 300, gate[0] + 300, front + 85, front + 150), span(-300, L + 300, front + 165, front + 177))
  for (let k = 0; k < 8; k++) {
    const a = gate[0] - 650 + k * 165
    out.buildings.push({ ...span(a, a + 60, front + 200, front + 245 + (k % 3) * 20), h: 9 + (k % 4) * 4, kind: 'block' })
  }

  // Blue taxiway edge lights (runway lights: white edge every 60 m, green threshold, red end, in `runwayAt`).
  for (const line of out.taxiways)
    for (let i = 0; i + 1 < line.length; i++) {
      const [p, q] = [line[i], line[i + 1]]
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      const ua = (q[0] - p[0]) / len
      const ur = (q[1] - p[1]) / len
      for (let s = 0; s <= len; s += 60)
        for (const o of [-1, 1]) {
          const a = p[0] + ua * s - ur * o * 13
          const r = p[1] + ur * s + ua * o * 13
          if (Math.abs(r) > W / 2 + 10 && (P === null || Math.abs(r - P) > W / 2 + 10)) out.lamps.push({ a, r, kind: 'taxi' })
        }
    }
  if (approachLights) {
    // A 900 m approach light system: barrettes every 30 m and a crossbar at 300 m.
    for (let d = 30; d <= 900; d += 30) for (let r = -2; r <= 2.01; r += 1) out.lamps.push({ a: -d, r, kind: 'approach' })
    for (let r = -15; r <= 15.01; r += 1.5) if (Math.abs(r) > 2.5) out.lamps.push({ a: -300, r, kind: 'approach' })
    // PAPI on the left of the runway: the unit nearest the runway is set highest
    // (Annex 14 §5.3.5: settings 30′ apart around the approach slope).
    const offs = [0.5, 1 / 6, -1 / 6, -0.5]
    offs.forEach((o, i) => out.papi.push({ a: 330, r: -(W / 2 + 15 + i * 9), settingDeg: gpaDeg + o }))
  }
  return out
}

const dep = DEPARTURE
const arr = DESTINATION

/**
 * The departure airport (Jakarta Soekarno-Hatta: the terminal between runways 07R and
 * 07L; Toulouse-Blagnac: the terminal east of runway 14L), LAB201 at a stand on the apron.
 */
export const DEPARTURE_LAYOUT = build(dep, dep.terminalSide, TRACKS.out, wpRA(dep, 'TWY-A')[1], wpRA(dep, 'GATE-D'), false, makeFasDataBlock().gpaDeg, wpRA(dep, 'HOLD'))

/**
 * The destination (Bali I Gusti Ngurah Rai: the terminal north of runway 09; Nice: the
 * terminals north-west of runway 04L), approach lights and PAPI for the LPV approach.
 */
export const DESTINATION_LAYOUT = build(arr, arr.terminalSide, TRACKS.in, wpRA(arr, 'TWY-B')[1], wpRA(arr, 'GATE-A'), true, makeFasDataBlock().gpaDeg)

/** The AirNav Indonesia names of the two layouts. */
export const JAKARTA = DEPARTURE_LAYOUT
export const BALI = DESTINATION_LAYOUT

export const AIRPORTS: readonly AirportLayout[] = [DEPARTURE_LAYOUT, DESTINATION_LAYOUT]

/** The layout of the airport nearest a local point. */
export const nearestLayout = (eastNm: number, northNm: number): AirportLayout => (nearestAirport(eastNm, northNm).id === DEPARTURE_LAYOUT.airport.id ? DEPARTURE_LAYOUT : DESTINATION_LAYOUT)

/** Distance from a runway-frame point to a polyline, m. */
export function distToPolyline(p: RA, line: RA[]): number {
  let best = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i], line[i + 1]]
    const da = b[0] - a[0]
    const dr = b[1] - a[1]
    const l2 = da * da + dr * dr || 1
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * da + (p[1] - a[1]) * dr) / l2))
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * da), p[1] - (a[1] + t * dr)))
  }
  return best
}

const inRect = (p: RA, q: Rect, pad = 0) => p[0] >= q.a0 - pad && p[0] <= q.a1 + pad && p[1] >= q.r0 - pad && p[1] <= q.r1 + pad

/** Is this runway-frame point on pavement (runway, taxiway or apron)? */
export function onPavement(l: AirportLayout, p: RA, pad = 0): boolean {
  if (inRect(p, l.runway, pad) || l.extraRunways.some((q) => inRect(p, q, pad))) return true
  if (l.aprons.some((q) => inRect(p, q, pad))) return true
  return l.taxiways.some((t) => distToPolyline(p, t) <= TAXIWAY_WIDTH_M / 2 + pad)
}
