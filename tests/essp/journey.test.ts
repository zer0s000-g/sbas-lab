/**
 * The journey engine and the page view model in the ESSP-SAS scenario: the same
 * deterministic twelve-phase journey (jumping equals playing, the stops, slow motion),
 * and what the panels say in every phase.
 */
import { describe as suite, expect, it } from 'vitest'
import { JourneyEngine, STOPS } from '@/journey/engine'
import { journeyIndex, PHASES, type PhaseId } from '@/journey/phases'
import { NARRATION } from '@/journey/narration'
import { FAILURES } from '@/journey/failures'
import { describe, viewModel } from '@/page/model'
import { SCENARIO } from '@/scenarios/active'

const index = journeyIndex()

function playTo(phase: PhaseId) {
  const e = new JourneyEngine({ guidedStops: false })
  e.setSpeed(60)
  let guard = 0
  while (e.state.phase !== phase && guard++ < 100_000) e.advance(0.1)
  return e
}

suite('the ESSP-SAS journey', () => {
  it('phases start in order; the signal chain plays in slow motion above 10 000 ft', () => {
    const world = PHASES.filter((p) => !p.frozen).map((p) => index.startTick[p.id])
    for (let i = 1; i < world.length; i++) expect(world[i]).toBeGreaterThan(world[i - 1])
    expect(index.states[index.startTick.errors].altFt).toBeGreaterThanOrEqual(10_000)
    expect(index.touchdownTick).toBeGreaterThan(index.startTick.landing)
  })
  it('jumping to phase N gives exactly the state that playing to phase N reaches', () => {
    for (const p of PHASES.map((x) => x.id)) {
      const played = playTo(p)
      const jumped = new JourneyEngine({ guidedStops: false })
      jumped.setSpeed(60)
      jumped.jumpTo(p)
      expect(jumped.tick, p).toBe(played.tick)
      expect(jumped.aircraft).toEqual(played.aircraft)
      expect(jumped.snapshot().sbasFix?.hplM).toBe(played.snapshot().sbasFix?.hplM)
    }
  })
  it('plays gate to gate with the four guided stops, once each, in order', () => {
    const e = new JourneyEngine({ guidedStops: true })
    e.setSpeed(60)
    const seen: string[] = []
    let guard = 0
    while (!e.state.done && guard++ < 200_000) {
      if (e.state.stop) {
        seen.push(e.state.stop)
        e.continueFromStop()
      }
      e.advance(0.1)
    }
    expect(seen).toEqual(STOPS.map((s) => s.id))
    expect(e.aircraft.parked).toBe(true)
  })
})

const INDONESIAN = /Jakarta|Bali|Java|Indonesia|Michibiki|QZS|WIB|WITA|Makassar/

suite('what the page says in the ESSP-SAS scenario', () => {
  const engine = new JourneyEngine({ guidedStops: false })
  it('finite numbers and clean text in every phase, about Toulouse, Nice and EGNOS, never Indonesia', () => {
    for (const p of PHASES) {
      engine.jumpTo(p.id)
      const m = viewModel(engine)
      for (const v of [m.altFt, m.gsKt, m.distToGoNm, m.localHour, m.worldS]) expect(Number.isFinite(v), p.id).toBe(true)
      expect(m.localZone).toBe('CET')
      for (const view of ['space', 'flight', 'network'] as const) {
        const text = describe(m, view)
        expect(text).not.toMatch(/NaN|undefined|Infinity/)
        expect(text).not.toMatch(INDONESIAN)
      }
      const n = NARRATION[p.id]
      // The one cross-reference allowed: the final points to the other scenario for the equatorial contrast.
      expect(`${n.title} ${n.now} ${n.benefit}`.replace('the AirNav Indonesia scenario', '')).not.toMatch(INDONESIAN)
      expect(n.claims?.length, p.id).toBeGreaterThan(0)
    }
    expect(describe(viewModel(engine), 'space')).toMatch(/EGNOS/)
  })
  it('flies GPS alone until the first correction, then EGNOS; LPV armed on the descent, LPV-200 on final', () => {
    engine.jumpTo('climb')
    expect(viewModel(engine).navSource).toBe('abas')
    engine.jumpTo('cruise')
    const c = viewModel(engine)
    expect(c.navSource).toBe('sbas')
    expect(c.service).toBe('l1')
    expect(c.signal).toBe('L1')
    engine.jumpTo('descent')
    const d = viewModel(engine)
    expect(d.modeText).toBe('LPV armed')
    expect(d.detail?.kind).toBe('fas')
    engine.jumpTo('final')
    const f = viewModel(engine)
    expect(f.mode).toBe('LPV')
    expect(f.op?.id).toBe('cat1')
    expect(f.withinLimits).toBe(true)
    expect(f.geosTracked).toBe(2)
  })
  it('the message log names the EGNOS GEOs and L1 message types', () => {
    engine.jumpTo('cruise')
    const log = viewModel(engine).log
    expect(log.length).toBeGreaterThan(0)
    for (const r of log) expect(['SES-5', 'E5WB']).toContain(r.geo)
  })
  it('every text the scenario shows is free of the Indonesian story', () => {
    const t = SCENARIO.texts
    const all = [t.flightNote, t.statusNote, t.benefitGate, t.benefitLanding, t.benefitCompareNote, t.footer, t.networkHonesty, t.describeSpace, t.describeNetwork, ...Object.values(t.stops).flatMap((s) => [s.title, s.body]), ...FAILURES.flatMap((f) => [f.label, f.explain, f.notice, f.crewAtc])]
    for (const s of all) expect(s).not.toMatch(INDONESIAN)
    expect(t.footer).toMatch(/not published or endorsed by ESSP or EUSPA/)
  })
  it('a failure switched on in the engine shows on the panels: the storm takes LPV away on final', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('final')
    e.setFailure('storm', true)
    expect(viewModel(e).mode).toBe('LNAV')
    e.setFailure('dfmcPreview', true)
    const m = viewModel(e)
    expect(m.mode).toBe('LPV')
    expect(m.service).toBe('dfmc')
  })
})
