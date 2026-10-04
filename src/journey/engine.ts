/**
 * The journey engine: one world, one clock (CLAUDE.md). It owns the journey position
 * (phase, tick, signal time), the time-lapse, the guided stops and the failures, and
 * computes the SBAS snapshot every view reads, so the orbit view, the flight view, the
 * network map and the panels always agree.
 *
 * Time:
 * - the world advances only in whole ticks of TICK_S, at the time-lapse speed;
 * - in a frozen phase (slow motion) the world tick stands still and the signal clock
 *   runs in real time instead.
 * No timers: everything happens inside `advance`, so a reset or a jump leaves nothing behind.
 */
import { localToGeodetic } from '@/core/geo'
import { REGION } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { MAX_FRAME_S, nearestSpeed, DEFAULT_SPEEDS } from '@/core/clock'
import type { AircraftState } from '@/core/flight'
import { snapshot as sbasSnapshot, type Conditions, type Snapshot } from '@/core/sbasWorld'
import { conditionsFor, NO_FAILURES, NO_TIMES, type FailureId, type FailureState, type FailureTimes } from './failures'
import { directionFor, sbasShown } from './director'
import { journeyIndex, nextPhase, PHASE_INDEX, PHASES, phaseDef, phaseEndTick, TICK_S, worldPhaseAt, type JourneyIndex, type PhaseId } from './phases'

export type StopId = 'firstFix' | 'firstCorrection' | 'lpvEngaged' | 'touchdown'

/** The four guided stops (design.md §4), in journey order, with the phase they belong to. */
export const STOPS: readonly { id: StopId; phase: PhaseId }[] = [
  { id: 'firstFix', phase: 'takeoff' },
  { id: 'firstCorrection', phase: 'broadcast' },
  { id: 'lpvEngaged', phase: 'final' },
  { id: 'touchdown', phase: 'landing' },
]

export type SpeedMode = 'auto' | number

/** The discrete journey state: it changes only on events (a phase, a stop, a setting), never per tick. */
export interface JourneyState {
  phase: PhaseId
  running: boolean
  speedMode: SpeedMode
  /** The guided stop the journey is paused at, if any. */
  stop: StopId | null
  fired: readonly StopId[]
  guidedStops: boolean
  failures: FailureState
  times: FailureTimes
  /** The journey has reached the gate at the destination. */
  done: boolean
}

export function initialJourney(opts: { guidedStops?: boolean; running?: boolean } = {}): JourneyState {
  return {
    phase: 'gate',
    running: opts.running ?? true,
    speedMode: 'auto',
    stop: null,
    fired: [],
    guidedStops: opts.guidedStops ?? true,
    failures: { ...NO_FAILURES },
    times: { ...NO_TIMES },
    done: false,
  }
}

const stopOnEntry = (phase: PhaseId): StopId | null => (phase === 'takeoff' ? 'firstFix' : phase === 'final' ? 'lpvEngaged' : null)

export class JourneyEngine {
  readonly index: JourneyIndex
  private s: JourneyState
  /** World tick and signal time: continuous, read by the views at their own rate. */
  private tickN = 0
  private signal = 0
  private acc = 0
  private listeners = new Set<() => void>()
  private cache: { key: string; snap: Snapshot } | null = null

  constructor(opts: { guidedStops?: boolean; running?: boolean; index?: JourneyIndex } = {}) {
    this.index = opts.index ?? journeyIndex()
    this.s = initialJourney(opts)
  }

  /** The current state (a new object whenever something discrete changes). */
  get state(): JourneyState {
    return this.s
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<JourneyState>) {
    this.s = { ...this.s, ...patch }
    this.listeners.forEach((l) => l())
  }

  get tick(): number {
    return this.tickN
  }

  /** Signal time inside a frozen phase, s. */
  get signalS(): number {
    return this.signal
  }

  get worldS(): number {
    return this.tickN * TICK_S
  }

  get aircraft(): AircraftState {
    return this.index.states[Math.min(this.tickN, this.index.endTick)]
  }

  /** Everything, for tests and debugging. */
  full() {
    return { ...this.s, tick: this.tickN, signalS: this.signal, aircraft: this.aircraft }
  }

  get frozen(): boolean {
    return phaseDef(this.s.phase).frozen
  }

  /** The time-lapse in force: the director's in auto mode, otherwise the learner's. */
  get speed(): number {
    return this.s.speedMode === 'auto' ? directionFor(this.s.phase).autoSpeed : this.s.speedMode
  }

  /** The first correction has reached LAB201 (the story shows SBAS from here). */
  get sbasShown(): boolean {
    const broadcastDone = this.s.phase === 'broadcast' && this.signal >= phaseDef('broadcast').signalS
    return sbasShown(this.s.phase, broadcastDone || this.s.fired.includes('firstCorrection'))
  }

  /** 0..1 through the journey, a twelfth per phase. */
  get progress(): number {
    const i = PHASE_INDEX.get(this.s.phase)!
    const def = phaseDef(this.s.phase)
    let f: number
    if (def.frozen) f = this.signal / def.signalS
    else {
      const a = this.index.startTick[def.id]
      const b = phaseEndTick(this.index, def.id)
      f = b > a ? (this.tickN - a) / (b - a) : 1
    }
    return (i + Math.min(1, Math.max(0, f))) / PHASES.length
  }

  conditions(): Conditions {
    return conditionsFor(this.s.failures, this.s.times)
  }

  /** The SBAS world at the current tick (cached until the tick or the failures change). */
  snapshot(): Snapshot {
    const key = `${this.tickN}|${JSON.stringify(this.s.failures)}|${JSON.stringify(this.s.times)}`
    if (this.cache?.key === key) return this.cache.snap
    const a = this.aircraft
    const snap = sbasSnapshot(this.worldS, localToGeodetic(REGION, a.eastNm, a.northNm, a.altFt * M_PER_FT), this.conditions())
    this.cache = { key, snap }
    return snap
  }

  play() {
    if (this.s.stop) return this.continueFromStop()
    if (!this.s.running) this.set({ running: true })
  }

  pause() {
    if (this.s.running) this.set({ running: false })
  }

  toggle() {
    if (this.s.running && !this.s.stop) this.pause()
    else this.play()
  }

  continueFromStop() {
    if (!this.s.stop) return
    const stop = this.s.stop
    this.set({ stop: null, running: true })
    // The first-correction stop comes at the end of the broadcast: carry on into cruise.
    if (stop === 'firstCorrection' && this.s.phase === 'broadcast') this.enter('cruise')
  }

  setSpeed(mode: SpeedMode) {
    const speedMode = mode === 'auto' ? 'auto' : nearestSpeed(mode, DEFAULT_SPEEDS)
    if (speedMode !== this.s.speedMode) this.set({ speedMode })
  }

  setGuidedStops(on: boolean) {
    if (on !== this.s.guidedStops) this.set({ guidedStops: on })
  }

  /** Switch a failure on or off. Timed failures start at the current world time. */
  setFailure(id: FailureId, on: boolean) {
    if (this.s.failures[id] === on) return
    const failures = { ...this.s.failures, [id]: on }
    const times = { ...this.s.times }
    if (id === 'clockJump') Object.assign(times, on ? this.clockJumpNow() : { clockJumpSat: null, clockJumpS: null })
    if (id === 'geoLost') times.geoLostS = on ? this.worldS : null
    this.set({ failures, times })
  }

  /**
   * A clock jump starting now: it hits a satellite LAB201 is using, or, with no fix (all
   * signals jammed), one above its horizon, so the failure is never switched on without effect.
   */
  private clockJumpNow(): Pick<FailureTimes, 'clockJumpSat' | 'clockJumpS'> {
    const s = this.snapshot()
    const sat = s.dfmc?.used[0] ?? s.abas?.used[0] ?? s.sats.find((v) => v.kind === 'gps' && v.visible)?.id ?? null
    return { clockJumpSat: sat, clockJumpS: sat ? this.worldS : null }
  }

  /** Jump to the start of a phase. The result equals playing up to it. */
  jumpTo(phase: PhaseId) {
    const target = PHASE_INDEX.get(phase)!
    // Stops before the target count as seen; stops at or after it are armed again.
    const fired = STOPS.filter((st) => PHASE_INDEX.get(st.phase)! < target).map((st) => st.id)
    this.acc = 0
    this.tickN = this.index.startTick[phase]
    this.signal = 0
    // Timed failures that are on start again at the new moment (their times are absolute
    // world times, so after a jump back they would otherwise lie in the future).
    const times = { ...this.s.times }
    if (this.s.failures.geoLost) times.geoLostS = this.worldS
    if (this.s.failures.clockJump) Object.assign(times, this.clockJumpNow())
    this.set({ stop: null, fired, done: false, times })
    this.enter(phase)
  }

  /** Back to the gate: clears the journey position, the stops and the timed failures. Settings stay. */
  reset() {
    this.acc = 0
    this.tickN = 0
    this.signal = 0
    const failures = { ...this.s.failures, clockJump: false, geoLost: false }
    this.s = { ...initialJourney({ guidedStops: this.s.guidedStops, running: this.s.running }), speedMode: this.s.speedMode, failures }
    this.cache = null
    this.listeners.forEach((l) => l())
  }

  private enter(phase: PhaseId) {
    this.signal = 0
    const patch: Partial<JourneyState> = { phase }
    const stop = stopOnEntry(phase)
    if (stop && this.s.guidedStops && !this.s.fired.includes(stop)) {
      patch.stop = stop
      patch.fired = [...this.s.fired, stop]
    }
    this.set(patch)
  }

  private fire(stop: StopId): boolean {
    if (!this.s.guidedStops || this.s.fired.includes(stop)) return false
    this.set({ stop, fired: [...this.s.fired, stop] })
    return true
  }

  /**
   * Advance by a real frame time. Returns the number of world ticks taken (0 while
   * paused, at a stop, or in slow motion).
   */
  advance(realDtS: number): number {
    if (!(realDtS > 0) || !this.s.running || this.s.stop || this.s.done) return 0
    const dt = Math.min(realDtS, MAX_FRAME_S)
    const def = phaseDef(this.s.phase)
    if (def.frozen) {
      this.signal = Math.min(def.signalS, this.signal + dt)
      if (this.signal >= def.signalS) {
        if (def.id === 'broadcast' && this.fire('firstCorrection')) return 0
        const next = nextPhase(def.id)
        if (next) this.enter(next)
      }
      return 0
    }
    this.acc += dt * this.speed
    let taken = 0
    while (this.acc >= TICK_S - 1e-9) {
      this.acc -= TICK_S
      const tick = this.tickN + 1
      if (tick > this.index.endTick) {
        this.acc = 0
        this.set({ done: true, running: false })
        break
      }
      this.tickN = tick
      taken++
      // The signal-chain moments start when the climb reaches their tick.
      if (this.s.phase === 'climb' && tick >= this.index.startTick.errors) {
        this.acc = 0
        this.enter('errors')
        break
      }
      const world = worldPhaseAt(this.index, tick)
      if (world !== this.s.phase && !(this.s.phase === 'climb' && world === 'cruise')) {
        // A new phase starts on its own first tick, at its own time-lapse.
        this.acc = 0
        this.enter(world)
        break
      }
      if (this.s.phase === 'landing' && tick >= this.index.touchdownTick && this.fire('touchdown')) {
        this.acc = 0
        break
      }
    }
    return taken
  }
}
