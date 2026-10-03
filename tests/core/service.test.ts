import { describe, expect, it } from 'vitest'
import { forecastAt, notamProposals, outagesOf, utcClock, type AvailabilitySample } from '@/core/service'
import { DESTINATION } from '@/core/region'
import { NOMINAL } from '@/core/sbasWorld'

const s = (tS: number, available: boolean): AvailabilitySample => ({ tS, available, hplM: null, vplM: null })

describe('service provision helpers', () => {
  it('groups unavailable samples into outages, including one still running at the end', () => {
    const samples = [s(0, true), s(60, false), s(120, false), s(180, true), s(240, false)]
    expect(outagesOf(samples, 60)).toEqual([
      { fromS: 60, toS: 180 },
      { fromS: 240, toS: 300 },
    ])
    expect(outagesOf([s(0, true), s(60, true)], 60)).toEqual([])
  })
  it('writes UTC clock times as hhmm, wrapping at midnight', () => {
    expect(utcClock(0, 7)).toBe('0700')
    expect(utcClock(3600 + 25 * 60, 7)).toBe('0825')
    expect(utcClock(18 * 3600, 7)).toBe('0100')
  })
  it('gives no forecast for bad inputs, never NaN', () => {
    expect(forecastAt(DESTINATION, 'apv1', 0, 600, 0, NOMINAL).samples).toEqual([])
    expect(forecastAt(DESTINATION, 'apv1', 600, 0, 60, NOMINAL).samples).toEqual([])
    expect(forecastAt(DESTINATION, 'apv1', Number.NaN, 600, 60, NOMINAL).availability).toBe(0)
  })
  it('proposes NOTAMs only for APV-I outages', () => {
    const f = { airportId: 'X', op: 'cat1' as const, samples: [], outages: [{ fromS: 0, toS: 60 }], availability: 0 }
    expect(notamProposals(f, DESTINATION, 'RNP RWY 04L', 'EGNOS', 7)).toEqual([])
    const p = notamProposals({ ...f, op: 'apv1' }, DESTINATION, 'RNP RWY 04L', 'EGNOS', 7)
    expect(p).toEqual([{ a: DESTINATION.id, b: '0700', c: '0701', e: 'EGNOS APV-I SERVICE PREDICTED NOT AVBL. RNP RWY 04L LPV MINIMA NOT AVBL.' }])
  })
})
