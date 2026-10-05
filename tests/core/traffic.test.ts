/**
 * The arrival traffic of the controller's view: deterministic in world time, on its
 * streams, descending to the threshold on the glide path, and the instructions the
 * picture calls for.
 */
import { describe, expect, it } from 'vitest'
import { expectedInstructions, trafficAt, type TrafficSpec } from '@/core/traffic'

const SPEC: TrafficSpec = {
  threshold: { eastNm: 0, northNm: 0, elevationFt: 12 },
  finalCourseDeg: 44,
  joinNm: 8,
  gpaDeg: 3,
  streams: [
    { id: 'w', name: 'WEST', fromBearingDeg: 250, entryNm: 35 },
    { id: 's', name: 'SOUTH', fromBearingDeg: 180, entryNm: 35 },
  ],
  aircraft: [
    { callsign: 'AAA1', stream: 'w', equip: 'sbas', offsetS: 0 },
    { callsign: 'BBB2', stream: 's', equip: 'gps', offsetS: 300 },
    { callsign: 'CCC3', stream: 'w', equip: 'conventional', offsetS: 600 },
  ],
  cycleS: 1200,
}

describe('arrival traffic', () => {
  it('is a function of world time only', () => {
    expect(trafficAt(SPEC, 1234.5)).toEqual(trafficAt(SPEC, 1234.5))
    expect(trafficAt(SPEC, 100)).toEqual(trafficAt(SPEC, 100 + SPEC.cycleS))
  })

  it('starts each aircraft at its stream entry, high, and lands it on the threshold', () => {
    const start = trafficAt(SPEC, 0).find((a) => a.callsign === 'AAA1')!
    expect(Math.hypot(start.eastNm, start.northNm)).toBeCloseTo(35, 5)
    expect(start.altFt).toBe(9000)
    expect(start.onFinal).toBe(false)
    // Sample until it is on final, then check the glide path: about 318 ft per NM for 3°.
    let onFinal = null
    for (let t = 0; t < SPEC.cycleS && !onFinal; t += 5) onFinal = trafficAt(SPEC, t).find((a) => a.callsign === 'AAA1' && a.onFinal && a.toGoNm < 5) ?? null
    expect(onFinal).not.toBeNull()
    expect(onFinal!.altFt).toBeCloseTo(12 + 50 + onFinal!.toGoNm * 318.4, -1)
    expect(onFinal!.trackDeg).toBeCloseTo(44, 0)
  })

  it('removes an aircraft between landing and its next entry', () => {
    const counts = new Set<number>()
    for (let t = 0; t < SPEC.cycleS; t += 10) counts.add(trafficAt(SPEC, t).length)
    expect(Math.min(...counts)).toBeLessThan(SPEC.aircraft.length)
    expect(Math.max(...counts)).toBe(SPEC.aircraft.length)
  })

  it('never returns NaN, even for bad times', () => {
    expect(trafficAt(SPEC, Number.NaN)).toEqual([])
    for (const a of trafficAt(SPEC, -777)) expect([a.eastNm, a.northNm, a.altFt].every(Number.isFinite)).toBe(true)
  })
})

describe('what the controller should do', () => {
  it('warns of GNSS when no GNSS aircraft has a fix', () => {
    expect(expectedInstructions([{ equip: 'sbas', mode: 'NONE' }, { equip: 'gps', mode: 'NONE' }, { equip: 'conventional', mode: 'NONE' }])).toEqual(['gnss-unreliable', 'clear-conventional'])
  })

  it('declares SBAS unavailable when SBAS aircraft lose LPV but GNSS still works', () => {
    expect(expectedInstructions([{ equip: 'sbas', mode: 'LNAV' }, { equip: 'gps', mode: 'LNAV' }])).toEqual(['sbas-unavailable', 'clear-conventional'])
  })

  it('clears a GPS-only aircraft that has lost its approach to a conventional one, even when the SBAS aircraft keep LPV', () => {
    expect(expectedInstructions([{ equip: 'sbas', mode: 'LPV' }, { equip: 'gps', mode: 'NONE' }])).toEqual(['clear-conventional'])
  })

  it('does nothing when every SBAS aircraft has LPV', () => {
    expect(expectedInstructions([{ equip: 'sbas', mode: 'LPV' }, { equip: 'gps', mode: 'LNAV' }, { equip: 'conventional', mode: 'NONE' }])).toEqual(['no-action'])
  })
})
