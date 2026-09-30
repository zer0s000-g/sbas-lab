/**
 * Signal-in-space integrity requirements per typical operation: horizontal and
 * vertical alert limits and the time to alert. Values from Doc 9849, Table 2-1, which
 * takes them from ICAO Annex 10, Volume I, Chapter 3, Table 3.7.2.4-1.
 *
 * Protection levels are upper confidence bounds on the position error; alert limits
 * are the largest error an operation allows without an alert. When a protection level
 * exceeds its alert limit the avionics must alert the crew (Doc 9849 §2.2.4.3).
 */
import { M_PER_NM } from './units'

export type OperationId = 'oceanic' | 'enroute' | 'terminal' | 'npa' | 'lnavvnav' | 'apv1' | 'apv2' | 'cat1'

export interface Operation {
  id: OperationId
  name: string
  /** Horizontal alert limit, m. */
  halM: number
  /** Vertical alert limit, m, or null where the operation has no vertical guidance. */
  valM: number | null
  /** Time to alert, s. */
  ttaS: number
  /** Where the numbers come from. */
  source: string
}

const T21 = 'Doc 9849 Table 2-1 (Annex 10 Vol I Table 3.7.2.4-1)'

export const OPERATIONS: Record<OperationId, Operation> = {
  oceanic: { id: 'oceanic', name: 'Oceanic en route', halM: 4 * M_PER_NM, valM: null, ttaS: 300, source: T21 },
  enroute: { id: 'enroute', name: 'Continental en route', halM: 2 * M_PER_NM, valM: null, ttaS: 300, source: T21 },
  terminal: { id: 'terminal', name: 'Terminal', halM: 1 * M_PER_NM, valM: null, ttaS: 15, source: T21 },
  npa: { id: 'npa', name: 'Non-precision approach (LNAV)', halM: 0.3 * M_PER_NM, valM: null, ttaS: 10, source: T21 },
  // TODO(expert-review): SBAS LNAV/VNAV alert limits (HAL 556 m, VAL 50 m) follow RTCA DO-229, not Table 2-1 (Note 3 there covers Baro VNAV).
  lnavvnav: { id: 'lnavvnav', name: 'LNAV/VNAV (SBAS vertical)', halM: 0.3 * M_PER_NM, valM: 50, ttaS: 10, source: 'RTCA DO-229 (to confirm)' },
  apv1: { id: 'apv1', name: 'APV-I (LPV)', halM: 40, valM: 50, ttaS: 10, source: T21 },
  apv2: { id: 'apv2', name: 'APV-II', halM: 40, valM: 20, ttaS: 6, source: T21 },
  // Table 2-1 gives a CAT I VAL of 35 to 10 m; SBAS CAT I (LPV-200) uses 35 m (Doc 9849 §4.3.3.3).
  cat1: { id: 'cat1', name: 'Category I (LPV-200)', halM: 40, valM: 35, ttaS: 6, source: `${T21}; §4.3.3.3` },
}

/** The operation that sets the alert limits in each part of the journey. */
export type FlightStage = 'ground' | 'departure' | 'terminal' | 'enroute' | 'approach' | 'final' | 'landed'

export function operationFor(stage: FlightStage, finalOp: OperationId = 'apv1'): Operation | null {
  switch (stage) {
    case 'departure':
    case 'terminal':
      return OPERATIONS.terminal
    case 'enroute':
      return OPERATIONS.enroute
    case 'approach':
      return OPERATIONS.npa
    case 'final':
      return OPERATIONS[finalOp]
    default:
      return null
  }
}

/** True when both protection levels are within the operation's alert limits (a missing VPL fails a vertical operation). */
export function withinLimits(op: Operation, hplM: number, vplM: number | null): boolean {
  if (!(hplM <= op.halM)) return false
  if (op.valM === null) return true
  return vplM !== null && vplM <= op.valM
}
