import { describe, expect, it } from 'vitest'
import {
  DEPARTURE,
  DESTINATION,
  dipEquatorLatDeg,
  localNmToRunway,
  localSolarHour,
  MASTER,
  nearestAirport,
  REGION,
  RIMS_STATIONS,
  runwayToLocalNm,
  START_LOCAL_HOUR,
  STATIONS,
  zoneTime,
} from '@/core/region'
import { geodeticToEcef, localToGeodetic, lookAngles } from '@/core/geo'
import { GEO_SATS, satEcef } from '@/core/orbits'
import { IGP_BOX } from '@/core/iono'
import { ROUTE, initialAircraft, stepFlight } from '@/core/flight'
import { M_PER_NM } from '@/core/units'

describe('the Jakarta–Bali scenario', () => {
  it('places the runway thresholds at their real positions', () => {
    for (const a of [DEPARTURE, DESTINATION]) {
      const g = localToGeodetic(REGION, a.thresholdEastNm, a.thresholdNorthNm, 0)
      expect(g.latDeg).toBeCloseTo(a.threshold.latDeg, 9)
      expect(g.lonDeg).toBeCloseTo(a.threshold.lonDeg, 9)
    }
    expect(DEPARTURE.id).toBe('WIII')
    expect(DESTINATION.id).toBe('WADD')
    expect(DESTINATION.runway).toBe('09')
  })
  it('the thresholds are about 530 NM apart, and the flown route is not much longer', () => {
    const direct = Math.hypot(DESTINATION.thresholdEastNm - DEPARTURE.thresholdEastNm, DESTINATION.thresholdNorthNm - DEPARTURE.thresholdNorthNm)
    expect(direct).toBeGreaterThan(505)
    expect(direct).toBeLessThan(555)
    let route = 0
    for (let i = 1; i < ROUTE.length; i++) route += Math.hypot(ROUTE[i].eastNm - ROUTE[i - 1].eastNm, ROUTE[i].northNm - ROUTE[i - 1].northNm)
    expect(route).toBeLessThan(direct * 1.1)
  })
  it('the runway frame round-trips and follows the runway course', () => {
    for (const a of [DEPARTURE, DESTINATION]) {
      const [e, n] = runwayToLocalNm(a, 1000, -250)
      const [aM, rM] = localNmToRunway(a, e, n)
      expect(aM).toBeCloseTo(1000, 6)
      expect(rM).toBeCloseTo(-250, 6)
      // One NM along the runway moves along its true course.
      const [e1, n1] = runwayToLocalNm(a, M_PER_NM, 0)
      const course = (Math.atan2(e1 - a.thresholdEastNm, n1 - a.thresholdNorthNm) * 180) / Math.PI
      expect(course).toBeCloseTo(a.runwayCourseDeg, 6)
    }
  })
  it('picks the nearer airport', () => {
    expect(nearestAirport(DEPARTURE.thresholdEastNm + 3, DEPARTURE.thresholdNorthNm).id).toBe('WIII')
    expect(nearestAirport(DESTINATION.thresholdEastNm - 3, DESTINATION.thresholdNorthNm).id).toBe('WADD')
  })
  it('lands on runway 09 at Bali', () => {
    let s = initialAircraft()
    let touchdown: [number, number] | null = null
    for (let t = 0; t < 9000 && !s.parked; t += 0.1) {
      const was = s.onGround
      s = stepFlight(s, 0.1)
      if (!was && s.onGround) touchdown = localNmToRunway(DESTINATION, s.eastNm, s.northNm)
    }
    expect(touchdown).not.toBeNull()
    const [aM, rM] = touchdown!
    expect(aM).toBeGreaterThan(150)
    expect(aM).toBeLessThan(900)
    expect(Math.abs(rM)).toBeLessThan(5)
  })
})

describe('the hypothetical Indonesian SBAS ground segment', () => {
  it('has 16 RIMS across the archipelago, two master control centres and one uplink per GEO', () => {
    expect(RIMS_STATIONS).toHaveLength(16)
    for (const s of RIMS_STATIONS) {
      expect(s.pos.latDeg).toBeGreaterThan(-11)
      expect(s.pos.latDeg).toBeLessThan(6)
      expect(s.pos.lonDeg).toBeGreaterThan(95)
      expect(s.pos.lonDeg).toBeLessThan(141)
    }
    expect(STATIONS.filter((s) => s.kind === 'mcc').map((s) => s.role).sort()).toEqual(['backup', 'primary'])
    expect(MASTER.role).toBe('primary')
    const gus = STATIONS.filter((s) => s.kind === 'gus')
    expect(gus.map((s) => s.geoId).sort()).toEqual(GEO_SATS.map((g) => g.id).sort())
  })
  it('uses the real Michibiki GEOs: QZS-3 (PRN 137, 127°E) and QZS-6 (PRN 129, 90.5°E)', () => {
    expect(GEO_SATS.map((g) => [g.id, g.prn, g.lonDeg])).toEqual([
      ['QZS-3', 137, 127],
      ['QZS-6', 129, 90.5],
    ])
  })
  it('both GEOs stand more than 30° up from every site', () => {
    for (const s of STATIONS)
      for (const g of GEO_SATS) {
        const look = lookAngles(s.pos, satEcef(g, 0))!
        expect(look.elDeg, `${g.id} from ${s.name}`).toBeGreaterThan(30)
      }
  })
  it('the ionospheric grid covers the whole route', () => {
    for (const w of ROUTE) {
      const g = localToGeodetic(REGION, w.eastNm, w.northNm, 0)
      expect(g.latDeg).toBeGreaterThan(IGP_BOX.lat0 + 5)
      expect(g.latDeg).toBeLessThan(IGP_BOX.lat1 - 5)
      expect(g.lonDeg).toBeGreaterThan(IGP_BOX.lon0 + 5)
      expect(g.lonDeg).toBeLessThan(IGP_BOX.lon1 - 5)
    }
    expect(geodeticToEcef(MASTER.pos).every(Number.isFinite)).toBe(true)
  })
})

describe('time and the magnetic equator', () => {
  it('departs at 08:00 WIB and arrives on WITA time in Bali', () => {
    const dep = zoneTime(0, DEPARTURE.threshold.lonDeg)
    expect(dep.zone).toBe('WIB')
    expect(dep.hour).toBeCloseTo(8, 9)
    const arr = zoneTime(6000, DESTINATION.threshold.lonDeg)
    expect(arr.zone).toBe('WITA')
    expect(arr.hour).toBeCloseTo(8 + 1 + 6000 / 3600, 9)
    expect(zoneTime(0, 140).zone).toBe('WIT')
  })
  it('local solar time at the frame origin is the start hour', () => {
    expect(localSolarHour(0, REGION.origin.lonDeg)).toBeCloseTo(START_LOCAL_HOUR, 9)
  })
  it('the magnetic equator runs north of Indonesia, so Java lies near the southern dense band', () => {
    for (let lon = 95; lon <= 141; lon += 2) {
      const lat = dipEquatorLatDeg(lon)
      expect(lat).toBeGreaterThan(5)
      expect(lat).toBeLessThan(12)
    }
    const javaMag = DEPARTURE.threshold.latDeg - dipEquatorLatDeg(DEPARTURE.threshold.lonDeg)
    expect(javaMag).toBeLessThan(-12)
    expect(javaMag).toBeGreaterThan(-19)
    expect(dipEquatorLatDeg(-180)).toBeCloseTo(dipEquatorLatDeg(180), 9)
    expect(Number.isFinite(dipEquatorLatDeg(359))).toBe(true)
  })
})
