import { describe, expect, it } from 'vitest'
import { crc32q, deviations, fasCrc, fasValid, GARP_BEYOND_FPAP_M, LATERAL_FS_CAP_M, lateralFullScaleM, ltpToGarpM, makeFasDataBlock, type FasDataBlock } from '@/core/approach'
import { DESTINATION, runwayToLocalNm } from '@/core/region'
import { glidePathAltFt } from '@/core/flight'

describe('FAS data block (Doc 9849 §4.3.2.7)', () => {
  it('the CRC detects a change in any field', () => {
    const b = makeFasDataBlock()
    const crc = fasCrc(b)
    expect(fasValid(b, crc)).toBe(true)
    const changes: Partial<FasDataBlock>[] = [{ gpaDeg: 3.1 }, { tchFt: 51 }, { runway: '27' }, { ltpEastNm: b.ltpEastNm + 0.001 }, { valM: 35 }, { courseDeg: 91 }]
    for (const ch of changes) expect(fasValid({ ...b, ...ch }, crc)).toBe(false)
  })
  it('CRC-32Q is deterministic and differs for different data', () => {
    expect(crc32q(new Uint8Array([1, 2, 3]))).toBe(crc32q(new Uint8Array([1, 2, 3])))
    expect(crc32q(new Uint8Array([1, 2, 3]))).not.toBe(crc32q(new Uint8Array([1, 2, 4])))
  })
  it('carries the LPV alert limits of the procedure', () => {
    expect(makeFasDataBlock('apv1')).toMatchObject({ halM: 40, valM: 50 })
    expect(makeFasDataBlock('cat1')).toMatchObject({ halM: 40, valM: 35, performanceDesignator: 1 })
  })
})

describe('approach deviations', () => {
  const b = makeFasDataBlock()
  it('on the centreline and the glide path both deviations are zero', () => {
    const d = deviations(b, ...runwayToLocalNm(DESTINATION, -3 * 1852, 0), glidePathAltFt(3))!
    expect(Math.abs(d.lateralFs)).toBeLessThan(1e-6)
    expect(Math.abs(d.verticalFs)).toBeLessThan(1e-3)
    expect(d.alongTrackM).toBeCloseTo(3 * 1852, 0)
  })
  it('right of course and high give positive deviations; full scale clamps at 1', () => {
    const d = deviations(b, ...runwayToLocalNm(DESTINATION, -3 * 1852, 37), glidePathAltFt(3) + 100)!
    expect(d.crossTrackM).toBeGreaterThan(0)
    expect(d.aboveGlidePathM).toBeGreaterThan(25)
    const far = deviations(b, ...runwayToLocalNm(DESTINATION, -3 * 1852, 1852), glidePathAltFt(3) + 3000)!
    expect(far.lateralFs).toBe(1)
    expect(far.verticalFs).toBe(1)
  })
  it('bad input gives no answer', () => {
    expect(deviations(b, Number.NaN, 0, 1000)).toBeNull()
  })
  it('lateral full scale: the course width at the threshold, widening at a constant angle from the GARP (Annex 10 Att D 7.11.3.1)', () => {
    const garp = ltpToGarpM()
    expect(GARP_BEYOND_FPAP_M).toBe(305)
    expect(garp).toBe(DESTINATION.runwayLengthM + 305)
    expect(lateralFullScaleM(b.courseWidthM, 0)).toBeCloseTo(b.courseWidthM, 9)
    expect(lateralFullScaleM(b.courseWidthM, -500)).toBeCloseTo(b.courseWidthM, 9)
    // The same angle at every distance: full scale over the distance to the GARP.
    const angle = (d: number) => lateralFullScaleM(b.courseWidthM, d) / (d + garp)
    for (const d of [1852, 5 * 1852, 10 * 1852]) expect(angle(d)).toBeCloseTo(angle(0), 12)
    // About 1.5–2° for a 105 m course width and a runway of 2.5–3.5 km.
    const deg = (Math.atan(angle(0)) * 180) / Math.PI
    expect(deg).toBeGreaterThan(1.5)
    expect(deg).toBeLessThan(2.2)
    // The ±1 NM limit (to confirm against DO-229).
    expect(lateralFullScaleM(b.courseWidthM, 200 * 1852)).toBe(LATERAL_FS_CAP_M)
  })
  it('the CDI uses that full scale: one full-scale deflection at 5 NM is the widened course width off the centreline', () => {
    const fs = lateralFullScaleM(b.courseWidthM, 5 * 1852)
    const d = deviations(b, ...runwayToLocalNm(DESTINATION, -5 * 1852, fs / 2), glidePathAltFt(5))!
    expect(d.lateralFs).toBeCloseTo(0.5, 2)
  })
})
