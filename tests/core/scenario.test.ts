/**
 * The claims SBAS Lab makes, checked on a full LAB201 flight (docs/SBAS_CONTENT.md, plan
 * "Scenario tests"). The aircraft is stepped at the journey's 0.1 s tick and the SBAS
 * world is sampled every 5 s.
 */
import { describe, expect, it } from 'vitest'
import { initialAircraft, segmentOf, stepFlight, type AircraftState } from '@/core/flight'
import { localToGeodetic } from '@/core/geo'
import { DEPARTURE, DESTINATION, REGION } from '@/core/region'
import { approachMode, navStatus, NOMINAL, snapshot, type Conditions, type Snapshot } from '@/core/sbasWorld'
import { OPERATIONS, type Operation } from '@/core/operations'
import { M_PER_FT } from '@/core/units'
import { alarmBroadcastS } from '@/core/messages'

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

const at = (x: Sample, c: Conditions) => snapshot(x.t, localToGeodetic(REGION, x.s.eastNm, x.s.northNm, x.s.altFt * M_PER_FT), c)
const run = (c: Conditions) => TRIP.map((x) => ({ ...x, snap: at(x, c) }))
const finals = (r: ReturnType<typeof run>) => r.filter((x) => segmentOf(x.s) === 'final')

/** The operation that applies where the aircraft is: terminal within 30 NM of an airport, else en route. */
function operationAt(x: Sample): Operation | null {
  const seg = segmentOf(x.s)
  if (seg === 'final') return OPERATIONS.apv1
  if (seg !== 'air' && seg !== 'takeoff') return null
  const near = (a: typeof DEPARTURE) => Math.hypot(x.s.eastNm - a.thresholdEastNm, x.s.northNm - a.thresholdNorthNm) < 30
  return near(DEPARTURE) || near(DESTINATION) ? OPERATIONS.terminal : OPERATIONS.enroute
}

const nominal = run(NOMINAL)
const nominalL1 = run({ ...NOMINAL, service: 'l1' })
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('a nominal LAB201 flight', () => {
  it('SBAS reduces the position error compared with GPS alone', () => {
    const abas = mean(nominal.map((x) => x.snap.abas!.horizontalErrorM))
    expect(mean(nominal.map((x) => x.snap.dfmc!.horizontalErrorM))).toBeLessThan(abas * 0.6)
    expect(mean(nominalL1.map((x) => x.snap.l1sbas!.horizontalErrorM))).toBeLessThan(abas)
  })
  it('no misleading information: the protection levels bound the error on every sample', () => {
    for (const r of [nominal, nominalL1])
      for (const { snap } of r) {
        const f = snap.sbasFix!
        expect(f.horizontalErrorM).toBeLessThanOrEqual(f.hplM)
        expect(f.verticalErrorM).toBeLessThanOrEqual(f.vplM!)
        if (!snap.abas!.alarm) expect(snap.abas!.horizontalErrorM).toBeLessThanOrEqual(snap.abas!.hplM)
      }
  })
  it('with SBAS the protection level stays inside the alert limit in every phase of flight', () => {
    for (const x of nominal) {
      const op = operationAt(x)
      if (!op) continue
      if (op.id === 'apv1') expect(approachMode(x.snap).mode).toBe('LPV')
      else {
        const nav = navStatus(x.snap, op)
        expect(nav.ok).toBe(true)
        expect(nav.source).toBe('sbas')
      }
    }
  })
  it('the SBAS protection level is far smaller than GPS alone would give', () => {
    const ratio = mean(nominal.map((x) => x.snap.dfmc!.hplM / x.snap.abas!.hplM))
    expect(ratio).toBeLessThan(0.3)
  })
  it('DFMC SBAS gives LPV on final, day and evening (Doc 9849 §6.8.2)', () => {
    expect(finals(nominal).every((x) => approachMode(x.snap).mode === 'LPV')).toBe(true)
    const evening = finals(run({ ...NOMINAL, startLocalHour: 19.5 }))
    expect(evening.filter((x) => approachMode(x.snap).mode === 'LPV').length).toBeGreaterThan(evening.length * 0.9)
  })
})

describe('the equatorial ionosphere (Doc 9849 §5.2.1.5)', () => {
  it('with L1 SBAS only, after sunset, LPV is not available on final', () => {
    const r = finals(run({ ...NOMINAL, service: 'l1', startLocalHour: 19.5 }))
    expect(r.length).toBeGreaterThan(10)
    for (const x of r) {
      expect(approachMode(x.snap).mode).not.toBe('LPV')
      expect(x.snap.l1sbasPa === null || x.snap.l1sbasPa.vplM! > OPERATIONS.apv1.valM!).toBe(true)
    }
  })
  it('L1 SBAS still gives en-route and terminal integrity in the evening (Doc 9849 §4.3.1.5, §5.2.1.1)', () => {
    const r = run({ ...NOMINAL, service: 'l1', startLocalHour: 19.5 })
    for (const x of r) {
      const op = operationAt(x)
      if (op && op.id !== 'apv1') expect(navStatus(x.snap, op).ok).toBe(true)
    }
  })
  it('scintillation takes satellites out, whatever the frequencies', () => {
    const tracked = (snaps: Snapshot[]) => mean(snaps.map((s) => s.sats.filter((v) => v.kind === 'gps' && v.tracked).length))
    const quiet = tracked(nominal.map((x) => x.snap))
    const scint = run({ ...NOMINAL, scintillation: true })
    expect(tracked(scint.map((x) => x.snap))).toBeLessThan(quiet)
  })
})

describe('failures', () => {
  it('a satellite clock jump is flagged "Do not use" within the time to alert', () => {
    const x = finals(nominal)[5]
    const victim = x.snap.dfmc!.used[0]
    const fault = { satId: victim, startS: x.t, jumpM: 40 }
    const c = { ...NOMINAL, fault }
    const tta = OPERATIONS.apv1.ttaS
    const later = snapshot(x.t + tta, localToGeodetic(REGION, x.s.eastNm, x.s.northNm, x.s.altFt * M_PER_FT), c)
    expect(later.alarmedSats).toContain(victim)
    expect(later.dfmc!.used).not.toContain(victim)
    expect(alarmBroadcastS(fault.startS) + 1 - fault.startS).toBeLessThanOrEqual(tta)
  })
  it('losing both GEO signals: vertical guidance times out, then the receiver falls back to GPS alone', () => {
    const x = finals(nominal)[3]
    const pos = localToGeodetic(REGION, x.s.eastNm, x.s.northNm, x.s.altFt * M_PER_FT)
    const c = { ...NOMINAL, geoLostFromS: x.t }
    expect(approachMode(snapshot(x.t + 5, pos, c)).mode).toBe('LPV')
    expect(approachMode(snapshot(x.t + 13, pos, c)).mode).toBe('LNAV')
    const late = snapshot(x.t + 30, pos, c)
    expect(late.sbasFix).toBeNull()
    expect(approachMode(late).mode).toBe('LNAV')
  })
  it('GPS jamming: no satellite, no position, no approach mode', () => {
    const x = TRIP[200]
    const s = at(x, { ...NOMINAL, jammed: true })
    expect(s.abas).toBeNull()
    expect(s.sbasFix).toBeNull()
    expect(approachMode(s).mode).toBe('NONE')
  })
  it('SBAS off: only GPS alone, no vertical protection level', () => {
    const s = at(TRIP[300], { ...NOMINAL, service: 'off' })
    expect(s.sbasFix).toBeNull()
    expect(s.abas!.vplM).toBeNull()
  })
})
