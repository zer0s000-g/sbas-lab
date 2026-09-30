import { describe, expect, it } from 'vitest'
import { GEO_ALTITUDE_M, GEO_SATS, GPS_PERIOD_S, GPS_RADIUS_M, GPS_SATS, satEcef } from '@/core/orbits'
import { norm } from '@/core/geo'

describe('GPS constellation (Doc 9849 §3.2.2)', () => {
  it('has 24 satellites in six planes of four', () => {
    expect(GPS_SATS).toHaveLength(24)
    expect(new Set(GPS_SATS.map((s) => s.plane)).size).toBe(6)
    expect(new Set(GPS_SATS.map((s) => s.id)).size).toBe(24)
  })
  it('orbits at about 20 200 km altitude in about 12 hours', () => {
    for (const s of GPS_SATS) expect(norm(satEcef(s, 1234))).toBeCloseTo(GPS_RADIUS_M, 0)
    expect(GPS_PERIOD_S / 3600).toBeGreaterThan(11.9)
    expect(GPS_PERIOD_S / 3600).toBeLessThan(12.05)
  })
  it('never goes further from the equator than the 55° inclination allows', () => {
    const maxZ = GPS_RADIUS_M * Math.sin((55 * Math.PI) / 180)
    for (const s of GPS_SATS) for (let t = 0; t < GPS_PERIOD_S; t += 600) expect(Math.abs(satEcef(s, t)[2])).toBeLessThanOrEqual(maxZ + 1)
  })
})

describe('SBAS GEOs (Doc 9849 §4.3.1.2)', () => {
  it('stay fixed over the equator at their longitude', () => {
    for (const g of GEO_SATS) {
      const a = satEcef(g, 0)
      const b = satEcef(g, 5 * 3600)
      expect(a).toEqual(b)
      expect(a[2]).toBe(0)
    }
  })
  it('sit at the geostationary altitude, about 35 786 km', () => {
    expect(GEO_ALTITUDE_M / 1000).toBeCloseTo(35786, -1)
  })
})
