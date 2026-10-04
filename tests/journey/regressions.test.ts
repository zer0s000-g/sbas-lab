import { describe, expect, it } from 'vitest'
import { JourneyEngine } from '@/journey/engine'
import { journeyIndex } from '@/journey/phases'
import { alarmReceived, NOMINAL, snapshot } from '@/core/sbasWorld'
import { K_H_NPA, K_H_PA } from '@/core/receiver'
import { ALARM_LATENCY, alarmBroadcastS } from '@/core/messages'

const AIRCRAFT = { latDeg: -7, lonDeg: 110, hM: 10_000 }

describe('a satellite fault (the alarm path)', () => {
  const T0 = 3600
  const used = snapshot(T0, AIRCRAFT, NOMINAL).dfmc!.used[0]
  const c = { ...NOMINAL, fault: { satId: used, startS: T0, jumpM: 40 } }
  it('the aircraft keeps using the satellite after the ground flags it, until the alarm arrives', () => {
    const flagged = T0 + ALARM_LATENCY.detectS + 0.5
    expect(alarmReceived(c.fault, used, flagged)).toBe(false)
    expect(snapshot(flagged, AIRCRAFT, c).ground.corrections.get(used)!.status).toBe('do-not-use')
    expect(snapshot(flagged, AIRCRAFT, c).dfmc!.used).toContain(used)
  })
  it('once the alarm has arrived the satellite is excluded', () => {
    const after = alarmBroadcastS(T0) + 1.5
    const s = snapshot(after, AIRCRAFT, c)
    expect(s.alarmedSats).toContain(used)
    expect(s.dfmc!.used).not.toContain(used)
  })
})

describe('DFMC protection levels', () => {
  it('en route uses K_H,NPA and the approach K_H,PA', () => {
    const s = snapshot(3600, AIRCRAFT, NOMINAL)
    expect(s.sbasFix!.hplM / s.dfmc!.hplM).toBeCloseTo(K_H_NPA / K_H_PA, 6)
  })
})

describe('timed failures', () => {
  it('a clock jump switched on while jammed still hits a satellite', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('cruise')
    e.setFailure('jamming', true)
    e.setFailure('clockJump', true)
    expect(e.conditions().fault).not.toBeNull()
  })
  it('a GEO loss stays in force after a jump back in time', () => {
    const e = new JourneyEngine({ guidedStops: false })
    e.jumpTo('final')
    e.setFailure('geoLost', true)
    e.jumpTo('cruise')
    const c = e.conditions()
    expect(c.geoLostFromS).toBe(e.worldS)
    expect(e.snapshot().service.geosTracked).toBe(0)
  })
})

describe('the approach', () => {
  it('LAB201 never climbs once it has started down to Bali', () => {
    const ix = journeyIndex()
    const topOfDescent = ix.startTick.descent
    for (let t = topOfDescent; t <= ix.touchdownTick; t++) expect(ix.states[t].vsFpm).toBeLessThanOrEqual(0)
  })
})
