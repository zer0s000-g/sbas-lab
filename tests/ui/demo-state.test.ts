import { beforeEach, describe, expect, it } from 'vitest'
import { demo, DEMO_ALT_FT, resetDemo, stepDemo } from '@/preview/demoState'

beforeEach(() => resetDemo())

describe('kit preview demo world', () => {
  it('slow motion freezes the world but not the signal clock', () => {
    stepDemo(1, 1)
    const t = demo.timeS
    demo.frozen = true
    stepDemo(1, 1)
    expect(demo.timeS).toBe(t)
    expect(demo.realS).toBe(2)
  })
  it('never produces NaN, whatever the frame time', () => {
    for (const dt of [Number.NaN, -1, Infinity, 0.1]) stepDemo(dt, dt)
    expect(Number.isFinite(demo.hplM) && Number.isFinite(demo.vplM) && Number.isFinite(demo.realS)).toBe(true)
  })
  it('the protection levels stay inside the LPV alert limits and the aircraft is on a 3° path', () => {
    for (let i = 0; i < 2000; i++) {
      stepDemo(0.5, 0.5)
      expect(demo.hplM).toBeLessThan(40)
      expect(demo.vplM).toBeLessThan(50)
    }
    expect(DEMO_ALT_FT).toBe(687)
  })
})
