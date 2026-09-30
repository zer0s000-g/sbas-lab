import { describe, expect, it } from 'vitest'
import { JourneyEngine, STOPS } from '@/journey/engine'
import { journeyIndex, PHASES, phaseDef, TICK_S, worldPhaseAt, type PhaseId } from '@/journey/phases'
import { DIRECTION, directionFor } from '@/journey/director'
import { conditionsFor, FAILURES, NO_FAILURES, NO_TIMES } from '@/journey/failures'
import { NARRATION } from '@/journey/narration'
import { DEFAULT_SPEEDS } from '@/core/clock'

const index = journeyIndex()
const WORLD = PHASES.filter((p) => !p.frozen).map((p) => p.id)

/** Play a fresh engine (fast, no stops) until a phase starts. */
function playTo(phase: PhaseId) {
  const e = new JourneyEngine({ guidedStops: false })
  e.setSpeed(60)
  let guard = 0
  while (e.state.phase !== phase && guard++ < 100_000) e.advance(0.1)
  return e
}

describe('journey index', () => {
  it('phases start in order and the flight lands in the landing phase', () => {
    const starts = WORLD.map((p) => index.startTick[p])
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1])
    expect(index.touchdownTick).toBeGreaterThan(index.startTick.landing)
    expect(index.endTick).toBeGreaterThan(index.touchdownTick)
    expect(worldPhaseAt(index, index.startTick.final)).toBe('final')
  })
  it('the slow-motion phases all sit at one world tick in the climb', () => {
    const t = index.startTick.errors
    for (const p of ['reference', 'master', 'uplink', 'broadcast', 'cruise'] as const) expect(index.startTick[p]).toBe(t)
    expect(index.states[t].altFt).toBeGreaterThanOrEqual(10_000)
  })
})

describe('jumping and playing', () => {
  it('jumping to phase N gives exactly the state that playing to phase N reaches', () => {
    for (const p of PHASES.map((x) => x.id)) {
      const played = playTo(p)
      const jumped = new JourneyEngine({ guidedStops: false })
      jumped.setSpeed(60)
      jumped.jumpTo(p)
      expect(jumped.tick, p).toBe(played.tick)
      expect(jumped.aircraft).toEqual(played.aircraft)
      expect(jumped.state.phase).toBe(played.state.phase)
      expect(jumped.snapshot().sbasFix?.hplM).toBe(played.snapshot().sbasFix?.hplM)
    }
  })
  it('the whole journey plays gate to gate and ends', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.setSpeed(60)
    let guard = 0
    while (!e.state.done && guard++ < 100_000) e.advance(0.1)
    expect(e.state.done).toBe(true)
    expect(e.aircraft.parked).toBe(true)
    expect(e.progress).toBeCloseTo(1, 2)
  })
})

describe('guided stops', () => {
  it('each of the four stops fires once, in order, and pauses the journey', () => {
    const e = new JourneyEngine({ guidedStops: true })
    e.setSpeed(60)
    const seen: string[] = []
    let guard = 0
    while (!e.state.done && guard++ < 200_000) {
      if (e.state.stop) {
        seen.push(e.state.stop)
        const tick = e.tick
        const sig = e.signalS
        e.advance(0.1)
        expect(e.tick).toBe(tick)
        expect(e.signalS).toBe(sig)
        e.continueFromStop()
      }
      e.advance(0.1)
    }
    expect(seen).toEqual(STOPS.map((s) => s.id))
  })
  it('stops stay quiet when switched off, and a jump back re-arms them', () => {
    const off = new JourneyEngine({ guidedStops: false })
    off.jumpTo('final')
    expect(off.state.stop).toBeNull()
    const e = new JourneyEngine({ guidedStops: true })
    e.jumpTo('final')
    expect(e.state.stop).toBe('lpvEngaged')
    e.continueFromStop()
    e.jumpTo('takeoff')
    expect(e.state.stop).toBe('firstFix')
    expect(e.state.fired).not.toContain('lpvEngaged')
  })
})

describe('slow motion', () => {
  it('freezes the world: the aircraft does not move while a signal plays', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('errors')
    const tick = e.tick
    const a = e.aircraft
    for (let i = 0; i < 50; i++) expect(e.advance(0.1)).toBe(0)
    expect(e.tick).toBe(tick)
    expect(e.aircraft).toEqual(a)
    expect(e.signalS).toBeGreaterThan(4)
    expect(e.frozen).toBe(true)
  })
  it('moves through the signal chain to cruise, and the world starts again', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('errors')
    const order: string[] = [e.state.phase]
    let guard = 0
    while (e.state.phase !== 'cruise' && guard++ < 10_000) {
      e.advance(0.1)
      if (order.at(-1) !== e.state.phase) order.push(e.state.phase)
    }
    expect(order).toEqual(['errors', 'reference', 'master', 'uplink', 'broadcast', 'cruise'])
    const t = e.tick
    e.advance(0.1)
    expect(e.tick).toBeGreaterThan(t)
  })
  it('SBAS appears in the story once the first correction has arrived', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('climb')
    expect(e.sbasShown).toBe(false)
    e.jumpTo('cruise')
    expect(e.sbasShown).toBe(true)
  })
})

describe('reset and settings', () => {
  it('reset clears the journey position, the stops and the timed failures, and keeps the settings', () => {
    const e = new JourneyEngine({ guidedStops: true })
    e.setSpeed(16)
    e.jumpTo('descent')
    e.setFailure('geoLost', true)
    e.setFailure('l1Only', true)
    e.advance(0.1)
    e.reset()
    expect(e.tick).toBe(0)
    expect(e.signalS).toBe(0)
    expect(e.state.phase).toBe('gate')
    expect(e.state.stop).toBeNull()
    expect(e.state.fired).toEqual([])
    expect(e.state.failures.geoLost).toBe(false)
    expect(e.state.times).toEqual(NO_TIMES)
    expect(e.state.failures.l1Only).toBe(true)
    expect(e.state.speedMode).toBe(16)
  })
  it('time-lapse: auto follows the director; a manual speed snaps to an allowed step', () => {
    const e = new JourneyEngine()
    e.jumpTo('cruise')
    expect(e.speed).toBe(DIRECTION.cruise.autoSpeed)
    e.setSpeed(25)
    expect(e.speed).toBe(30)
    e.setSpeed('auto')
    expect(e.speed).toBe(30)
  })
  it('bad frame times are ignored', () => {
    const e = new JourneyEngine({ guidedStops: false })
    for (const dt of [0, -1, Number.NaN]) expect(e.advance(dt)).toBe(0)
    expect(e.tick).toBe(0)
  })
  it('a world tick is 0.1 s and a big frame is clamped', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.setSpeed(1)
    e.jumpTo('takeoff')
    const t = e.tick
    e.advance(5)
    expect(e.tick - t).toBe(1)
    expect(TICK_S).toBe(0.1)
  })
})

describe('failures', () => {
  it('map onto the SBAS world conditions', () => {
    expect(conditionsFor(NO_FAILURES, NO_TIMES).service).toBe('dfmc')
    expect(conditionsFor({ ...NO_FAILURES, l1Only: true }, NO_TIMES).service).toBe('l1')
    expect(conditionsFor({ ...NO_FAILURES, sbasOff: true, l1Only: true }, NO_TIMES).service).toBe('off')
    expect(conditionsFor({ ...NO_FAILURES, storm: true }, NO_TIMES).storm).toBe(1)
    expect(conditionsFor({ ...NO_FAILURES, evening: true }, NO_TIMES).startLocalHour).toBeGreaterThan(19)
    expect(conditionsFor({ ...NO_FAILURES, stationOffline: true }, NO_TIMES).offlineStations.length).toBeGreaterThan(0)
    expect(conditionsFor({ ...NO_FAILURES, jamming: true }, NO_TIMES).jammed).toBe(true)
  })
  it('a clock jump hits a satellite in use, from the moment it is switched on, and the alarm arrives within the time to alert', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('final')
    e.setFailure('clockJump', true)
    const sat = e.state.times.clockJumpSat!
    expect(e.snapshot().dfmc!.used).toContain(sat)
    e.setSpeed(1)
    for (let i = 0; i < 100; i++) e.advance(0.1)
    expect(e.snapshot().alarmedSats).toContain(sat)
    expect(e.snapshot().dfmc!.used).not.toContain(sat)
  })
  it('losing the GEO signal downgrades LPV after the time-out', async () => {
    const { approachMode } = await import('@/core/sbasWorld')
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('final')
    e.setSpeed(1)
    e.setFailure('geoLost', true)
    for (let i = 0; i < 20; i++) e.advance(0.1)
    expect(approachMode(e.snapshot()).mode).toBe('LPV')
    for (let i = 0; i < 150; i++) e.advance(0.1)
    expect(approachMode(e.snapshot()).mode).not.toBe('LPV')
  })
  it('every failure has its explanation, what to notice, what the crew and ATC do, and a source', () => {
    for (const f of FAILURES) for (const k of ['label', 'explain', 'notice', 'crewAtc', 'source'] as const) expect(f[k].length).toBeGreaterThan(3)
  })
})

describe('director and narration', () => {
  it('every phase has a deterministic view, camera, speed and text', () => {
    for (const p of PHASES) {
      const d = directionFor(p.id)
      expect(d).toEqual(directionFor(p.id))
      expect(['space', 'flight', 'network']).toContain(d.view)
      expect(DEFAULT_SPEEDS).toContain(d.autoSpeed)
      if (phaseDef(p.id).frozen) expect(d.autoSpeed).toBe(1)
      expect(NARRATION[p.id].title.length).toBeGreaterThan(3)
      expect(NARRATION[p.id].source).toMatch(/Doc 9849/)
    }
  })
  it('the story uses the three views: space, flight and network', () => {
    expect(new Set(Object.values(DIRECTION).map((d) => d.view))).toEqual(new Set(['space', 'flight', 'network']))
  })
})
