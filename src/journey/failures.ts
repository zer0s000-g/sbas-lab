/**
 * "Break something": each failure, what it does to the SBAS world, what the learner
 * should notice, and what the crew and the controller do. The flight keeps its planned
 * path whatever is broken (design.md §6).
 *
 * A failure that starts at a moment (a clock jump, losing the GEO signal) records the
 * world time it was switched on, so the effect is a pure function of time and a jump
 * to a phase stays deterministic.
 */
import { NOMINAL, type Conditions } from '@/core/sbasWorld'
import { SCENARIO } from '@/scenarios/active'

export type FailureId = 'clockJump' | 'geoLost' | 'storm' | 'scintillation' | 'stationOffline' | 'jamming' | 'sbasOff' | 'l1Only' | 'evening' | 'dfmcPreview'

/** Every failure id, whichever scenario offers it (the state keeps a switch for each). */
export const ALL_FAILURE_IDS: readonly FailureId[] = ['clockJump', 'geoLost', 'storm', 'scintillation', 'stationOffline', 'jamming', 'sbasOff', 'l1Only', 'evening', 'dfmcPreview']

export interface FailureDef {
  id: FailureId
  label: string
  /** What it is, in plain words. */
  explain: string
  /** What the learner should notice on screen. */
  notice: string
  /** What the crew and the controller do. */
  crewAtc: string
  /** Doc 9849 sections behind it (docs/SOURCES.md). */
  source: string
  /** The claims (src/content/claims) behind the words, when the scenario lists them. */
  claims?: readonly string[]
}

/** The failures the active scenario offers, in the order the page lists them. */
export const FAILURES: readonly FailureDef[] = SCENARIO.failures.list

export type FailureState = Record<FailureId, boolean>
export const NO_FAILURES: FailureState = Object.fromEntries(ALL_FAILURE_IDS.map((id) => [id, false])) as FailureState

/** World times at which the timed failures were switched on (null while off). */
export interface FailureTimes {
  clockJumpS: number | null
  clockJumpSat: string | null
  geoLostS: number | null
}
export const NO_TIMES: FailureTimes = { clockJumpS: null, clockJumpSat: null, geoLostS: null }

/** RIMS taken offline by the "stations offline" failure. */
export const OFFLINE_SET: readonly string[] = SCENARIO.failures.offlineSet
/** How big the clock jump is, m. */
export const CLOCK_JUMP_M = SCENARIO.failures.clockJumpM
/** Local hour for the evening flight: just after sunset. */
export const EVENING_START_HOUR = SCENARIO.failures.eveningStartHour

/** The SBAS world conditions for a set of failures. */
export function conditionsFor(f: FailureState, times: FailureTimes, base: Conditions = NOMINAL): Conditions {
  return {
    ...base,
    startLocalHour: f.evening ? EVENING_START_HOUR : base.startLocalHour,
    storm: f.storm ? 1 : 0,
    scintillation: f.scintillation,
    // GPS alone, else the switched service, else the scenario's own (DFMC in Indonesia, L1 for EGNOS today).
    service: f.sbasOff ? 'off' : f.l1Only ? 'l1' : f.dfmcPreview ? 'dfmc' : base.service,
    geoLostFromS: f.geoLost ? (times.geoLostS ?? 0) : null,
    offlineStations: f.stationOffline ? OFFLINE_SET : [],
    fault: f.clockJump && times.clockJumpSat !== null && times.clockJumpS !== null ? { satId: times.clockJumpSat, startS: times.clockJumpS, jumpM: CLOCK_JUMP_M } : null,
    jammed: f.jamming,
  }
}
