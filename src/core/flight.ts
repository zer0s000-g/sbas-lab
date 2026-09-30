/**
 * LAB201, gate to gate between the two made-up airports. The aircraft moves only
 * through `stepFlight` (CLAUDE.md), in the local NM frame, with simple limits: a turn
 * rate of at most 3°/s, bounded climb and descent rates, and bounded acceleration.
 * The route and its constraints are made up for this fictional region.
 */
import { DEG, clamp, wrap180, wrap360, M_PER_NM, M_PER_FT } from './units'
import { positiveStep } from './guard'
import { DEPARTURE, DESTINATION } from './region'
import { makeFasDataBlock } from './approach'

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

export const ROUTE: readonly Waypoint[] = [
  { id: 'GATE-N', eastNm: D.thresholdEastNm + 0.7, northNm: D.thresholdNorthNm - 0.22, altFt: D.elevationFt, speedKt: 0, kind: 'taxi-out' },
  { id: 'TWY-A', eastNm: D.thresholdEastNm - 0.1, northNm: D.thresholdNorthNm - 0.22, altFt: D.elevationFt, speedKt: 15, kind: 'taxi-out' },
  { id: 'HOLD', eastNm: D.thresholdEastNm - 0.1, northNm: D.thresholdNorthNm - 0.04, altFt: D.elevationFt, speedKt: 12, kind: 'taxi-out' },
  { id: 'RWY09-N', eastNm: D.thresholdEastNm, northNm: D.thresholdNorthNm, altFt: D.elevationFt, speedKt: 8, kind: 'lineup' },
  { id: 'ROTATE', eastNm: D.thresholdEastNm + 1.0, northNm: D.thresholdNorthNm, altFt: D.elevationFt, speedKt: 150, kind: 'takeoff' },
  { id: 'DEP1', eastNm: D.thresholdEastNm + 8, northNm: D.thresholdNorthNm, altFt: 3000, speedKt: 190, kind: 'air' },
  { id: 'CLIMB', eastNm: -22, northNm: -9, altFt: 12000, speedKt: 260, kind: 'air' },
  { id: 'TOC', eastNm: -8, northNm: -3, altFt: 16000, speedKt: 300, kind: 'air' },
  { id: 'TOD', eastNm: 10, northNm: 4, altFt: 16000, speedKt: 300, kind: 'air' },
  { id: 'ARR1', eastNm: 24, northNm: 12, altFt: 7000, speedKt: 230, kind: 'air' },
  { id: 'IF', eastNm: A.thresholdEastNm - 10, northNm: A.thresholdNorthNm, altFt: 3200, speedKt: 170, kind: 'air' },
  { id: 'FAF', eastNm: A.thresholdEastNm - 5, northNm: A.thresholdNorthNm, altFt: Math.round(glidePathAltFt(5)), speedKt: 145, kind: 'final' },
  { id: 'THR', eastNm: A.thresholdEastNm, northNm: A.thresholdNorthNm, altFt: Math.round(glidePathAltFt(0)), speedKt: 140, kind: 'final' },
  { id: 'TDZ', eastNm: A.thresholdEastNm + 0.2, northNm: A.thresholdNorthNm, altFt: A.elevationFt, speedKt: 135, kind: 'landing' },
  { id: 'EXIT', eastNm: A.thresholdEastNm + 1.1, northNm: A.thresholdNorthNm, altFt: A.elevationFt, speedKt: 20, kind: 'landing' },
  { id: 'TWY-B', eastNm: A.thresholdEastNm + 1.2, northNm: A.thresholdNorthNm + 0.2, altFt: A.elevationFt, speedKt: 15, kind: 'taxi-in' },
  { id: 'GATE-C', eastNm: A.thresholdEastNm + 0.8, northNm: A.thresholdNorthNm + 0.3, altFt: A.elevationFt, speedKt: 0, kind: 'taxi-in' },
]

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

export function initialAircraft(): AircraftState {
  const g = ROUTE[0]
  return { eastNm: g.eastNm, northNm: g.northNm, altFt: g.altFt, headingDeg: 270, gsKt: 0, vsFpm: 0, wp: 1, onGround: true, parked: false }
}

const bearingDeg = (fromE: number, fromN: number, toE: number, toN: number) => wrap360(Math.atan2(toE - fromE, toN - fromN) / DEG)
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
    const d = A.thresholdEastNm - eastNm
    const glide = glidePathAltFt(d)
    vsFpm = clamp(((glide - s.altFt) / dtS) * 60, -MAX_DESCENT_FPM, MAX_CLIMB_FPM)
    altFt = s.altFt + (vsFpm / 60) * dtS
  } else if (kind === 'landing') {
    // Flare to the touchdown zone, then roll out.
    const toTdz = distNm(eastNm, northNm, ROUTE[13].eastNm, ROUTE[13].northNm)
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
  const onGround = ground && !liftOff && altFt <= (kind === 'takeoff' ? D.elevationFt : A.elevationFt) + 0.5

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
