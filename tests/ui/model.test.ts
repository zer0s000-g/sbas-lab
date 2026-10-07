import { describe as suite, expect, it } from 'vitest'
import { JourneyEngine } from '@/journey/engine'
import { PHASES } from '@/journey/phases'
import { describe, viewModel } from '@/page/model'

const engine = new JourneyEngine({ guidedStops: false })

suite('the page view model', () => {
  it('has a finite number or "no answer" everywhere, in every phase', () => {
    for (const p of PHASES) {
      engine.jumpTo(p.id)
      const m = viewModel(engine)
      for (const v of [m.altFt, m.gsKt, m.distToGoNm, m.localHour, m.worldS]) expect(Number.isFinite(v), p.id).toBe(true)
      for (const f of [m.nav, m.abas, m.sbas]) if (f) expect(Number.isFinite(f.hdop)).toBe(true)
      expect(describe(m, 'flight')).not.toMatch(/NaN|undefined|Infinity/)
    }
  })
  it('flies GPS alone until the first correction, then SBAS', () => {
    engine.jumpTo('climb')
    expect(viewModel(engine).navSource).toBe('abas')
    engine.jumpTo('cruise')
    expect(viewModel(engine).navSource).toBe('sbas')
  })
  it('annunciates LPV armed on the descent and LPV on final; the operation follows Doc 9849 Table 2-1', () => {
    engine.jumpTo('descent')
    const d = viewModel(engine)
    expect(d.modeText).toBe('LPV armed')
    // From the top of descent the en route limits apply, not the approach ones (SDD Table 7).
    expect(d.op?.id).toBe('enroute')
    expect(d.detail?.kind).toBe('fas')
    engine.jumpTo('final')
    const f = viewModel(engine)
    expect(f.mode).toBe('LPV')
    expect(f.op?.id).toBe('apv1')
    expect(f.withinLimits).toBe(true)
  })
  it('on the descent the limits go en route, terminal on the arrival, then the approach row from the IF', () => {
    const e = new JourneyEngine({ guidedStops: false, running: true })
    e.jumpTo('descent')
    const seen: string[] = []
    while (e.state.phase === 'descent') {
      const id = viewModel(e).op?.id ?? 'none'
      if (seen.at(-1) !== id) seen.push(id)
      e.advance(1)
    }
    expect(seen).toEqual(['enroute', 'terminal', 'npa'])
  })
  it('on final, LNAV after the loss of both GEOs never comes with "LPV limits met"', () => {
    const e = new JourneyEngine({ guidedStops: false, running: true })
    e.jumpTo('final')
    const t0 = e.worldS
    e.setFailure('geoLost', true)
    while (e.worldS - t0 < 14) e.advance(0.05)
    const m = viewModel(e)
    expect(m.mode).toBe('LNAV')
    expect(m.withinLimits).toBe(false)
    expect(m.nav?.vplM).toBeNull()
  })
  it('"on the ground" follows the aircraft, not its altitude: airborne over the threshold it is flying', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('landing')
    expect(e.aircraft.onGround).toBe(false)
    const m = viewModel(e)
    expect(m.onGround).toBe(false)
    expect(describe(m, 'flight')).not.toMatch(/on the ground/)
  })
  it('the errors phase breaks one range into its parts, the ionosphere among them', () => {
    engine.jumpTo('errors')
    const d = viewModel(engine).detail
    expect(d?.kind).toBe('errors')
    if (d?.kind === 'errors') expect(d.parts.map((p) => p.name)).toContain('Ionosphere')
  })
  it('the text alternative says where LAB201 is, what it uses and the limits', () => {
    engine.jumpTo('final')
    const t = describe(viewModel(engine), 'flight')
    expect(t).toMatch(/LAB201/)
    expect(t).toMatch(/HPL/)
    expect(t).toMatch(/LPV/)
  })
})
