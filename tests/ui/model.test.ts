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
    expect(d.op?.id).toBe('npa')
    expect(d.detail?.kind).toBe('fas')
    engine.jumpTo('final')
    const f = viewModel(engine)
    expect(f.mode).toBe('LPV')
    expect(f.op?.id).toBe('apv1')
    expect(f.withinLimits).toBe(true)
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
