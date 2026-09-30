import { describe, expect, it } from 'vitest'
import { glidePathAltFt, initialAircraft, MAX_CLIMB_FPM, MAX_DESCENT_FPM, MAX_TURN_DEG_S, ROUTE, segmentOf, stepFlight, type AircraftState } from '@/core/flight'
import { DESTINATION } from '@/core/region'
import { wrap180 } from '@/core/units'

function fly(dt = 0.1) {
  let s = initialAircraft()
  const states: { t: number; s: AircraftState }[] = [{ t: 0, s }]
  let t = 0
  while (!s.parked && t < 4000) {
    s = stepFlight(s, dt)
    t += dt
    states.push({ t, s })
  }
  return states
}
const trip = fly()

describe('LAB201 gate to gate', () => {
  it('parks at the destination gate in under 45 minutes', () => {
    const last = trip.at(-1)!
    expect(last.s.parked).toBe(true)
    expect(last.t / 60).toBeLessThan(45)
    const gate = ROUTE.at(-1)!
    expect(Math.hypot(last.s.eastNm - gate.eastNm, last.s.northNm - gate.northNm)).toBeLessThan(0.1)
  })
  it('never turns faster than 3°/s in the air and keeps climb and descent rates in bounds', () => {
    for (let i = 1; i < trip.length; i++) {
      const a = trip[i - 1].s
      const b = trip[i].s
      if (!a.onGround && !b.onGround) expect(Math.abs(wrap180(b.headingDeg - a.headingDeg)) / 0.1).toBeLessThanOrEqual(MAX_TURN_DEG_S + 1e-6)
      expect(b.vsFpm).toBeLessThanOrEqual(MAX_CLIMB_FPM + 1e-6)
      expect(b.vsFpm).toBeGreaterThanOrEqual(-MAX_DESCENT_FPM - 1e-6)
    }
  })
  it('flies the final approach on the 3° glide path, aligned with the runway', () => {
    const final = trip.filter((x) => segmentOf(x.s) === 'final' && x.s.eastNm < DESTINATION.thresholdEastNm - 0.5)
    expect(final.length).toBeGreaterThan(100)
    for (const { s } of final.slice(Math.floor(final.length / 3))) {
      expect(Math.abs(s.northNm - DESTINATION.thresholdNorthNm)).toBeLessThan(0.05)
      expect(Math.abs(s.altFt - glidePathAltFt(DESTINATION.thresholdEastNm - s.eastNm))).toBeLessThan(30)
    }
  })
  it('reaches cruise level and stays in the air between the runways', () => {
    expect(Math.max(...trip.map((x) => x.s.altFt))).toBeGreaterThanOrEqual(15990)
    const air = trip.filter((x) => segmentOf(x.s) === 'air')
    expect(air.every((x) => !x.s.onGround)).toBe(true)
  })
  it('is deterministic', () => {
    expect(fly().at(-1)).toEqual(trip.at(-1))
  })
  it('refuses a step that would loop forever', () => {
    expect(() => stepFlight(initialAircraft(), 0)).toThrow()
  })
})
