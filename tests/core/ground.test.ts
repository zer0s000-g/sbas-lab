import { describe, expect, it } from 'vitest'
import { groundSolution, sigmaUdreM, udreIndex, UDREI_DO_NOT_USE, UDREI_NOT_MONITORED, UDREI_PA_LIMIT, usableForPa } from '@/core/groundSegment'
import { usableForPa as mapUsableForPa } from '@/core/serviceMap'
import { ALARM_LATENCY } from '@/core/messages'
import { DESTINATION, RIMS_STATIONS } from '@/core/region'
import { QUIET } from '@/core/iono'
import { groundFor, NOMINAL, snapshot } from '@/core/sbasWorld'

const base = { ...QUIET, seed: 201, offline: [] as string[], fault: null, tS: 600 }

describe('SBAS ground segment (Doc 9849 §4.3.1)', () => {
  it('corrects the satellites the network sees and bounds what is left', () => {
    const g = groundSolution(base)
    const ok = [...g.corrections.values()].filter((c) => c.status === 'ok')
    expect(ok.length).toBeGreaterThan(6)
    // UDREI 13 (150 m) is the rare "not for LPV" case; every other bound is tight.
    for (const c of ok) if (c.udrei < 13) expect(sigmaUdreM(c.udrei)).toBeLessThan(2)
    expect(g.gridList.some((i) => i.givei < 15)).toBe(true)
  })
  it('a satellite seen by fewer than two stations is Not Monitored', () => {
    const g = groundSolution(base)
    for (const c of g.corrections.values()) if (c.seenBy < 2) expect(c.udrei).toBe(UDREI_NOT_MONITORED)
  })
  it('switching stations off lowers how many see each satellite', () => {
    const all = groundSolution(base)
    const few = groundSolution({ ...base, offline: RIMS_STATIONS.slice(0, 8).map((s) => s.id) })
    const seen = (g: typeof all) => [...g.corrections.values()].reduce((s, c) => s + c.seenBy, 0)
    expect(seen(few)).toBeLessThan(seen(all))
  })
  it('a satellite clock jump is set to Do Not Use once the master detects it', () => {
    const fault = { satId: 'G03', startS: 600, jumpM: 30 }
    const before = groundSolution({ ...base, tS: 600 + ALARM_LATENCY.detectS - 0.5, fault }).corrections.get('G03')!
    const after = groundSolution({ ...base, tS: 600 + ALARM_LATENCY.detectS + 0.1, fault }).corrections.get('G03')!
    if (before.status !== 'not-monitored') expect(before.udrei).not.toBe(UDREI_DO_NOT_USE)
    if (after.seenBy >= 2) expect(after.udrei).toBe(UDREI_DO_NOT_USE)
  })
  it('UDREI 12 and above are not used for precision approach or APV (Annex 10 App B 3.5.8.1.2.12)', () => {
    expect(UDREI_PA_LIMIT).toBe(12)
    expect(usableForPa(0)).toBe(true)
    expect(usableForPa(11)).toBe(true)
    for (const u of [12, 13, UDREI_NOT_MONITORED, UDREI_DO_NOT_USE]) expect(usableForPa(u), String(u)).toBe(false)
    // The service-area maps apply the same rule.
    expect(mapUsableForPa).toBe(usableForPa)
  })
  it('a satellite broadcast with UDREI 12 serves en route to LNAV but not the solution for vertical guidance', () => {
    const tS = 1800
    const c = { ...NOMINAL, service: 'l1' as const }
    const at = { latDeg: DESTINATION.threshold.latDeg, lonDeg: DESTINATION.threshold.lonDeg, hM: 300 }
    const ground = groundFor(tS, c)
    const base = snapshot(tS, at, c, ground)
    const sat = base.l1sbasPa?.used[0]
    expect(sat).toBeDefined()
    const corrections = new Map(ground.corrections)
    corrections.set(sat!, { ...corrections.get(sat!)!, udrei: 12, udreiBeforeAlarm: 12 })
    const s = snapshot(tS, at, c, { ...ground, corrections })
    expect(s.l1sbas!.used).toContain(sat)
    expect(s.l1sbasPa?.used ?? []).not.toContain(sat)
  })
  it('UDRE indices grow with the bound', () => {
    expect(udreIndex(0.5)).toBe(0)
    expect(udreIndex(3)).toBeGreaterThan(udreIndex(1))
    expect(udreIndex(1e6)).toBe(UDREI_NOT_MONITORED)
    expect(sigmaUdreM(UDREI_DO_NOT_USE)).toBe(Infinity)
  })
})
