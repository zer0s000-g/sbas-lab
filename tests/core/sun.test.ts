import { describe, expect, test } from 'vitest'
import { daylight, sunElevationDeg, sunEnu } from '@/core/sun'

describe('sun', () => {
  test('overhead at local noon on the equator', () => {
    const [e, n, u] = sunEnu(12, 0)
    expect(u).toBeCloseTo(1, 9)
    expect(Math.abs(e)).toBeLessThan(1e-9)
    expect(Math.abs(n)).toBeLessThan(1e-9)
  })

  test('rises in the east and sets in the west', () => {
    const [e6, , u6] = sunEnu(6, 0)
    expect(e6).toBeCloseTo(1, 9)
    expect(u6).toBeCloseTo(0, 9)
    expect(sunEnu(18, 0)[0]).toBeCloseTo(-1, 9)
  })

  test('mid-morning at the region: about 60° up, in the east', () => {
    const el = sunElevationDeg(10, -2)
    expect(el).toBeGreaterThan(59)
    expect(el).toBeLessThan(61)
    expect(sunEnu(10, -2)[0]).toBeGreaterThan(0.45)
  })

  test('south of the equator the sun stands a little to the north', () => {
    expect(sunEnu(10, -2)[1]).toBeGreaterThan(0)
  })

  test('below the horizon at night, and a unit vector at any hour', () => {
    expect(sunElevationDeg(0, -2)).toBeLessThan(-80)
    for (let h = -6; h <= 30; h += 0.7) {
      const v = sunEnu(h, -2)
      expect(Math.hypot(...v)).toBeCloseTo(1, 9)
      expect(v.every(Number.isFinite)).toBe(true)
    }
  })

  test('daylight: dark after civil twilight, full by 12° up, monotonic', () => {
    expect(daylight(-6)).toBe(0)
    expect(daylight(-30)).toBe(0)
    expect(daylight(12)).toBe(1)
    expect(daylight(60)).toBe(1)
    let last = -1
    for (let el = -10; el <= 15; el += 0.5) {
      const d = daylight(el)
      expect(d).toBeGreaterThanOrEqual(last)
      last = d
    }
  })
})
