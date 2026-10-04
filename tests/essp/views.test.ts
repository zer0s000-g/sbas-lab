/**
 * The ESSP-SAS scenario's world: the airports at Toulouse and Nice, the terrain of
 * southern France, and the coastline and map data behind them.
 */
import { describe, expect, test } from 'vitest'
import { initialAircraft, stepFlight, glidePathAltFt } from '@/core/flight'
import { DEPARTURE, DESTINATION, localOf, runwayToLocalNm } from '@/core/region'
import { M_PER_FT, M_PER_NM } from '@/core/units'
import { AIRPORTS, DEPARTURE_LAYOUT, DESTINATION_LAYOUT, airportToLocalNm, localNmToAirport, nearestLayout, onPavement, type AirportLayout } from '@/views/airports'
import { AIRFIELDS, airfieldFlat, coastNm, PEAKS, terrainFtAt } from '@/views/terrain'
import { decodeRings, type CoastData } from '@/views/geo/coast'
import { europe } from '@/views/geo/europe.data'
import { southFrance } from '@/views/geo/southFrance.data'
import { CORRIDOR } from '@/views/world/terrainData'
import { NETWORK_HONESTY } from '@/views/scales'

const fieldOf = (l: AirportLayout) => AIRFIELDS.find((f) => f.airport.id === l.airport.id)!
const local = (l: AirportLayout, a: number, r: number) => airportToLocalNm(l.airport, a, r)
const at = (lat: number, lon: number) => {
  const l = localOf(lat, lon)
  return terrainFtAt(l.eastNm, l.northNm)
}

describe('coastline data for Europe (Natural Earth)', () => {
  test.each([
    ['southFrance', southFrance],
    ['europe', europe],
  ] as [string, CoastData][])('%s: rings decode inside their box', (_name, d) => {
    const rings = decodeRings(d)
    expect(rings.length).toBeGreaterThan(2)
    for (const r of rings)
      for (let i = 0; i < r.length; i += 2) {
        expect(r[i]).toBeGreaterThanOrEqual(d.box.lon0 - 1e-9)
        expect(r[i]).toBeLessThanOrEqual(d.box.lon1 + 1e-9)
        expect(r[i + 1]).toBeGreaterThanOrEqual(d.box.lat0 - 1e-9)
        expect(r[i + 1]).toBeLessThanOrEqual(d.box.lat1 + 1e-9)
      }
  })
})

describe('terrain of southern France', () => {
  test('Toulouse and Nice are land; the Gulf of Lion and the Baie des Anges are sea', () => {
    expect(at(43.6, 1.44)).toBeGreaterThan(300)
    expect(at(43.7, 7.27)).toBeGreaterThan(0)
    expect(at(43.0, 4.0)).toBeLessThan(-100)
    expect(at(43.6, 7.2)).toBeLessThan(0)
  })
  test('both runway thresholds are levelled to their field elevation', () => {
    for (const a of [DEPARTURE, DESTINATION]) expect(terrainFtAt(a.thresholdEastNm, a.thresholdNorthNm)).toBeCloseTo(a.elevationFt, 6)
  })
  test('the summits stand at about their heights', () => {
    const ventoux = PEAKS.find((p) => p.name === 'Mont Ventoux')!
    expect(ventoux.heightFt * M_PER_FT).toBeCloseTo(1909, 0)
    expect(at(44.17, 5.28) * M_PER_FT).toBeGreaterThan(1500)
    for (const p of PEAKS) expect(terrainFtAt(p.eastNm, p.northNm)).toBeLessThanOrEqual(p.heightFt + 1000)
  })
  test('the final approach to runway 04L starts over the sea and stays well below the glide path', () => {
    const [e, n] = runwayToLocalNm(DESTINATION, -3 * M_PER_NM, 0)
    expect(coastNm(e, n)).toBeLessThan(0)
    for (let d = 0.5; d <= 10; d += 0.25) {
      const [pe, pn] = runwayToLocalNm(DESTINATION, -d * M_PER_NM, 0)
      expect(terrainFtAt(pe, pn), `${d} NM`).toBeLessThan(glidePathAltFt(d) - 250)
    }
  })
  test('the corridor covers both airports and is finite everywhere', () => {
    for (const a of [DEPARTURE, DESTINATION]) {
      expect(a.thresholdEastNm).toBeGreaterThan(CORRIDOR.e0 + 12)
      expect(a.thresholdEastNm).toBeLessThan(CORRIDOR.e1 - 12)
      expect(a.thresholdNorthNm).toBeGreaterThan(CORRIDOR.n0 + 12)
      expect(a.thresholdNorthNm).toBeLessThan(CORRIDOR.n1 - 12)
    }
    for (let e = CORRIDOR.e0; e <= CORRIDOR.e1; e += 7.3) for (let n = CORRIDOR.n0; n <= CORRIDOR.n1; n += 6.1) expect(Number.isFinite(terrainFtAt(e, n))).toBe(true)
  })
})

describe('the airports at Toulouse and Nice', () => {
  test('LAB201 rolls on pavement from the gate to lift-off and from touchdown to the gate', () => {
    let s = initialAircraft()
    let off = 0
    let samples = 0
    for (let i = 0; i < 40_000 && !s.parked; i++) {
      s = stepFlight(s, 0.25)
      if (!s.onGround) continue
      const l = nearestLayout(s.eastNm, s.northNm)
      samples++
      if (!onPavement(l, localNmToAirport(l.airport, s.eastNm, s.northNm), 2)) off++
    }
    expect(s.parked).toBe(true)
    expect(samples).toBeGreaterThan(200)
    expect(off).toBe(0)
  })
  test('everything stands on the levelled airfield, above the sea; pavement and buildings at field elevation', () => {
    for (const l of AIRPORTS) {
      const f = fieldOf(l)
      const elev = l.airport.elevationFt
      const pts: [number, number][] = [
        ...l.lamps.filter((p) => p.kind !== 'approach').map((p): [number, number] => [p.a, p.r]),
        ...l.stands.map((p): [number, number] => [p.a, p.r]),
        ...[l.runway, ...l.extraRunways, ...l.aprons, ...l.landside, ...l.buildings].flatMap((b): [number, number][] => [
          [b.a0, b.r0],
          [b.a1, b.r1],
          [b.a0, b.r1],
          [b.a1, b.r0],
        ]),
        ...l.taxiways.flat(),
      ]
      for (const [a, r] of pts) {
        const [e, n] = local(l, a, r)
        expect(airfieldFlat(f, e, n), `${l.airport.id} a=${a.toFixed(0)} r=${r.toFixed(0)}`).toBeLessThan(1)
        expect(Math.abs(terrainFtAt(e, n) - elev), `${l.airport.id} a=${a.toFixed(0)} r=${r.toFixed(0)}`).toBeLessThan(0.5)
      }
    }
  })
  test('buildings and parked aircraft keep clear of every runway strip', () => {
    for (const l of AIRPORTS) {
      const centres = [0, ...l.extraRunways.map((q) => (q.r0 + q.r1) / 2)]
      for (const rc of centres) {
        for (const b of l.buildings) expect(Math.min(Math.abs(b.r0 - rc), Math.abs(b.r1 - rc))).toBeGreaterThan(150)
        for (const s of l.stands) expect(Math.abs(s.r - rc)).toBeGreaterThan(150)
      }
    }
  })
  test('runway designators: 14L/32R and 14R/32L at Toulouse; 04L/22R and 04R/22L at Nice', () => {
    expect(DEPARTURE_LAYOUT.designators.map((d) => d.text).sort()).toEqual(['14L', '14R', '32L', '32R'])
    expect(DESTINATION_LAYOUT.designators.map((d) => d.text).sort()).toEqual(['04L', '04R', '22L', '22R'])
  })
  test('the parallel runways lie on the side away from the terminals (14R west of 14L; 04R seaward of 04L)', () => {
    for (const l of AIRPORTS) {
      expect(l.extraRunways).toHaveLength(1)
      const rc = (l.extraRunways[0].r0 + l.extraRunways[0].r1) / 2
      expect(rc).toBeGreaterThan(300)
      for (const s of l.stands) expect(s.r).toBeLessThan(0)
    }
  })
  test('Nice runway 04L has approach lights and a PAPI around the 3° glide path; Toulouse has none', () => {
    expect(DESTINATION_LAYOUT.papi).toHaveLength(4)
    const p = DESTINATION_LAYOUT.papi
    expect((p[1].settingDeg + p[2].settingDeg) / 2).toBeCloseTo(3, 6)
    expect(DEPARTURE_LAYOUT.papi).toHaveLength(0)
  })
})

describe('honesty', () => {
  test('the network map says what it shows', () => {
    expect(NETWORK_HONESTY).toMatch(/Europe/)
    expect(NETWORK_HONESTY).toMatch(/not all/)
    expect(NETWORK_HONESTY).toMatch(/illustrative/)
  })
})
