import { describe, expect, it } from 'vitest'
import { isFiniteNumber, positiveStep } from '@/core/guard'

describe('positiveStep', () => {
  it('passes a finite positive step through', () => {
    expect(positiveStep(0.1, 'dt')).toBe(0.1)
  })
  it('throws for a step that would loop forever, naming the parameter', () => {
    for (const bad of [0, -1, Number.NaN, Infinity]) expect(() => positiveStep(bad, 'TICK_S')).toThrow(/TICK_S/)
  })
})

describe('isFiniteNumber', () => {
  it('accepts only finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true)
    expect(isFiniteNumber(-3.5)).toBe(true)
    for (const v of [Number.NaN, Infinity, -Infinity, '1', null, undefined]) expect(isFiniteNumber(v)).toBe(false)
  })
})
