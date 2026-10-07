/**
 * The fix the aircraft navigates with, chosen in one place for every view (CLAUDE.md:
 * the orbit view, the flight view, the sky plot, the panels and the cockpit agree).
 * Until the first correction arrives the story flies GPS alone (director.ts sbasShown);
 * then the flight stage's alert limits pick the source (navStatus), and on final the
 * approach mode the avionics annunciate picks it (approachMode: LPV uses the SBAS
 * vertical-guidance fix). Pure.
 */
import type { ApproachMode, Fix } from '@/core/receiver'
import { approachMode, navStatus, type Snapshot } from '@/core/sbasWorld'
import { operationFor, type FlightStage, type Operation } from '@/core/operations'
import type { PhaseId } from './phases'
import { stageAt } from './director'

export interface NavFix {
  /** The fix navigated with (its satellites are the ones "used"). */
  fix: Fix | null
  source: 'sbas' | 'abas' | 'none'
  stage: FlightStage
  /** The operation whose alert limits apply now, if any. */
  op: Operation | null
  /** The approach mode if SBAS were in use (annunciated once it is). */
  approach: { mode: ApproachMode; fix: Fix | null }
}

export function navFix(snap: Snapshot, phase: PhaseId, wp: number, sbasShown: boolean): NavFix {
  const stage = stageAt(phase, wp)
  const op = operationFor(stage)
  // From the final approach fix on, an LPV approach that loses LPV reverts to LNAV, never LNAV/VNAV.
  const approach = approachMode(snap, undefined, stage === 'final' || stage === 'landed')
  if (!sbasShown) return { fix: snap.abas, source: snap.abas ? 'abas' : 'none', stage, op, approach }
  if (stage === 'final') {
    const am = approach.fix
    // Without vertical guidance (LNAV or none) there is no VPL to show against the VAL.
    const fix = am && (approach.mode === 'LNAV' || approach.mode === 'NONE') ? { ...am, vplM: null } : am
    return { fix, source: am ? (am === snap.abas ? 'abas' : 'sbas') : 'none', stage, op, approach }
  }
  if (op) {
    const ns = navStatus(snap, op)
    return { fix: ns.fix, source: ns.source, stage, op, approach }
  }
  const fix = snap.sbasFix ?? snap.abas
  return { fix, source: snap.sbasFix ? 'sbas' : snap.abas ? 'abas' : 'none', stage, op, approach }
}

/** The same, read from a running journey. */
export interface NavFixSource {
  snapshot(): Snapshot
  state: { phase: PhaseId }
  aircraft: { wp: number }
  sbasShown: boolean
}
export const journeyNavFix = (e: NavFixSource): NavFix => navFix(e.snapshot(), e.state.phase, e.aircraft.wp, e.sbasShown)
