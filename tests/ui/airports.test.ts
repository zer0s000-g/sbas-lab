import { describe, expect, test } from 'vitest'
import { initialAircraft, stepFlight } from '@/core/flight'
import { AIRPORTS, BALI, JAKARTA, airportToLocalNm, localNmToAirport, nearestLayout, onPavement, reciprocal, type AirportLayout } from '@/views/airports'
import { AIRFIELDS, airfieldFlat, terrainFtAt } from '@/views/terrain'

const fieldOf = (l: AirportLayout) => AIRFIELDS.find((f) => f.airport.id === l.airport.id)!
const local = (l: AirportLayout, a: number, r: number) => airportToLocalNm(l.airport, a, r)

describe('airport layouts', () => {
  test('runway frame round-trips', () => {
    for (const l of AIRPORTS) {
      const [e, n] = local(l, 1234, -321)
      const [a, r] = localNmToAirport(l.airport, e, n)
      expect(a).toBeCloseTo(1234, 6)
      expect(r).toBeCloseTo(-321, 6)
    }
  })

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

  test('everything stands on the levelled airfield, above the sea (approach lights may stand on their pier)', () => {
    for (const l of AIRPORTS) {
      const f = fieldOf(l)
      const pts: [number, number][] = [
        ...l.lamps.filter((p) => p.kind !== 'approach').map((p): [number, number] => [p.a, p.r]),
        ...l.stands.map((p): [number, number] => [p.a, p.r]),
        ...l.buildings.flatMap((b): [number, number][] => [
          [b.a0, b.r0],
          [b.a1, b.r1],
        ]),
        ...l.aprons.flatMap((b): [number, number][] => [
          [b.a0, b.r0],
          [b.a1, b.r1],
        ]),
      ]
      for (const [a, r] of pts) {
        const [e, n] = local(l, a, r)
        expect(airfieldFlat(f, e, n)).toBeLessThan(1)
        expect(terrainFtAt(e, n)).toBeGreaterThan(0)
      }
    }
  })

  test('the pavement, the buildings and the parked aircraft stand exactly at field elevation', () => {
    for (const l of AIRPORTS) {
      const elev = l.airport.elevationFt
      const pts: [number, number][] = [
        [l.runway.a0, l.runway.r0],
        [l.runway.a1, l.runway.r1],
        [l.runway.a0, l.runway.r1],
        [l.runway.a1, l.runway.r0],
        ...l.extraRunways.flatMap((q): [number, number][] => [
          [q.a0, q.r0],
          [q.a1, q.r1],
        ]),
        ...l.taxiways.flat(),
        ...[...l.aprons, ...l.landside, ...l.buildings].flatMap((b): [number, number][] => [
          [b.a0, b.r0],
          [b.a1, b.r1],
          [b.a0, b.r1],
          [b.a1, b.r0],
        ]),
        ...l.stands.map((p): [number, number] => [p.a, p.r]),
      ]
      for (const [a, r] of pts) {
        const [e, n] = local(l, a, r)
        expect(Math.abs(terrainFtAt(e, n) - elev), `${l.airport.id} a=${a.toFixed(0)} r=${r.toFixed(0)}`).toBeLessThan(0.5)
      }
      // Approach lights are never buried: the ground under them is at or below the field.
      for (const p of l.lamps.filter((q) => q.kind === 'approach')) {
        const [e, n] = local(l, p.a, p.r)
        expect(terrainFtAt(e, n)).toBeLessThan(elev + 0.5)
      }
    }
  })

  test('buildings and parked aircraft keep clear of the runway strip', () => {
    for (const l of AIRPORTS) {
      const centres = [0, ...l.extraRunways.map((q) => (q.r0 + q.r1) / 2)]
      for (const rc of centres) {
        for (const b of l.buildings) expect(Math.min(Math.abs(b.r0 - rc), Math.abs(b.r1 - rc))).toBeGreaterThan(150)
        for (const s of l.stands) expect(Math.abs(s.r - rc)).toBeGreaterThan(150)
      }
    }
  })

  test('the PAPI at Bali runway 09: four units, highest setting nearest the runway, around the approach slope', () => {
    const p = BALI.papi
    expect(p).toHaveLength(4)
    for (let i = 1; i < 4; i++) {
      expect(Math.abs(p[i].r)).toBeGreaterThan(Math.abs(p[i - 1].r))
      expect(p[i].settingDeg).toBeLessThan(p[i - 1].settingDeg)
    }
    expect((p[1].settingDeg + p[2].settingDeg) / 2).toBeCloseTo(3, 6)
    expect(JAKARTA.papi).toHaveLength(0)
  })

  test('designators: 09 and 27 at Bali; 07R, 25L, 07L and 25R at Jakarta', () => {
    expect(BALI.designators.map((d) => d.text).sort()).toEqual(['09', '27'])
    expect(JAKARTA.designators.map((d) => d.text).sort()).toEqual(['07L', '07R', '25L', '25R'])
    expect(reciprocal('07R')).toBe('25L')
    expect(reciprocal('18')).toBe('36')
    expect(reciprocal('36')).toBe('18')
  })

  test('Jakarta has its parallel runway 2.4 km left of 07R, with the terminal between them', () => {
    expect(JAKARTA.extraRunways).toHaveLength(1)
    const rc = (JAKARTA.extraRunways[0].r0 + JAKARTA.extraRunways[0].r1) / 2
    expect(rc).toBeCloseTo(-2400, 6)
    for (const s of JAKARTA.stands) expect(s.r).toBeLessThan(0)
    for (const s of JAKARTA.stands) expect(s.r).toBeGreaterThan(rc)
  })
})
