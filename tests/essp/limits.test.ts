import { describe, expect, it } from 'vitest'
import { JourneyEngine } from '@/journey/engine'
import { describe as describeView, viewModel } from '@/page/model'

describe('the alert limits the page applies over Europe', () => {
  it('on the descent: en route, terminal on the arrival, then the approach row from the IF', () => {
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
  it('on final, LNAV after the loss of both GEOs never comes with "LPV-200 limits met"', () => {
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
  it('parked at the Toulouse gate (490 ft) the page says on the ground, at Toulouse', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('gate')
    const text = describeView(viewModel(e), 'flight')
    expect(text).toMatch(/on the ground/)
    expect(text).toMatch(/at Toulouse/)
  })
})
