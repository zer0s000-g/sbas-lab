/**
 * The service-provision view in the ESSP-SAS scenario: LPV availability predicted at
 * Nice over the next hours, and the NOTAMs proposed when it is not.
 */
import { describe, expect, it } from 'vitest'
import { forecastAt, notamProposals } from '@/core/service'
import { DESTINATION, START_UTC_HOUR } from '@/core/region'
import { NOMINAL } from '@/core/sbasWorld'
import { OFFLINE_SET } from '@/journey/failures'

const H = 3600

describe('LPV availability at Nice', () => {
  it('nominal EGNOS: APV-I and LPV-200 available nearly all the time, and no NOTAM', () => {
    for (const op of ['apv1', 'cat1'] as const) {
      const f = forecastAt(DESTINATION, op, 0, 3 * H, 300, NOMINAL)
      expect(f.samples).toHaveLength(37)
      expect(f.availability, op).toBeGreaterThan(0.95)
      for (const x of f.samples) if (x.available) expect(x.vplM!).toBeLessThanOrEqual(op === 'cat1' ? 35 : 50)
    }
    expect(notamProposals(forecastAt(DESTINATION, 'apv1', 0, 3 * H, 300, NOMINAL), DESTINATION, 'RNP RWY 04L', 'EGNOS', START_UTC_HOUR)).toEqual([])
  })
  it('a severe storm: unavailable for the whole period, and one proposed NOTAM covering it', () => {
    const f = forecastAt(DESTINATION, 'apv1', 0, 2 * H, 300, { ...NOMINAL, storm: 1 })
    expect(f.availability).toBe(0)
    expect(f.outages).toEqual([{ fromS: 0, toS: 2 * H + 300 }])
    const p = notamProposals(f, DESTINATION, 'RNP RWY 04L', 'EGNOS', START_UTC_HOUR)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ a: 'LFMN', b: '0700', c: '0905' })
    expect(p[0].e).toMatch(/EGNOS APV-I SERVICE PREDICTED NOT AVBL/)
  })
  it('both GEOs lost at 01:00 into the journey: available before, not after the time-out', () => {
    const f = forecastAt(DESTINATION, 'apv1', 0, 2 * H, 300, { ...NOMINAL, geoLostFromS: H })
    expect(f.samples.filter((x) => x.tS < H).every((x) => x.available)).toBe(true)
    expect(f.samples.filter((x) => x.tS >= H + 60).every((x) => !x.available)).toBe(true)
    expect(f.outages[0].fromS).toBeGreaterThanOrEqual(H)
  })
  it('RIMS offline: the model loses LPV at Nice (its 9 RIMS only; the page says the real network would fare better)', () => {
    expect(forecastAt(DESTINATION, 'apv1', 0, H, 600, { ...NOMINAL, offlineStations: OFFLINE_SET }).availability).toBe(0)
  })
})
