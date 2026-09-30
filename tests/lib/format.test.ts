import { describe, expect, it } from 'vitest'
import { fixed, formatClock, formatDuration, formatHeading, formatLength, formatMetres, formatNumber, formatSpeed, NO_VALUE, wholeDegrees } from '@/lib/format'
import { formatMissionTime } from '@/hud/MissionClock'
import { slowMotionFor, slowMotionLabel } from '@/core/clock'

describe('shared formatting', () => {
  it('never shows NaN or Infinity', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(formatLength(v)).toBe(NO_VALUE)
      expect(formatDuration(v)).toBe(NO_VALUE)
      expect(formatClock(v)).toBe(NO_VALUE)
      expect(formatHeading(v)).toBe(NO_VALUE)
      expect(formatNumber(v)).toBe(NO_VALUE)
      expect(formatMetres(v)).toBe(NO_VALUE)
      expect(formatSpeed(v)).toBe(NO_VALUE)
      expect(formatMissionTime(v)).not.toMatch(/NaN|Infinity/)
    }
  })
  it('lengths move to the next unit once rounding reaches it', () => {
    expect(formatLength(3.14)).toBe('3.1 m')
    expect(formatLength(9.96)).toBe('10 m')
    expect(formatLength(999.4)).toBe('999 m')
    expect(formatLength(999.6)).toBe('1.0 km')
    expect(formatLength(9949)).toBe('9.9 km')
    expect(formatLength(9960)).toBe('10 km')
    expect(formatLength(-0.04)).toBe('0.0 m')
  })
  it('GNSS metres keep one decimal below 10 m and stay in metres', () => {
    expect(formatMetres(0.84)).toBe('0.8 m')
    expect(formatMetres(9.94)).toBe('9.9 m')
    expect(formatMetres(9.96)).toBe('10 m')
    expect(formatMetres(1250.2)).toBe('1250 m')
    expect(formatMetres(-0.01)).toBe('0.0 m')
  })
  it('durations and timers round before choosing the unit', () => {
    expect(formatDuration(4.24)).toBe('4.2 s')
    expect(formatDuration(9.96)).toBe('10 s')
    expect(formatDuration(59.6)).toBe('1 min 00 s')
    expect(formatDuration(3599.7)).toBe('1 h 00 min')
    expect(formatDuration(-5)).toBe('0.0 s')
    expect(formatClock(247.9)).toBe('4:07')
    expect(formatClock(-3)).toBe('0:00')
    expect(formatMissionTime(3725.9)).toBe('T+01:02:05')
  })
  it('headings are three digits 000–359', () => {
    expect(formatHeading(359.6)).toBe('000')
    expect(formatHeading(-10)).toBe('350')
    expect(formatHeading(90)).toBe('090')
    expect(wholeDegrees(359.6)).toBe(0)
    expect(wholeDegrees(NaN)).toBe(0)
  })
  it('numbers and speeds', () => {
    expect(fixed(-0.001, 1)).toBe('0.0')
    expect(formatNumber(1.449, 1)).toBe('1.4')
    expect(formatSpeed(16)).toBe('×16')
    expect(formatSpeed(0)).toBe(NO_VALUE)
  })
  it('a slow-motion target of 0 s is not "∞"', () => {
    expect(slowMotionLabel(slowMotionFor(10, 0))).not.toMatch(/∞|Infinity|NaN/)
  })
})
