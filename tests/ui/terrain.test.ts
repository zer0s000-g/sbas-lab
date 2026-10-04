import { describe, expect, test } from 'vitest'
import { CoastIndex, decodeRings, type CoastData } from '@/views/geo/coast'
import { javaBali } from '@/views/geo/javaBali.data'
import { indonesia } from '@/views/geo/indonesia.data'
import { world } from '@/views/geo/world.data'
import { AIRFIELDS, SEA_MAP_HIGH_FT, SEA_MAP_LOW_FT, airfieldFlat, anyAirfieldFlat, coastNm, PEAKS, seaHeightMap, terrainFtAt, terrainFtClamped, terrainGridFt } from '@/views/terrain'
import { hash2 } from '@/core/random'
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

describe('fast terrain sampling gives the same ground', () => {
  // Points along the route, around both airfields and along their coasts.
  const pts: [number, number][] = []
  for (let k = 0; k < 4000; k++) pts.push([-300 + hash2(k, 1, 11) * 600, -120 + hash2(k, 2, 11) * 246])
  for (const a of [DEPARTURE, DESTINATION])
    for (let k = 0; k < 3000; k++) pts.push([a.thresholdEastNm + (hash2(k, 3, 12) - 0.5) * 12, a.thresholdNorthNm + (hash2(k, 4, 12) - 0.5) * 12])

  test('the levelled-airfield value matches the per-airfield one', () => {
    for (const [e, n] of pts) expect(anyAirfieldFlat(e, n)).toBe(Math.min(...AIRFIELDS.map((f) => airfieldFlat(f, e, n))))
  })
  test.each([
    [SEA_MAP_LOW_FT, SEA_MAP_HIGH_FT],
    [-150, Infinity],
    [-Infinity, Infinity],
    [-2000, 5],
    [10, 3000],
  ])('clamped to [%d, %d] ft: exactly the clamped terrain', (lo, hi) => {
    for (const [e, n] of pts) expect(terrainFtClamped(e, n, lo, hi)).toBe(Math.min(hi, Math.max(lo, terrainFtAt(e, n))))
  })
  test('grid heights, block by block, match the terrain at every vertex', () => {
    for (const r of [
      { e0: -40, e1: 20, n0: -20, n1: 30 },
      { e0: DESTINATION.thresholdEastNm - 6, e1: DESTINATION.thresholdEastNm + 6, n0: DESTINATION.thresholdNorthNm - 6, n1: DESTINATION.thresholdNorthNm + 6 },
    ]) {
      const nx = 70
      const ny = 55
      const g = terrainGridFt(r, nx, ny, -150)
      for (let i = 0; i <= nx; i++)
        for (let j = 0; j <= ny; j++) {
          const e = r.e0 + ((r.e1 - r.e0) * i) / nx
          const n = r.n0 + ((r.n1 - r.n0) * j) / ny
          expect(g[i * (ny + 1) + j]).toBe(Math.max(-150, terrainFtAt(e, n)))
        }
    }
  })
  test('the sea height map matches the terrain pixel by pixel', () => {
    for (const [r, W] of [
      [{ e0: -300, e1: 300, n0: -120, n1: 126 }, 300],
      [{ e0: DEPARTURE.thresholdEastNm - 6, e1: DEPARTURE.thresholdEastNm + 6, n0: DEPARTURE.thresholdNorthNm - 6, n1: DEPARTURE.thresholdNorthNm + 6 }, 160],
      [{ e0: DESTINATION.thresholdEastNm - 6, e1: DESTINATION.thresholdEastNm + 6, n0: DESTINATION.thresholdNorthNm - 6, n1: DESTINATION.thresholdNorthNm + 6 }, 160],
    ] as const) {
      const m = seaHeightMap(r, W)
      let mid = 0
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++) {
          const e = r.e0 + ((x + 0.5) / m.width) * (r.e1 - r.e0)
          const n = r.n0 + ((y + 0.5) / m.height) * (r.n1 - r.n0)
          const want = Math.round(Math.min(1, Math.max(0, (terrainFtAt(e, n) - SEA_MAP_LOW_FT) / (SEA_MAP_HIGH_FT - SEA_MAP_LOW_FT))) * 255)
          expect(m.data[y * m.width + x]).toBe(want)
          if (want > 0 && want < 255) mid++
        }
      // Each map has a shoreline in it.
      expect(mid).toBeGreaterThan(10)
    }
  })
})
