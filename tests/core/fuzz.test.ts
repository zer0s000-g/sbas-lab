/** Drives the core with values across (and beyond) their real range and fails on any NaN. */
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/core/random'
import { NOMINAL, snapshot, approachMode, type Conditions } from '@/core/sbasWorld'
import { piercePoint, verticalTec } from '@/core/iono'
import { deviations, makeFasDataBlock } from '@/core/approach'
import { initialAircraft, stepFlight } from '@/core/flight'
import type { Fix } from '@/core/receiver'

function finiteFix(f: Fix | null) {
  if (!f) return
  for (const v of [f.horizontalErrorM, f.verticalErrorM, f.hdop, f.vdop, f.pdop, ...f.errorEnu]) expect(Number.isFinite(v)).toBe(true)
  expect(Number.isNaN(f.hplM)).toBe(false)
  if (f.vplM !== null) expect(Number.isNaN(f.vplM)).toBe(false)
}

describe('fuzz', () => {
  const r = mulberry32(99)
  it('snapshots never contain NaN, across every control and any place and time', () => {
    for (let i = 0; i < 60; i++) {
      const c: Conditions = {
        ...NOMINAL,
        seed: Math.floor(r() * 1e6),
        startLocalHour: r() * 24,
        storm: r(),
        scintillation: r() < 0.3,
        service: (['dfmc', 'l1', 'off'] as const)[Math.floor(r() * 3)],
        geoLostFromS: r() < 0.3 ? r() * 1000 : null,
        offlineStations: r() < 0.3 ? ['RIMS-BTJ', 'RIMS-JKT', 'RIMS-UPG'] : [],
        fault: r() < 0.3 ? { satId: `G${String(1 + Math.floor(r() * 24)).padStart(2, '0')}`, startS: r() * 1000, jumpM: r() * 100 } : null,
        jammed: r() < 0.1,
      }
      const pos = { latDeg: -30 + r() * 60, lonDeg: 80 + r() * 70, hM: r() * 15000 }
      const s = snapshot(r() * 3000, pos, c)
      for (const f of [s.abas, s.l1sbas, s.l1sbasPa, s.dfmc]) finiteFix(f)
      for (const v of s.sats) expect(Number.isFinite(v.elDeg) && Number.isFinite(v.azDeg)).toBe(true)
      expect(['LPV', 'LNAV/VNAV', 'LNAV', 'NONE']).toContain(approachMode(s).mode)
      expect(Number.isFinite(s.service.messageAgeS)).toBe(true)
    }
  })
  it('NaN and Infinity inputs give "no answer", never a plausible number', () => {
    const bad = [Number.NaN, Infinity, -Infinity]
    for (const b of bad) {
      expect(piercePoint(b, 0, 0, 30)).toBeNull()
      expect(Number.isNaN(verticalTec(b, 0, { tS: 0, startLocalHour: 10, storm: 0, scintillation: false }))).toBe(true)
      expect(deviations(makeFasDataBlock(), b, 0, 1000)).toBeNull()
      const s = snapshot(100, { latDeg: b, lonDeg: 91, hM: 0 }, NOMINAL)
      expect(s.abas).toBeNull()
      expect(approachMode(s).mode).toBe('NONE')
    }
  })
  it('the flight step survives any step size in its range', () => {
    let s = initialAircraft()
    for (let i = 0; i < 3000; i++) {
      s = stepFlight(s, 0.05 + r() * 1.5)
      for (const v of [s.eastNm, s.northNm, s.altFt, s.headingDeg, s.gsKt, s.vsFpm]) expect(Number.isFinite(v)).toBe(true)
    }
  })
})
