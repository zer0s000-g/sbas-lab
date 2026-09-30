/**
 * Stage 0 kit preview only (removed in Stage 3). One tiny demo "world" that the
 * panels and the demo stage both read, so they agree the way the real views will
 * agree on the engine state. These are placeholder values, not SBAS physics: the
 * engine arrives in Stage 1.
 */
import { M_PER_NM, M_PER_FT } from '@/core/units'
import { toU } from '@/stage/scale'

/** LPV alert limits, m: ICAO Annex 10 Vol I, Table 3.7.2.4-1 (APV-I: HAL 40 m, VAL 50 m). */
export const DEMO_HAL_M = 40
export const DEMO_VAL_M = 50

/** Runway 09 of the made-up destination: 3000 m long, 45 m wide, centred on the table. */
export const RUNWAY_LENGTH_M = 3000
export const RUNWAY_WIDTH_M = 45
/** LAB201 on final: 2 NM before the threshold on a 3° path. */
export const DEMO_DIST_NM = 2
export const DEMO_ALT_FT = Math.round((DEMO_DIST_NM * M_PER_NM * Math.tan((3 * Math.PI) / 180)) / M_PER_FT + 50)

export const RWY_HALF_NM = RUNWAY_LENGTH_M / 2 / M_PER_NM
/** Scene positions (no three.js here, so the page can build camera shots before the 3D chunk loads). */
export const THRESHOLD = toU(-RWY_HALF_NM, 0, 0)
export const AIRCRAFT = toU(-RWY_HALF_NM - DEMO_DIST_NM, 0, DEMO_ALT_FT)
/** Satellites are placed symbolically above the table (not to scale). */
export const GPS_SAT: [number, number, number] = [-9, 9, 7]
export const GEO_SAT: [number, number, number] = [10, 10, -9]

export interface DemoWorld {
  /** World time, s (stands still while frozen). */
  timeS: number
  /** Real seconds since start (keeps running while frozen; drives slow-motion signals). */
  realS: number
  frozen: boolean
  hplM: number
  vplM: number
}

export const demo: DemoWorld = { timeS: 0, realS: 0, frozen: false, hplM: 12, vplM: 18 }

/** Advance the demo world. `dt` is world time (0 while paused or frozen). */
export function stepDemo(dt: number, realDt: number) {
  demo.realS += Number.isFinite(realDt) ? Math.max(0, realDt) : 0
  if (demo.frozen || !(dt > 0) || !Number.isFinite(dt)) return
  demo.timeS += dt
  demo.hplM = 12 + 3 * Math.sin(demo.timeS / 7)
  demo.vplM = 18 + 4 * Math.sin(demo.timeS / 5 + 1)
}

export function resetDemo() {
  Object.assign(demo, { timeS: 0, realS: 0, frozen: false, hplM: 12, vplM: 18 })
}
