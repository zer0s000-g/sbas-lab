import { describe, expect, test } from 'vitest'
import { CoastIndex, decodeRings, type CoastData } from '@/views/geo/coast'
import { javaBali } from '@/views/geo/javaBali.data'
import { indonesia } from '@/views/geo/indonesia.data'
import { world } from '@/views/geo/world.data'
import { coastNm, PEAKS, terrainFtAt } from '@/views/terrain'
import { DEPARTURE, DESTINATION, localOf } from '@/core/region'
import { M_PER_FT } from '@/core/units'

const at = (lat: number, lon: number) => {
  const l = localOf(lat, lon)
  return terrainFtAt(l.eastNm, l.northNm)
}

describe('coastline data (Natural Earth)', () => {
  test.each([
    ['javaBali', javaBali],
    ['indonesia', indonesia],
    ['world', world],
  ] as [string, CoastData][])('%s: rings decode inside their box', (_name, d) => {
    const rings = decodeRings(d)
    expect(rings.length).toBeGreaterThan(5)
    for (const r of rings) {
      expect(r.length % 2).toBe(0)
      expect(r.length).toBeGreaterThanOrEqual(6)
      for (let i = 0; i < r.length; i += 2) {
        expect(r[i]).toBeGreaterThanOrEqual(d.box.lon0 - 1e-9)
        expect(r[i]).toBeLessThanOrEqual(d.box.lon1 + 1e-9)
        expect(r[i + 1]).toBeGreaterThanOrEqual(d.box.lat0 - 1e-9)
        expect(r[i + 1]).toBeLessThanOrEqual(d.box.lat1 + 1e-9)
      }
    }
  })
  test('the index tells land from sea and measures the distance to the coast', () => {
    // A unit square island.
    const idx = new CoastIndex([new Float64Array([0, 0, 1, 0, 1, 1, 0, 1])], 0.25)
    expect(idx.inside(0.5, 0.5)).toBe(true)
    expect(idx.inside(1.5, 0.5)).toBe(false)
    expect(idx.distance(0.5, 0.5, 5)).toBeCloseTo(0.5, 9)
    expect(idx.signed(1.25, 0.5, 5)).toBeCloseTo(-0.25, 9)
    expect(idx.distance(10, 10, 2)).toBe(2)
  })
})

describe('terrain of Java and Bali', () => {
  test('Jakarta is low land, the Java Sea and the Indian Ocean are sea', () => {
    const jkt = at(-6.2, 106.85)
    expect(jkt).toBeGreaterThan(0)
    expect(jkt).toBeLessThan(400)
    expect(at(-5.5, 108)).toBeLessThan(-100)
    expect(at(-9.2, 110)).toBeLessThan(-100)
  })
  test('the volcanoes stand at about their real heights', () => {
    const agung = PEAKS.find((p) => p.name === 'Agung')!
    expect(at(-8.34, 115.51) * M_PER_FT).toBeGreaterThan(2500)
    expect(at(-8.11, 112.92) * M_PER_FT).toBeGreaterThan(3000)
    expect(agung.heightFt * M_PER_FT).toBeCloseTo(3031, 0)
    for (const p of PEAKS) expect(terrainFtAt(p.eastNm, p.northNm)).toBeLessThanOrEqual(p.heightFt + 1500)
  })
  test('both runway thresholds are levelled to their field elevation', () => {
    for (const a of [DEPARTURE, DESTINATION]) expect(terrainFtAt(a.thresholdEastNm, a.thresholdNorthNm)).toBeCloseTo(a.elevationFt, 6)
  })
  test('the approach to Bali runway 09 is over the sea', () => {
    expect(coastNm(DESTINATION.thresholdEastNm - 3, DESTINATION.thresholdNorthNm)).toBeLessThan(0)
  })
  test('finite everywhere along the corridor', () => {
    for (let e = -300; e <= 300; e += 7.3) for (let n = -120; n <= 126; n += 6.1) expect(Number.isFinite(terrainFtAt(e, n))).toBe(true)
  })
})
