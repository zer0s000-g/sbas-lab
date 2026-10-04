import { describe, expect, it } from 'vitest'
import { JourneyEngine } from '@/journey/engine'
import { AVAILABILITY_CELLS, AvailabilityGrid } from '@/views/NetworkMap'

/** A clock that moves 1 ms each time it is read, so a budget of n ms allows a few cells. */
const ticking = () => {
  let t = 0
  return () => t++
}

/** Step until a grid is complete; returns how many steps it took. */
function complete(g: AvailabilityGrid, e: JourneyEngine, budgetMs: number, clock?: () => number) {
  const v = g.version
  let steps = 0
  while (g.version === v && steps < 10_000) {
    g.step(e, budgetMs, clock)
    steps++
  }
  return steps
}

describe('LPV availability grid on the network map', () => {
  it('is worked out a few cells per step, keeping the last grid until the new one is complete', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    e.jumpTo('cruise')
    const g = new AvailabilityGrid()
    const steps = complete(g, e, 4, ticking())
    expect(steps).toBeGreaterThan(AVAILABILITY_CELLS.length / 4)
    expect(g.ok).toHaveLength(AVAILABILITY_CELLS.length)
    const first = g.ok
    // Nothing changed: no new work.
    g.step(e, 4, ticking())
    expect(g.ok).toBe(first)
    // A failure starts a new grid; the old one stays until it is done.
    e.setFailure('storm', true)
    g.step(e, 4, ticking())
    expect(g.ok).toBe(first)
    complete(g, e, 4, ticking())
    expect(g.ok).not.toBe(first)
  })

  it('gives the same grid for the same key however the work is split', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    e.jumpTo('final')
    e.setFailure('storm', true)
    const sliced = new AvailabilityGrid()
    complete(sliced, e, 3, ticking())
    const whole = new AvailabilityGrid()
    expect(complete(whole, e, Infinity)).toBe(1)
    expect(sliced.key).toBe(whole.key)
    expect(sliced.ok).toEqual(whole.ok)
  })

  it('keys on every failure time, the clock jump included', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    e.jumpTo('cruise')
    const g = new AvailabilityGrid()
    complete(g, e, Infinity)
    const before = g.key
    e.setFailure('clockJump', true)
    expect(e.state.times.clockJumpS).not.toBeNull()
    complete(g, e, Infinity)
    expect(g.key).not.toBe(before)
    expect(g.key).toContain('clockJumpS')
  })
})
