import { describe, expect, it } from 'vitest'
import { crc32q, deviations, fasCrc, fasValid, makeFasDataBlock, type FasDataBlock } from '@/core/approach'
import { DESTINATION } from '@/core/region'
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
    const d = deviations(b, DESTINATION.thresholdEastNm - 3, DESTINATION.thresholdNorthNm, glidePathAltFt(3))!
    expect(Math.abs(d.lateralFs)).toBeLessThan(1e-6)
    expect(Math.abs(d.verticalFs)).toBeLessThan(1e-3)
    expect(d.alongTrackM).toBeCloseTo(3 * 1852, 0)
  })
  it('right of course and high give positive deviations; full scale clamps at 1', () => {
    const d = deviations(b, DESTINATION.thresholdEastNm - 3, DESTINATION.thresholdNorthNm - 0.02, glidePathAltFt(3) + 100)!
    expect(d.crossTrackM).toBeGreaterThan(0)
    expect(d.aboveGlidePathM).toBeGreaterThan(25)
    const far = deviations(b, DESTINATION.thresholdEastNm - 3, DESTINATION.thresholdNorthNm - 1, glidePathAltFt(3) + 3000)!
    expect(far.lateralFs).toBe(1)
    expect(far.verticalFs).toBe(1)
  })
  it('bad input gives no answer', () => {
    expect(deviations(b, Number.NaN, 0, 1000)).toBeNull()
  })
})
