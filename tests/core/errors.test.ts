import { describe, expect, it } from 'vitest'
import { IF_NOISE_FACTOR, satErrors, sigmaMultipathM, smoothGauss, tropoMapping, tropoModelM } from '@/core/errors'

describe('range error parts', () => {
  it('are a pure function of seed, satellite and time (jumping equals playing)', () => {
    expect(satErrors('G05', 40, 3000, 812.3, 201)).toEqual(satErrors('G05', 40, 3000, 812.3, 201))
    expect(satErrors('G05', 40, 3000, 812.3, 202)).not.toEqual(satErrors('G05', 40, 3000, 812.3, 201))
  })
  it('the smooth random process has about the requested standard deviation', () => {
    let sq = 0
    const n = 4000
    for (let i = 0; i < n; i++) sq += smoothGauss(9, i * 7.3, 5, 2, 1) ** 2
    expect(Math.sqrt(sq / n)).toBeGreaterThan(1.6)
    expect(Math.sqrt(sq / n)).toBeLessThan(2.4)
    expect(smoothGauss(9, Number.NaN, 5, 2, 1)).toBe(0)
  })
  it('a satellite clock jump appears from its start time on that satellite only', () => {
    const fault = { satId: 'G07', startS: 100, jumpM: 30 }
    const before = satErrors('G07', 40, 0, 99, 1, 0, fault).clockM
    const after = satErrors('G07', 40, 0, 101, 1, 0, fault).clockM
    expect(after - before).toBeGreaterThan(25)
    expect(satErrors('G08', 40, 0, 101, 1, 0, fault)).toEqual(satErrors('G08', 40, 0, 101, 1, 0, null))
  })
  it('the troposphere and multipath grow toward the horizon; the troposphere shrinks with height', () => {
    expect(tropoMapping(5)).toBeGreaterThan(tropoMapping(45))
    expect(tropoMapping(90)).toBeCloseTo(1, 2)
    expect(sigmaMultipathM(5)).toBeGreaterThan(sigmaMultipathM(60))
    expect(tropoModelM(30, 10000)).toBeLessThan(tropoModelM(30, 0))
  })
  it('the ionosphere-free combination amplifies noise by about 2.6 (Doc 9849 §5.2.1.6)', () => {
    expect(IF_NOISE_FACTOR).toBeCloseTo(2.59, 2)
  })
})
