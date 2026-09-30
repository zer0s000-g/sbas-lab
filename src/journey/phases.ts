/**
 * The twelve phases of LAB201's journey and the precomputed journey index.
 *
 * The world advances in fixed ticks of TICK_S. The index holds the aircraft state at
 * every tick of the whole flight (computed once with `stepFlight`), so jumping to a
 * phase lands on exactly the state that playing up to it would reach.
 *
 * Phases 4–8 (errors to broadcast) are slow-motion moments: the world is frozen at one
 * tick while a signal or a message plays on its own clock (CLAUDE.md "slow motion
 * freezes the world").
 */
import { initialAircraft, ROUTE, stepFlight, type AircraftState } from '@/core/flight'
import { DEPARTURE } from '@/core/region'

export const TICK_S = 0.1
/** The aircraft waits at the gate for the pre-flight check before it starts to taxi, s. */
export const GATE_HOLD_S = 60

export type PhaseId = 'gate' | 'takeoff' | 'climb' | 'errors' | 'reference' | 'master' | 'uplink' | 'broadcast' | 'cruise' | 'descent' | 'final' | 'landing'

export interface PhaseDef {
  id: PhaseId
  label: string
  /** A slow-motion moment: world frozen, `signalS` seconds of signal time on screen. */
  frozen: boolean
  signalS: number
}

export const PHASES: readonly PhaseDef[] = [
  { id: 'gate', label: 'Gate', frozen: false, signalS: 0 },
  { id: 'takeoff', label: 'Taxi/Takeoff', frozen: false, signalS: 0 },
  { id: 'climb', label: 'Climb', frozen: false, signalS: 0 },
  { id: 'errors', label: 'Errors', frozen: true, signalS: 18 },
  { id: 'reference', label: 'Reference', frozen: true, signalS: 16 },
  { id: 'master', label: 'Master', frozen: true, signalS: 18 },
  { id: 'uplink', label: 'Uplink', frozen: true, signalS: 12 },
  { id: 'broadcast', label: 'Broadcast', frozen: true, signalS: 16 },
  { id: 'cruise', label: 'Cruise', frozen: false, signalS: 0 },
  { id: 'descent', label: 'Descent', frozen: false, signalS: 0 },
  { id: 'final', label: 'Final', frozen: false, signalS: 0 },
  { id: 'landing', label: 'Landing', frozen: false, signalS: 0 },
]

export const PHASE_INDEX = new Map(PHASES.map((p, i) => [p.id, i]))
export const phaseDef = (id: PhaseId) => PHASES[PHASE_INDEX.get(id)!]
export const nextPhase = (id: PhaseId): PhaseId | null => PHASES[PHASE_INDEX.get(id)! + 1]?.id ?? null

export interface JourneyIndex {
  /** Aircraft state at every tick; tick k is world time k·TICK_S. */
  states: readonly AircraftState[]
  /** First tick of each phase (the frozen phases share one tick). */
  startTick: Readonly<Record<PhaseId, number>>
  /** Tick of the first wheel contact at the destination. */
  touchdownTick: number
  /** The last tick of the journey. */
  endTick: number
}

const wpIndex = (id: string) => ROUTE.findIndex((w) => w.id === id)

/** Fly the whole journey once and find where each phase starts. */
export function buildJourneyIndex(): JourneyIndex {
  const holdTicks = Math.round(GATE_HOLD_S / TICK_S)
  const states: AircraftState[] = []
  let s = initialAircraft()
  for (let k = 0; k < holdTicks; k++) states.push(s)
  let guard = 0
  while (!s.parked && guard++ < 100_000) {
    states.push(s)
    s = stepFlight(s, TICK_S)
  }
  states.push(s)
  // Stay parked a little so the landing phase ends at the gate.
  for (let k = 0; k < 100; k++) states.push(s)
  const first = (from: number, pred: (st: AircraftState) => boolean) => {
    for (let k = from; k < states.length; k++) if (pred(states[k])) return k
    return states.length - 1
  }
  const airborne = first(holdTicks, (st) => !st.onGround && st.altFt > DEPARTURE.elevationFt + 1000)
  const chain = first(airborne, (st) => st.altFt >= 10_000)
  const tod = first(chain, (st) => st.wp >= wpIndex('ARR1'))
  const faf = first(tod, (st) => st.wp >= wpIndex('THR'))
  const threshold = first(faf, (st) => st.wp >= wpIndex('TDZ'))
  const touchdownTick = first(threshold, (st) => st.onGround)
  const startTick: Record<PhaseId, number> = {
    gate: 0,
    takeoff: holdTicks,
    climb: airborne,
    errors: chain,
    reference: chain,
    master: chain,
    uplink: chain,
    broadcast: chain,
    cruise: chain,
    descent: tod,
    final: faf,
    landing: threshold,
  }
  return { states, startTick, touchdownTick, endTick: states.length - 1 }
}

let cached: JourneyIndex | null = null
/** The journey index, built on first use. */
export function journeyIndex(): JourneyIndex {
  if (!cached) cached = buildJourneyIndex()
  return cached
}

/** The world (non-frozen) phase a tick belongs to. */
export function worldPhaseAt(index: JourneyIndex, tick: number): PhaseId {
  let current: PhaseId = 'gate'
  for (const p of PHASES) if (!p.frozen && tick >= index.startTick[p.id]) current = p.id
  return current
}

/** The tick at which a phase ends (the next world phase's start), for progress. */
export function phaseEndTick(index: JourneyIndex, id: PhaseId): number {
  if (phaseDef(id).frozen) return index.startTick[id]
  const i = PHASE_INDEX.get(id)!
  for (let j = i + 1; j < PHASES.length; j++) if (!PHASES[j].frozen) return index.startTick[PHASES[j].id]
  return index.endTick
}
