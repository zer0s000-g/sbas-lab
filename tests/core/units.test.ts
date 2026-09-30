import { describe, expect, it } from 'vitest'
import {
  C_M_S,
  clamp,
  degToRad,
  FT_PER_NM,
  ftToM,
  GPS_L1_HZ,
  GPS_L5_HZ,
  ktToMs,
  lerp,
  mToFt,
  mToNm,
  msToKt,
  nmToM,
  radToDeg,
  WGS84_A_M,
  WGS84_B_M,
  WGS84_E2,
  wrap180,
  wrap360,
} from '@/core/units'

describe('constants', () => {
  it('match their definitions', () => {
    expect(C_M_S).toBe(299792458)
    expect(WGS84_A_M).toBe(6378137)
    // WGS-84 b and e² as published in NIMA TR8350.2.
    expect(WGS84_B_M).toBeCloseTo(6356752.3142, 3)
    expect(WGS84_E2).toBeCloseTo(6.69437999014e-3, 12)
    expect(GPS_L1_HZ).toBe(1575.42e6)
    expect(GPS_L5_HZ).toBe(1176.45e6)
  })
  it('the L1 wavelength is about 19 cm', () => {
    expect(C_M_S / GPS_L1_HZ).toBeCloseTo(0.1903, 4)
  })
})

describe('conversions at the edges', () => {
  it('round-trip without drift', () => {
    expect(mToNm(nmToM(12.5))).toBeCloseTo(12.5, 12)
    expect(mToFt(ftToM(3000))).toBeCloseTo(3000, 9)
    expect(msToKt(ktToMs(140))).toBeCloseTo(140, 12)
  })
  it('use the exact international definitions', () => {
    expect(nmToM(1)).toBe(1852)
    expect(ftToM(1)).toBeCloseTo(0.3048, 12)
    expect(FT_PER_NM).toBeCloseTo(6076.115, 3)
    expect(ktToMs(1)).toBeCloseTo(0.514444, 6)
  })
  it('angles', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12)
    expect(wrap360(-10)).toBe(350)
    expect(wrap360(720)).toBe(0)
    expect(wrap180(190)).toBe(-170)
    expect(wrap180(180)).toBe(180)
    expect(wrap180(-180)).toBe(180)
  })
  it('clamp keeps NaN visible instead of turning it into a limit', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(Number.isNaN(clamp(Number.NaN, 0, 3))).toBe(true)
    expect(lerp(10, 20, 0.25)).toBe(12.5)
  })
})
