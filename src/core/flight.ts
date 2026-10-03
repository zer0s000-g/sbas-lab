/**
 * LAB201, gate to gate. The aircraft moves only through `stepFlight` (CLAUDE.md), in the
 * local NM frame, with simple limits: a turn rate of at most 3°/s, bounded climb and
 * descent rates, and bounded acceleration. The route is the active scenario's
 * (src/scenarios/<id>/route.ts) and is simplified: its waypoints are illustrative, not a
 * published airway, departure or arrival procedure. Every route taxis out, takes off,
 * climbs to cruise, descends and joins a straight-in final on the runway course.
 */
import { DEG, clamp, wrap180, wrap360, M_PER_NM, M_PER_FT } from './units'
import { positiveStep } from './guard'
import { DEPARTURE, DESTINATION, localOf, runwayToLocalNm, type Airport } from './region'
import { makeFasDataBlock } from './approach'
import { SCENARIO } from '@/scenarios/active'

export type SegmentKind = 'taxi-out' | 'lineup' | 'takeoff' | 'air' | 'final' | 'landing' | 'taxi-in' | 'parked'

export interface Waypoint {
  id: string
  eastNm: number
  northNm: number
  /** Altitude to reach at this point, ft (ground points: the field elevation). */
  altFt: number
  /** Target speed on the way to this point, kt (ground speed; no wind in this journey). */
  speedKt: number
  kind: SegmentKind
}

const D = DEPARTURE
const A = DESTINATION
const FAS = makeFasDataBlock()
const GPA = FAS.gpaDeg * DEG
/** Glide path altitude at a distance before the destination threshold, ft. */
export const glidePathAltFt = (distNm: number) => A.elevationFt + FAS.tchFt + (Math.max(distNm, 0) * M_PER_NM * Math.tan(GPA)) / M_PER_FT

/** Distance before the destination threshold along the final approach course, NM (negative past it). */
export function distBeforeThresholdNm(eastNm: number, northNm: number): number {
  const c = A.runwayCourseDeg * DEG
  return -((eastNm - A.thresholdEastNm) * Math.sin(c) + (northNm - A.thresholdNorthNm) * Math.cos(c))
}

/** A waypoint in the runway frame of an airport: metres along the runway in use and to its right. */
const onRunway = (ap: Airport, id: string, aM: number, rM: number, altFt: number, speedKt: number, kind: SegmentKind): Waypoint => {
  const [eastNm, northNm] = runwayToLocalNm(ap, aM, rM)
  return { id, eastNm, northNm, altFt, speedKt, kind }
}
/** An en-route waypoint at a latitude and longitude. */
const at = (id: string, latDeg: number, lonDeg: number, altFt: number, speedKt: number): Waypoint => {
  const l = localOf(latDeg, lonDeg)
  return { id, eastNm: l.eastNm, northNm: l.northNm, altFt, speedKt, kind: 'air' }
}
const NM = M_PER_NM
/** Metres toward the terminal side of the runway in use (`terminalSide`). */
const sd = (ap: Airport, m: number) => ap.terminalSide * m

/** What a scenario's route builder gets: the two airports and the ways to place a waypoint. */
export interface RouteHelpers {
  D: Airport
  A: Airport
  NM: number
  onRunway: typeof onRunway
  at: typeof at
  sd: typeof sd
  glidePathAltFt: typeof glidePathAltFt
}

/**
 * The route, gate to gate. Every route uses these waypoint ids, which the journey and the
 * views look up: GATE-D, TWY-A, HOLD, LINEUP, ROTATE (taxi out and take off), ARR1 (the
 * start of the arrival), IF, FAF, THR, TDZ (the final approach and touchdown), EXIT,
 * TWY-B, GATE-A (to the stand).
 */
export const ROUTE: readonly Waypoint[] = SCENARIO.route({ D, A, NM, onRunway, at, sd, glidePathAltFt })

const TDZ = ROUTE.find((w) => w.id === 'TDZ')!

export const MAX_TURN_DEG_S = 3
export const MAX_CLIMB_FPM = 2500
export const MAX_DESCENT_FPM = 2200
const ACCEL_KT_S = 3.5
const DECEL_KT_S = 2.5
const LANDING_DECEL_KT_S = 4
const TAXI_KT = 15
const TAXI_TURN_DEG_S = 12

export interface AircraftState {
  eastNm: number
  northNm: number
  altFt: number
  headingDeg: number
  gsKt: number
  vsFpm: number
  /** Index of the waypoint being flown to. */
  wp: number
  onGround: boolean
  parked: boolean
}

const bearingDeg = (fromE: number, fromN: number, toE: number, toN: number) => wrap360(Math.atan2(toE - fromE, toN - fromN) / DEG)

export function initialAircraft(): AircraftState {
  const g = ROUTE[0]
  // At the stand facing along the apron toward the first taxi point.
  const headingDeg = bearingDeg(g.eastNm, g.northNm, ROUTE[1].eastNm, ROUTE[1].northNm)
  return { eastNm: g.eastNm, northNm: g.northNm, altFt: g.altFt, headingDeg, gsKt: 0, vsFpm: 0, wp: 1, onGround: true, parked: false }
}

const distNm = (e1: number, n1: number, e2: number, n2: number) => Math.hypot(e2 - e1, n2 - n1)

/** The segment the aircraft is on. */
export const segmentOf = (s: AircraftState): SegmentKind => (s.parked ? 'parked' : ROUTE[Math.min(s.wp, ROUTE.length - 1)].kind)

/** Advance the aircraft by dt seconds. Pure: returns a new state. */
export function stepFlight(s: AircraftState, dtS: number): AircraftState {
  positiveStep(dtS, 'dtS')
  if (s.parked) return s
  const target = ROUTE[s.wp]
  const kind = target.kind
  const ground = kind === 'taxi-out' || kind === 'lineup' || kind === 'takeoff' || kind === 'landing' || kind === 'taxi-in'
  const toGo = distNm(s.eastNm, s.northNm, target.eastNm, target.northNm)

  // Speed: accelerate or slow toward the leg's target. On the ground, keep rolling at the
  // segment's speed and brake just in time to meet the waypoint's speed.
  const decel = kind === 'landing' ? LANDING_DECEL_KT_S : DECEL_KT_S
  let wantKt = target.speedKt
  if (ground && target.speedKt < s.gsKt) {
    const brakeNm = (s.gsKt ** 2 - target.speedKt ** 2) / (2 * decel * 3600)
    if (toGo > brakeNm + 0.02) wantKt = kind === 'landing' ? s.gsKt : Math.min(s.gsKt, TAXI_KT)
  }
  const gsKt = clamp(wantKt, s.gsKt - decel * dtS, s.gsKt + ACCEL_KT_S * dtS)

  // Heading: fly to the waypoint (the final approach waypoints lie on the runway course).
  const want = bearingDeg(s.eastNm, s.northNm, target.eastNm, target.northNm)
  const turnRate = ground ? TAXI_TURN_DEG_S : MAX_TURN_DEG_S
  const dh = clamp(wrap180(want - s.headingDeg), -turnRate * dtS, turnRate * dtS)
  const headingDeg = wrap360(s.headingDeg + (toGo > 0.002 ? dh : 0))

  const stepNm = (((s.gsKt + gsKt) / 2) * dtS) / 3600
  const eastNm = s.eastNm + stepNm * Math.sin(headingDeg * DEG)
  const northNm = s.northNm + stepNm * Math.cos(headingDeg * DEG)

  // Vertical: on the ground stay at field elevation; on final follow the glide path; otherwise meet the next constraint.
  let altFt = s.altFt
  let vsFpm = 0
  const liftOff = kind === 'takeoff' && gsKt >= 145
  if (kind === 'final') {
    const glide = glidePathAltFt(distBeforeThresholdNm(eastNm, northNm))
    vsFpm = clamp(((glide - s.altFt) / dtS) * 60, -MAX_DESCENT_FPM, MAX_CLIMB_FPM)
    altFt = s.altFt + (vsFpm / 60) * dtS
  } else if (kind === 'landing') {
    // Flare to the touchdown zone, then roll out.
    const toTdz = distNm(eastNm, northNm, TDZ.eastNm, TDZ.northNm)
    const rate = s.altFt > A.elevationFt ? -Math.max(150, ((s.altFt - A.elevationFt) / Math.max((toTdz * 3600) / Math.max(gsKt, 1), 1)) * 60) : 0
    vsFpm = rate
    altFt = Math.max(A.elevationFt, s.altFt + (rate / 60) * dtS)
  } else if (!ground || liftOff) {
    const timeToWpS = (toGo * 3600) / Math.max(gsKt, 60)
    const need = ((target.altFt - s.altFt) / Math.max(timeToWpS, 1)) * 60
    vsFpm = target.altFt > s.altFt ? MAX_CLIMB_FPM : clamp(need, -MAX_DESCENT_FPM, 0)
    if (liftOff) vsFpm = 2000
    altFt = s.altFt + (vsFpm / 60) * dtS
    if ((vsFpm > 0 && altFt > target.altFt && !liftOff) || (vsFpm < 0 && altFt < target.altFt)) altFt = target.altFt
  }
  const fieldFt = kind === 'landing' || kind === 'taxi-in' ? A.elevationFt : D.elevationFt
  const onGround = ground && !liftOff && altFt <= fieldFt + 0.5

  // Sequence the next waypoint: fly-by in the air (turn anticipation), fly-over on the ground.
  let wp = s.wp
  const leftNm = distNm(eastNm, northNm, target.eastNm, target.northNm)
  const next = ROUTE[wp + 1]
  let lead = 0.01
  if (!ground && next) {
    const turn = Math.abs(wrap180(bearingDeg(target.eastNm, target.northNm, next.eastNm, next.northNm) - want))
    const radiusNm = gsKt / (MAX_TURN_DEG_S * DEG * 3600)
    lead = Math.min(radiusNm * Math.tan((turn * DEG) / 2), 3)
  }
  // Passing abeam also counts, so a waypoint is never circled.
  const passed = Math.cos((wrap180(bearingDeg(eastNm, northNm, target.eastNm, target.northNm) - headingDeg)) * DEG) < 0 && leftNm < 1
  if ((leftNm <= Math.max(lead, 0.01) || passed) && wp < ROUTE.length - 1) wp++
  const parked = s.wp === ROUTE.length - 1 && leftNm < 0.08 && gsKt < 0.5
  return { eastNm, northNm, altFt, headingDeg, gsKt: parked ? 0 : gsKt, vsFpm, wp, onGround, parked }
}

/** Height of the destination runway surface, m, for the approach view. */
export const DESTINATION_ELEVATION_M = A.elevationFt * M_PER_FT
