import { describe, expect, it } from 'vitest'
import { gaussian, hash2, mulberry32, valueNoise } from '@/core/random'

describe('seeded randomness', () => {
  it('the same seed gives the same sequence; another seed a different one', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const sa = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(sa)
    expect(Array.from({ length: 5 }, c)).not.toEqual(sa)
  })
  it('uniform values stay in [0, 1)', () => {
    const r = mulberry32(1)
    for (let i = 0; i < 10000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('gaussian samples have mean ≈ 0 and standard deviation ≈ 1, and are never NaN', () => {
    const r = mulberry32(7)
    const n = 20000
    let sum = 0
    let sq = 0
    for (let i = 0; i < n; i++) {
      const g = gaussian(r)
      expect(Number.isFinite(g)).toBe(true)
      sum += g
      sq += g * g
    }
    expect(sum / n).toBeCloseTo(0, 1)
    expect(Math.sqrt(sq / n - (sum / n) ** 2)).toBeCloseTo(1, 1)
  })
  it('gaussian survives a generator that returns 0', () => {
    let i = 0
    const r = () => (i++ < 3 ? 0 : 0.5)
    expect(Number.isFinite(gaussian(r))).toBe(true)
  })
  it('hash and value noise are deterministic and bounded', () => {
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1))
    for (let x = 0; x < 5; x += 0.37)
      for (let y = 0; y < 5; y += 0.41) {
        const v = valueNoise(x, y, 2)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
  })
})
