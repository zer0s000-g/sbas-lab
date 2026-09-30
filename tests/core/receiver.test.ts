import { describe, expect, it } from 'vitest'
import { dMajor, K_H_PA, K_V_PA, solveFix, type Measurement } from '@/core/receiver'
import type { Vec3 } from '@/core/geo'

const DEG = Math.PI / 180
const los = (azDeg: number, elDeg: number): Vec3 => [Math.sin(azDeg * DEG) * Math.cos(elDeg * DEG), Math.cos(azDeg * DEG) * Math.cos(elDeg * DEG), Math.sin(elDeg * DEG)]
/** A good spread of satellites. */
const SKY: [number, number][] = [[0, 80], [0, 30], [90, 25], [180, 35], [270, 20], [45, 55], [225, 50], [135, 15]]
const meas = (errors: number[], sigma = 1): Measurement[] => SKY.map(([az, el], i) => ({ satId: `G${i}`, los: los(az, el), elDeg: el, errorM: errors[i] ?? 0, sigmaM: sigma }))

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
