import { describe, expect, it } from 'vitest'
import { OPERATIONS, operationFor, withinLimits } from '@/core/operations'

describe('alert limits and time to alert (Doc 9849 Table 2-1)', () => {
  it('match the table', () => {
    expect(OPERATIONS.oceanic).toMatchObject({ halM: 7408, valM: null, ttaS: 300 })
    expect(OPERATIONS.enroute).toMatchObject({ halM: 3704, valM: null, ttaS: 300 })
    expect(OPERATIONS.terminal).toMatchObject({ halM: 1852, valM: null, ttaS: 15 })
    expect(OPERATIONS.npa.halM).toBeCloseTo(556, 0)
    expect(OPERATIONS.npa.ttaS).toBe(10)
    expect(OPERATIONS.apv1).toMatchObject({ halM: 40, valM: 50, ttaS: 10 })
    expect(OPERATIONS.apv2).toMatchObject({ halM: 40, valM: 20, ttaS: 6 })
    expect(OPERATIONS.cat1).toMatchObject({ halM: 40, valM: 35, ttaS: 6 })
  })
  it('each part of the flight has the right operation', () => {
    expect(operationFor('enroute')!.id).toBe('enroute')
    expect(operationFor('terminal')!.id).toBe('terminal')
    expect(operationFor('approach')!.id).toBe('npa')
    expect(operationFor('final')!.id).toBe('apv1')
    expect(operationFor('final', 'cat1')!.id).toBe('cat1')
    expect(operationFor('ground')).toBeNull()
  })
  it('VPL > VAL makes a vertical operation unavailable; a missing VPL too', () => {
    expect(withinLimits(OPERATIONS.apv1, 12, 30)).toBe(true)
    expect(withinLimits(OPERATIONS.apv1, 12, 51)).toBe(false)
    expect(withinLimits(OPERATIONS.apv1, 41, 30)).toBe(false)
    expect(withinLimits(OPERATIONS.apv1, 12, null)).toBe(false)
    expect(withinLimits(OPERATIONS.npa, 100, null)).toBe(true)
    expect(withinLimits(OPERATIONS.npa, Number.NaN, null)).toBe(false)
  })
})
