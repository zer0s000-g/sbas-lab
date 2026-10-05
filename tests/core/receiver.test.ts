import { describe, expect, it } from 'vitest'
import { CHI2_THRESHOLD, dMajor, K_H_PA, K_V_PA, PBIAS, solveFix, type Measurement } from '@/core/receiver'
import type { Vec3 } from '@/core/geo'

const DEG = Math.PI / 180
const los = (azDeg: number, elDeg: number): Vec3 => [Math.sin(azDeg * DEG) * Math.cos(elDeg * DEG), Math.cos(azDeg * DEG) * Math.cos(elDeg * DEG), Math.sin(elDeg * DEG)]
/** A good spread of satellites. */
const SKY: [number, number][] = [[0, 80], [0, 30], [90, 25], [180, 35], [270, 20], [45, 55], [225, 50], [135, 15]]
const meas = (errors: number[], sigma = 1): Measurement[] => SKY.map(([az, el], i) => ({ satId: `G${i}`, los: los(az, el), elDeg: el, errorM: errors[i] ?? 0, sigmaM: sigma }))

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, |error| < 1.5e-7). */
function phi(x: number): number {
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

describe('RAIM/FDE factors', () => {
  it('the thresholds give a false-alarm probability of about 1e-5 (one degree of freedom: 2·Φ(−√T))', () => {
    expect(2 * phi(-Math.sqrt(CHI2_THRESHOLD[1]))).toBeCloseTo(1e-5, 6)
  })
  it('√λ gives a missed-detection probability of 1e-3 at the threshold (one degree of freedom, closed form)', () => {
    const t = Math.sqrt(CHI2_THRESHOLD[1])
    const pmd = phi(t - PBIAS[1]) - phi(-t - PBIAS[1])
    expect(pmd).toBeGreaterThan(0.9e-3)
    expect(pmd).toBeLessThan(1.1e-3)
  })
  it('√λ grows with the degrees of freedom, from 7.51 to 8.92', () => {
    expect(PBIAS.slice(1)).toEqual([7.51, 7.81, 8.02, 8.2, 8.35, 8.49, 8.61, 8.72, 8.83, 8.92])
    for (let k = 2; k < PBIAS.length; k++) expect(PBIAS[k]).toBeGreaterThan(PBIAS[k - 1])
  })
  it('the GPS-alone HPL is the largest slope times √λ: with 8 satellites (4 degrees of freedom) it scales with PBIAS[4]', () => {
    const f = solveFix('abas', meas([]))!
    const saved = PBIAS[4]
    ;(PBIAS as number[])[4] = 2 * saved
    const g = solveFix('abas', meas([]))!
    ;(PBIAS as number[])[4] = saved
    expect(g.hplM).toBeCloseTo(2 * f.hplM, 9)
  })
})

describe('position solution', () => {
  it('no range errors give no position error', () => {
    const f = solveFix('l1sbas', meas([]))!
    expect(f.horizontalErrorM).toBeCloseTo(0, 9)
    expect(f.verticalErrorM).toBeCloseTo(0, 9)
  })
  it('an error common to every satellite goes into the receiver clock, not the position (why four satellites)', () => {
    const f = solveFix('l1sbas', meas(SKY.map(() => 25)))!
    expect(f.horizontalErrorM).toBeCloseTo(0, 6)
    expect(f.verticalErrorM).toBeCloseTo(0, 6)
  })
  it('fewer than four satellites give no fix', () => {
    expect(solveFix('l1sbas', meas([]).slice(0, 3))).toBeNull()
  })
  it('protection levels follow the weighted covariance: HPL = K_H·d_major, VPL = K_V·d_V', () => {
    const f1 = solveFix('dfmc', meas([], 1), { pa: true })!
    const f2 = solveFix('dfmc', meas([], 2), { pa: true })!
    expect(f2.hplM).toBeCloseTo(2 * f1.hplM, 6)
    expect(f2.vplM!).toBeCloseTo(2 * f1.vplM!, 6)
    expect(f1.hplM / K_H_PA).toBeGreaterThan(0)
    expect(f1.vplM! / K_V_PA).toBeGreaterThan(0)
    expect(dMajor([[4, 0], [0, 1]])).toBeCloseTo(2, 9)
  })
  it('DOP: HDOP and VDOP are positive and PDOP combines them', () => {
    const f = solveFix('abas', meas([]))!
    expect(f.hdop).toBeGreaterThan(0.3)
    expect(f.pdop).toBeCloseTo(Math.hypot(f.hdop, f.vdop), 9)
  })
  it('GPS alone (ABAS) gives no vertical protection level (Doc 9849 §1.4.2.2)', () => {
    expect(solveFix('abas', meas([]))!.vplM).toBeNull()
  })
  it('RAIM/FDE excludes one bad satellite and the error returns to normal', () => {
    const errs = SKY.map((_, i) => (i === 3 ? 80 : 0.3 * Math.sin(i)))
    const f = solveFix('abas', meas(errs, 1.5))!
    expect(f.excluded).toEqual(['G3'])
    expect(f.horizontalErrorM).toBeLessThan(2)
  })
  it('non-finite measurements are dropped instead of poisoning the solution', () => {
    const m = meas([])
    m[0] = { ...m[0], errorM: Number.NaN }
    m[1] = { ...m[1], sigmaM: Infinity }
    const f = solveFix('l1sbas', m)!
    expect(f.used).toHaveLength(SKY.length - 2)
    expect(Number.isFinite(f.hplM)).toBe(true)
  })
})
