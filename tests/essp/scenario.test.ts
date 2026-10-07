/**
 * The ESSP-SAS scenario, checked on a full LAB201 flight from Toulouse to Nice with EGNOS
 * (the aircraft stepped at the journey's 0.1 s tick, the SBAS world sampled every 5 s):
 * the claims the scenario makes on screen, and the integrity properties every scenario
 * must keep.
 */
import { describe, expect, it } from 'vitest'
import { initialAircraft, ROUTE, segmentOf, stepFlight, type AircraftState } from '@/core/flight'
import { localToGeodetic } from '@/core/geo'
import { DEPARTURE, DESTINATION, localNmToRunway, MASTER, REGION, RIMS_STATIONS, STATIONS, START_LOCAL_HOUR, zoneTime } from '@/core/region'
import { approachMode, navStatus, NOMINAL, snapshot, type Conditions } from '@/core/sbasWorld'
import { OPERATIONS, operationFor, type Operation } from '@/core/operations'
import { GEO_SATS } from '@/core/orbits'
import { IGP_BOX } from '@/core/iono'
import { makeFasDataBlock, fasCrc, fasValid, APPROACH_CHANNEL, DECISION_HEIGHT_FT } from '@/core/approach'
import { M_PER_FT } from '@/core/units'
import { alarmBroadcastS } from '@/core/messages'
import { conditionsFor, FAILURES, NO_FAILURES, NO_TIMES, OFFLINE_SET } from '@/journey/failures'
import { ACTIVE_SCENARIO } from '@/scenarios/id'
import { SCENARIO } from '@/scenarios/active'
import { EGNOS_RIMS } from '@/scenarios/essp/rimsNetwork'

interface Sample {
  t: number
  s: AircraftState
}
const TRIP: Sample[] = (() => {
  let s = initialAircraft()
  let t = 0
  const out: Sample[] = []
  let k = 0
  while (!s.parked && t < 9000) {
    s = stepFlight(s, 0.1)
    t = Math.round((t + 0.1) * 10) / 10
    if (++k % 50 === 0) out.push({ t, s })
  }
  return out
})()

const pos = (x: Sample) => localToGeodetic(REGION, x.s.eastNm, x.s.northNm, x.s.altFt * M_PER_FT)
const run = (c: Conditions) => TRIP.map((x) => ({ ...x, snap: snapshot(x.t, pos(x), c) }))
const finals = (r: ReturnType<typeof run>) => r.filter((x) => segmentOf(x.s) === 'final')
const LPV200 = OPERATIONS.cat1

function operationAt(x: Sample): Operation | null {
  const seg = segmentOf(x.s)
  if (seg === 'final') return LPV200
  if (seg !== 'air' && seg !== 'takeoff') return null
  const near = (a: typeof DEPARTURE) => Math.hypot(x.s.eastNm - a.thresholdEastNm, x.s.northNm - a.thresholdNorthNm) < 30
  return near(DEPARTURE) || near(DESTINATION) ? OPERATIONS.terminal : OPERATIONS.enroute
}

const nominal = run(NOMINAL)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('the ESSP-SAS scenario is the one under test', () => {
  it('is selected by SBAS_SCENARIO', () => {
    expect(ACTIVE_SCENARIO).toBe('essp')
    expect(SCENARIO.tab.label).toBe('ESSP-SAS')
  })
})

describe('Toulouse to Nice', () => {
  it('flies from Toulouse-Blagnac runway 14L to Nice Côte d’Azur runway 04L, real positions (OurAirports, AIP France)', () => {
    expect([DEPARTURE.id, DEPARTURE.runway, DESTINATION.id, DESTINATION.runway]).toEqual(['LFBO', '14L', 'LFMN', '04L'])
    for (const a of [DEPARTURE, DESTINATION]) {
      const g = localToGeodetic(REGION, a.thresholdEastNm, a.thresholdNorthNm, 0)
      expect(g.latDeg).toBeCloseTo(a.threshold.latDeg, 9)
      expect(g.lonDeg).toBeCloseTo(a.threshold.lonDeg, 9)
    }
    // OurAirports: LFBO 14L end 43.637402 N 1.357620 E; LFMN 04L end 43.651798 N 7.204040 E, threshold displaced 305 ft.
    expect(DEPARTURE.threshold.latDeg).toBeCloseTo(43.6374, 4)
    expect(DEPARTURE.threshold.lonDeg).toBeCloseTo(1.3576, 4)
    const toDisplaced = Math.hypot((DESTINATION.threshold.latDeg - 43.651798) * 111_132, (DESTINATION.threshold.lonDeg - 7.20404) * 111_320 * Math.cos((43.65 * Math.PI) / 180))
    expect(toDisplaced).toBeCloseTo(305 * 0.3048, -1)
    expect(DEPARTURE.runwayCourseDeg).toBeCloseTo(143.1, 1)
    expect(DESTINATION.runwayCourseDeg).toBeCloseTo(45, 0)
  })
  it('the thresholds are about 250 NM apart, and the route is not much longer', () => {
    const direct = Math.hypot(DESTINATION.thresholdEastNm - DEPARTURE.thresholdEastNm, DESTINATION.thresholdNorthNm - DEPARTURE.thresholdNorthNm)
    expect(direct).toBeGreaterThan(240)
    expect(direct).toBeLessThan(265)
    let route = 0
    for (let i = 1; i < ROUTE.length; i++) route += Math.hypot(ROUTE[i].eastNm - ROUTE[i - 1].eastNm, ROUTE[i].northNm - ROUTE[i - 1].northNm)
    expect(route).toBeLessThan(direct * 1.25)
  })
  it('parks at the Nice gate in about an hour, landing on runway 04L in the touchdown zone', () => {
    let s = initialAircraft()
    let t = 0
    let touchdown: [number, number] | null = null
    while (!s.parked && t < 9000) {
      const was = s.onGround
      s = stepFlight(s, 0.1)
      t += 0.1
      if (!was && s.onGround) touchdown = localNmToRunway(DESTINATION, s.eastNm, s.northNm)
    }
    expect(s.parked).toBe(true)
    expect(t / 60).toBeGreaterThan(45)
    expect(t / 60).toBeLessThan(90)
    expect(touchdown).not.toBeNull()
    expect(touchdown![0]).toBeGreaterThan(150)
    expect(touchdown![0]).toBeLessThan(900)
    expect(Math.abs(touchdown![1])).toBeLessThan(5)
  })
  it('departs at 08:00 CET', () => {
    expect(zoneTime(0, DEPARTURE.threshold.lonDeg)).toEqual({ zone: 'CET', hour: 8 })
    expect(START_LOCAL_HOUR).toBeCloseTo(7 + 4.3 / 15, 9)
  })
})

describe('EGNOS as the scenario shows it', () => {
  it('tracks the two Safety-of-Life GEOs: SES-5 (PRN 136, 5°E) and Eutelsat 5 West B (PRN 121, 5°W)', () => {
    expect(GEO_SATS.map((g) => [g.prn, g.lonDeg])).toEqual([
      [136, 5],
      [121, -5],
    ])
    // PRN 123 (ASTRA 5B) is in test mode: a Safety-of-Life receiver does not use it.
    expect(GEO_SATS.some((g) => g.prn === 123)).toBe(false)
  })
  it('shows the two mission control centres, Torrejón and Ciampino, and uplink stations for both GEOs', () => {
    const mcc = STATIONS.filter((s) => s.kind === 'mcc').map((s) => s.name)
    expect(mcc.sort()).toEqual(['Ciampino', 'Torrejón'])
    expect(MASTER.kind).toBe('mcc')
    for (const g of GEO_SATS) expect(STATIONS.some((s) => s.kind === 'gus' && s.geoId === g.id)).toBe(true)
    // The RIMS shown are in the current 38-site network (SoL SDD v3.6 Figure 3): no Alexandria or Kourou, and the
    // Finnish site is Lappeenranta. Codes as the figure labels them (Lisbon LSB, Azores ACR, La Palma LPI).
    expect(RIMS_STATIONS.map((s) => s.code).sort()).toEqual(['ACR', 'ATH', 'KUU', 'LAP', 'LPI', 'LSB', 'MAD', 'PAR', 'TLS'])
    expect(STATIONS.filter((s) => s.kind === 'gus').every((s) => s.code === 'NLES')).toBe(true)
  })
  it('labels every RIMS with its SoL SDD v3.6 Figure 3 code, the same code as the service-area map', () => {
    // EGNOS SoL SDD v3.6 §3.3.2.1, Figure 3 (PDF p. 20): the 38 RIMS sites, transcribed from the figure.
    const sddFigure3 = [
      'LYR', 'JME', 'TRO', 'KIR', 'KUU', 'RKK', 'EGI', 'TRD', 'GVL', 'LAP', 'ALB', 'GLG', 'CRK', 'SWA', 'BRN', 'WRS', 'PAR', 'ZUR', 'SDC',
      'TLS', 'PDM', 'ROM', 'SOF', 'GOL', 'ACR', 'LSB', 'MLG', 'CTN', 'ATH', 'HFA', 'MAD', 'AGA', 'DJA', 'LPI', 'CNR', 'NOU', 'HBK', 'MON',
    ]
    expect(new Set(sddFigure3).size).toBe(38)
    expect(RIMS_STATIONS.map((s) => s.code).filter((c) => !sddFigure3.includes(c))).toEqual([])
    const serviceMapCode = new Map(EGNOS_RIMS.map((r) => [r.name, r.id]))
    const mismatches = RIMS_STATIONS.filter((s) => serviceMapCode.has(s.name) && serviceMapCode.get(s.name) !== s.code).map(
      (s) => `${s.name}: journey ${s.code}, service map ${serviceMapCode.get(s.name)}`,
    )
    expect(mismatches).toEqual([])
    for (const id of OFFLINE_SET) expect(STATIONS.some((s) => s.id === id)).toBe(true)
  })
  it('the IGPs stay inside the band where DO-229 spaces them 5° apart (up to 55°)', () => {
    expect(IGP_BOX.lat1).toBeLessThanOrEqual(55)
    expect(IGP_BOX.lat0).toBeGreaterThanOrEqual(-55)
  })
  it('the FAS data block names EGNOS (provider 1) and carries the LPV-200 limits; its CRC checks', () => {
    const b = makeFasDataBlock()
    expect(b.sbasProvider).toBe('EGNOS')
    expect(b.sbasProviderId).toBe(1)
    expect([b.halM, b.valM, b.performanceDesignator]).toEqual([40, 35, 1])
    expect(fasValid(b, fasCrc(b))).toBe(true)
    expect(fasValid({ ...b, sbasProviderId: 0 }, fasCrc(b))).toBe(false)
    expect(APPROACH_CHANNEL).toBeGreaterThanOrEqual(40000)
    expect(APPROACH_CHANNEL).toBeLessThanOrEqual(99999)
    expect(DECISION_HEIGHT_FT).toBe(200)
  })
  it('the final approach is flown to LPV-200: HAL 40 m, VAL 35 m, 6 s (Doc 9849 Table 2-1)', () => {
    expect(operationFor('final')).toEqual(LPV200)
    expect([LPV200.halM, LPV200.valM, LPV200.ttaS]).toEqual([40, 35, 6])
  })
  it('flies EGNOS v2 (L1 SBAS) unless the EGNOS v3 preview is switched on', () => {
    expect(NOMINAL.service).toBe('l1')
    expect(conditionsFor(NO_FAILURES, NO_TIMES).service).toBe('l1')
    expect(conditionsFor({ ...NO_FAILURES, dfmcPreview: true }, NO_TIMES).service).toBe('dfmc')
    expect(conditionsFor({ ...NO_FAILURES, dfmcPreview: true, sbasOff: true }, NO_TIMES).service).toBe('off')
  })
  it('offers the failures that matter over Europe, not the equatorial ones', () => {
    const ids = FAILURES.map((f) => f.id)
    expect(ids).toContain('dfmcPreview')
    expect(ids).not.toContain('scintillation')
    expect(ids).not.toContain('evening')
    expect(ids).not.toContain('l1Only')
    for (const id of OFFLINE_SET) expect(RIMS_STATIONS.some((s) => s.id === id)).toBe(true)
  })
})

describe('a nominal LAB201 flight with EGNOS', () => {
  it('EGNOS reduces the position error compared with GPS alone', () => {
    expect(mean(nominal.map((x) => x.snap.sbasFix!.horizontalErrorM))).toBeLessThan(mean(nominal.map((x) => x.snap.abas!.horizontalErrorM)))
  })
  it('no misleading information: the protection levels bound the error on every sample', () => {
    for (const { snap } of nominal) {
      const f = snap.sbasFix!
      expect(f.horizontalErrorM).toBeLessThanOrEqual(f.hplM)
      expect(f.verticalErrorM).toBeLessThanOrEqual(f.vplM!)
      if (snap.sbasPaFix) expect(snap.sbasPaFix.verticalErrorM).toBeLessThanOrEqual(snap.sbasPaFix.vplM!)
      if (!snap.abas!.alarm) expect(snap.abas!.horizontalErrorM).toBeLessThanOrEqual(snap.abas!.hplM)
    }
  })
  it('the protection level stays inside the alert limit in every phase, and LPV-200 is available on final', () => {
    for (const x of nominal) {
      const op = operationAt(x)
      if (!op) continue
      if (op.id === 'cat1') expect(approachMode(x.snap).mode).toBe('LPV')
      else {
        const nav = navStatus(x.snap, op)
        expect(nav.ok).toBe(true)
        expect(nav.source).toBe('sbas')
      }
    }
    expect(finals(nominal).length).toBeGreaterThan(20)
  })
  it('both EGNOS GEOs are received all the way', () => {
    for (const x of nominal) expect(x.snap.service.geosTracked).toBe(2)
  })
})

describe('failures over Europe', () => {
  it('an ionospheric storm takes LPV-200 away from the L1 service; LNAV stays; dual-frequency keeps LPV', () => {
    const storm = finals(run({ ...NOMINAL, storm: 1 }))
    for (const x of storm) expect(approachMode(x.snap).mode).toBe('LNAV')
    const stormDfmc = finals(run({ ...NOMINAL, storm: 1, service: 'dfmc' }))
    for (const x of stormDfmc) expect(approachMode(x.snap).mode).toBe('LPV')
  })
  it('the storm does not take en-route and terminal integrity away (Doc 9849 §5.2.1.1)', () => {
    for (const x of run({ ...NOMINAL, storm: 1 })) {
      const op = operationAt(x)
      if (op && op.id !== 'cat1') expect(navStatus(x.snap, op).ok).toBe(true)
    }
  })
  it('a clock jump is flagged "Do not use" within the LPV-200 time to alert', () => {
    const x = finals(nominal)[5]
    const victim = x.snap.sbasPaFix!.used[0]
    const fault = { satId: victim, startS: x.t, jumpM: 40 }
    const later = snapshot(x.t + LPV200.ttaS, pos(x), { ...NOMINAL, fault })
    expect(later.alarmedSats).toContain(victim)
    expect(later.sbasPaFix?.used ?? []).not.toContain(victim)
    expect(alarmBroadcastS(fault.startS) + 1 - fault.startS).toBeLessThanOrEqual(LPV200.ttaS)
  })
  it('with both GEOs lost no later alarm reaches the aircraft', () => {
    const x = finals(nominal)[5]
    const victim = x.snap.sbasPaFix!.used[0]
    const c = { ...NOMINAL, geoLostFromS: x.t - 1, fault: { satId: victim, startS: x.t, jumpM: 40 } }
    const later = snapshot(x.t + LPV200.ttaS, pos(x), c)
    expect(later.service.geosTracked).toBe(0)
    expect(later.alarmedSats).not.toContain(victim)
  })
  it('losing both GEOs: vertical guidance times out, then GPS alone with LNAV', () => {
    const x = finals(nominal)[3]
    const c = { ...NOMINAL, geoLostFromS: x.t }
    // Vertical guidance survives three lost messages and goes with the fourth (Annex 10 App B 3.5.8.1.2.7).
    expect(approachMode(snapshot(x.t + 3, pos(x), c)).mode).toBe('LPV')
    expect(approachMode(snapshot(x.t + 4, pos(x), c)).mode).toBe('LNAV')
    expect(approachMode(snapshot(x.t + 13, pos(x), c)).mode).toBe('LNAV')
    expect(snapshot(x.t + 30, pos(x), c).sbasFix).toBeNull()
    // After the full time-out the receiver is on GPS alone, and RAIM still supports LNAV,
    // as the failure notice, the role notes and the exam's answer say (Doc 9849 §4.3.4.3).
    for (const later of finals(nominal).filter((y) => y.t >= x.t + 30)) {
      const after = snapshot(later.t, pos(later), c)
      expect(after.sbasFix).toBeNull()
      expect(approachMode(after)).toMatchObject({ mode: 'LNAV', fix: after.abas })
    }
  })
  it('SBAS off: GPS alone with RAIM supports LNAV all the way down the approach into Nice', () => {
    const near = run({ ...NOMINAL, service: 'off' }).filter(
      (x) => segmentOf(x.s) === 'final' || (segmentOf(x.s) === 'air' && Math.hypot(x.s.eastNm - DESTINATION.thresholdEastNm, x.s.northNm - DESTINATION.thresholdNorthNm) < 40),
    )
    expect(near.length).toBeGreaterThan(40)
    for (const x of near) {
      expect(x.snap.abas!.alarm).toBe(false)
      expect(x.snap.abas!.hplM).toBeLessThanOrEqual(OPERATIONS.npa.halM)
      expect(approachMode(x.snap).mode).toBe('LNAV')
    }
  })
  it('RIMS offline: the grid near the route loses its monitoring and LPV goes; LNAV stays', () => {
    const r = finals(run({ ...NOMINAL, offlineStations: OFFLINE_SET }))
    for (const x of r) expect(approachMode(x.snap).mode).toBe('LNAV')
  })
  it('GNSS interference: no position at all', () => {
    const s = snapshot(TRIP[200].t, pos(TRIP[200]), { ...NOMINAL, jammed: true })
    expect(s.abas).toBeNull()
    expect(approachMode(s).mode).toBe('NONE')
  })
})
