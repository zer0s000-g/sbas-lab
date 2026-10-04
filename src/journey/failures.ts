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

export type FailureId = 'clockJump' | 'geoLost' | 'storm' | 'scintillation' | 'stationOffline' | 'jamming' | 'sbasOff' | 'l1Only' | 'evening'

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
}

export const FAILURES: readonly FailureDef[] = [
  {
    id: 'clockJump',
    label: 'Satellite clock jump',
    explain: 'One GPS satellite clock suddenly jumps, so its range is wrong by tens of metres.',
    notice: 'The master station sees it and sends "Do not use". The message log shows the alarm reaching LAB201 inside the time to alert.',
    crewAtc: 'Nothing to do: the receiver drops the satellite by itself and the approach continues.',
    source: 'Doc 9849 §2.2.4.4, §4.3.1.3',
  },
  {
    id: 'geoLost',
    label: 'GEO signal lost',
    explain: 'LAB201 stops receiving both SBAS GEO satellites, QZS-3 and QZS-6.',
    notice: 'The last message gets older. After the time-out LPV is lost and the receiver falls back to GPS alone with LNAV minima.',
    crewAtc: 'The crew report the loss of LPV to ATC and continue to LNAV minima or ask for another approach.',
    source: 'Doc 9849 §4.3.2.10, §4.3.4.3',
  },
  {
    id: 'storm',
    label: 'Ionospheric storm',
    explain: 'A solar storm makes the ionosphere much thicker and less even.',
    notice: 'GIVE grows. With L1 SBAS, VPL goes above VAL and LPV becomes unavailable. DFMC removes the delay and keeps LPV.',
    crewAtc: 'Space weather advisories and NOTAMs warn of reduced SBAS approach availability. Crews plan LNAV or another approach.',
    source: 'Doc 9849 §5.2.1.2, §5.2.1.6, §7.13.3',
  },
  {
    id: 'scintillation',
    label: 'Equatorial scintillation',
    explain: 'After sunset near the equator, bubbles in the ionosphere make signals flicker and drop out.',
    notice: 'A few satellites vanish from the sky plot, on L1 and L5 alike, and DOP grows. Two frequencies do not help here.',
    crewAtc: 'Usually nothing. If too many satellites are lost, the crew use other means and tell ATC.',
    source: 'Doc 9849 §5.2.1.3–5.2.1.5',
  },
  {
    id: 'stationOffline',
    label: 'RIMS offline',
    explain: 'The eight RIMS east of Bali stop sending data to the master control centre.',
    notice: 'Fewer stations see each satellite. Some become "not monitored", the grid gets holes and the service edge moves.',
    crewAtc: 'The SBAS provider issues a NOTAM for the reduced service. Crews check it before the flight.',
    source: 'Doc 9849 §4.3.1.3, §4.3.3.4.1',
  },
  {
    id: 'jamming',
    label: 'GPS jamming',
    explain: 'Radio interference drowns every satellite signal.',
    notice: 'No satellites, no position, no GNSS approach. SBAS cannot help, because it needs the GPS signals too.',
    crewAtc: 'The crew report the interference. ATC gives radar vectors, and the aircraft uses its inertial system, DME or an ILS where one exists.',
    source: 'Doc 9849 §7.13.2',
  },
  {
    id: 'sbasOff',
    label: 'SBAS off (GPS alone)',
    explain: 'The receiver ignores SBAS and uses GPS with its own integrity check (RAIM/FDE).',
    notice: 'The protection level grows many times over, there is no vertical protection level, and the best approach is LNAV.',
    crewAtc: 'The approach is flown to LNAV minima, which are higher, so more flights may divert in bad weather.',
    source: 'Doc 9849 §1.4.2.2, §4.2',
  },
  {
    id: 'l1Only',
    label: 'L1 only (no L5)',
    explain: 'The receiver uses the single-frequency L1 SBAS service and its ionospheric grid instead of the dual-frequency service.',
    notice: 'Near the equator the grid cannot follow the ionosphere, so VPL is too large for LPV. L1 SBAS still protects en route and terminal flight.',
    crewAtc: 'LPV is not offered, and crews plan LNAV minima. This is why dual-frequency SBAS matters in equatorial States.',
    source: 'Doc 9849 §4.3.1.4, §5.2.1.5, §6.8.2',
  },
  {
    id: 'evening',
    label: 'Evening flight',
    explain: 'The same flight after sunset, leaving Jakarta at about 19:00 WIB, when equatorial bubbles form.',
    notice: 'Scintillation appears and the L1 grid is trusted less. DFMC still gives LPV, unless too many satellites drop out.',
    crewAtc: 'Nothing changes for a DFMC crew. With L1 only, LPV is not available.',
    source: 'Doc 9849 §5.2.1.4–5.2.1.5',
  },
]

export type FailureState = Record<FailureId, boolean>
export const NO_FAILURES: FailureState = Object.fromEntries(FAILURES.map((f) => [f.id, false])) as FailureState

/** World times at which the timed failures were switched on (null while off). */
export interface FailureTimes {
  clockJumpS: number | null
  clockJumpSat: string | null
  geoLostS: number | null
}
export const NO_TIMES: FailureTimes = { clockJumpS: null, clockJumpSat: null, geoLostS: null }

/** RIMS taken offline by the "stations offline" failure: every site east of Bali. */
export const OFFLINE_SET = ['RIMS-KOE', 'RIMS-BPN', 'RIMS-UPG', 'RIMS-MDC', 'RIMS-AMQ', 'RIMS-SOQ', 'RIMS-DJJ', 'RIMS-MKQ'] as const
/** How big the clock jump is, m. */
export const CLOCK_JUMP_M = 40
/** Local hour for the evening flight: just after sunset. */
export const EVENING_START_HOUR = 19.5

/** The SBAS world conditions for a set of failures. */
export function conditionsFor(f: FailureState, times: FailureTimes, base: Conditions = NOMINAL): Conditions {
  return {
    ...base,
    startLocalHour: f.evening ? EVENING_START_HOUR : base.startLocalHour,
    storm: f.storm ? 1 : 0,
    scintillation: f.scintillation,
    service: f.sbasOff ? 'off' : f.l1Only ? 'l1' : 'dfmc',
    geoLostFromS: f.geoLost ? (times.geoLostS ?? 0) : null,
    offlineStations: f.stationOffline ? OFFLINE_SET : [],
    fault: f.clockJump && times.clockJumpSat !== null && times.clockJumpS !== null ? { satId: times.clockJumpSat, startS: times.clockJumpS, jumpM: CLOCK_JUMP_M } : null,
    jammed: f.jamming,
  }
}
