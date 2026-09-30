import { describe, expect, it } from 'vitest'
import { dot, ecefToEnu, ecefToGeodetic, enuBasis, geodeticToEcef, geodeticToLocal, localToGeodetic, lookAngles, norm, type Vec3 } from '@/core/geo'
import { REGION } from '@/core/region'
import { WGS84_A_M } from '@/core/units'

describe('geodetic, ECEF and local frames', () => {
  it('geodetic → ECEF → geodetic round-trips to below a millimetre', () => {
    for (const p of [
      { latDeg: -2, lonDeg: 91, hM: 5000 },
      { latDeg: 45, lonDeg: -120, hM: 0 },
      { latDeg: -89, lonDeg: 10, hM: 100 },
    ]) {
      const back = ecefToGeodetic(geodeticToEcef(p))!
      expect(back.latDeg).toBeCloseTo(p.latDeg, 9)
      expect(back.lonDeg).toBeCloseTo(p.lonDeg, 9)
      expect(back.hM).toBeCloseTo(p.hM, 3)
    }
  })
  it('the equator at 0° longitude sits at the equatorial radius on the x axis', () => {
    const [x, y, z] = geodeticToEcef({ latDeg: 0, lonDeg: 0, hM: 0 })
    expect(x).toBeCloseTo(WGS84_A_M, 3)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })
  it('the east/north/up basis is orthonormal and right-handed', () => {
    const { e, n, u } = enuBasis(-2, 91)
    for (const v of [e, n, u]) expect(norm(v)).toBeCloseTo(1, 12)
    expect(dot(e, n)).toBeCloseTo(0, 12)
    expect(dot(n, u)).toBeCloseTo(0, 12)
    const cross: Vec3 = [e[1] * n[2] - e[2] * n[1], e[2] * n[0] - e[0] * n[2], e[0] * n[1] - e[1] * n[0]]
    expect(dot(cross, u)).toBeCloseTo(1, 12)
  })
  it('a satellite straight overhead is at 90° elevation; one due north is at azimuth 0°', () => {
    const rx = { latDeg: -2, lonDeg: 91, hM: 0 }
    const above = geodeticToEcef({ ...rx, hM: 20_200e3 })
    expect(lookAngles(rx, above)!.elDeg).toBeCloseTo(90, 6)
    const north = geodeticToEcef({ latDeg: 10, lonDeg: 91, hM: 20_200e3 })
    const look = lookAngles(rx, north)!
    expect(look.azDeg).toBeCloseTo(0, 3)
    expect(look.elDeg).toBeGreaterThan(0)
    expect(norm(look.los)).toBeCloseTo(1, 12)
    expect(ecefToEnu([0, 0, 0], rx)).toEqual([0, 0, 0])
  })
  it('the local NM frame round-trips', () => {
    const g = localToGeodetic(REGION, 44, 14, 900)
    const l = geodeticToLocal(REGION, g)
    expect(l.eastNm).toBeCloseTo(44, 9)
    expect(l.northNm).toBeCloseTo(14, 9)
  })
  it('bad input gives no answer instead of NaN', () => {
    expect(ecefToGeodetic([Number.NaN, 0, 0])).toBeNull()
    expect(ecefToGeodetic([0, 0, 0])).toBeNull()
    expect(lookAngles({ latDeg: Number.NaN, lonDeg: 0, hM: 0 }, [1e7, 0, 0])).toBeNull()
    expect(lookAngles({ latDeg: 0, lonDeg: 0, hM: 0 }, [Infinity, 0, 0])).toBeNull()
  })
})
