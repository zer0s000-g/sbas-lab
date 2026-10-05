/**
 * The real-data path, on excerpts of real files of 30 September 2026 (tests/fixtures/rinex,
 * from the BKG GNSS Data Center; EUREF data CC BY 4.0): Hatanaka decompression, the RINEX
 * readers, the broadcast orbits against IGS precise orbits, and a GPS-alone fix at the
 * EUREF station Toulouse (TLMF) against its surveyed position.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyTextDiff, crxToRinex } from '@/core/hatanaka'
import { antennaPosition, gpsSeconds, parseNav, parseObs } from '@/core/rinex'
import { GPS_OMEGA_E_RAD_S, klobucharM, pickEphemeris, satState } from '@/core/ephemeris'
import { fixError, solveSpp } from '@/core/spp'
import { norm, sub, type Vec3 } from '@/core/geo'

const FIX = join(import.meta.dirname, '..', 'fixtures', 'rinex')
const read = (f: string) => readFileSync(join(FIX, f), 'utf8')
const nav = parseNav(read('BRDC-0000.rnx'))
const rnx = crxToRinex(read('TLMF-3epochs.crx'))
const obs = parseObs(rnx)

describe('Hatanaka (compact RINEX 3)', () => {
  it('applies a character difference: space keeps, & blanks, others replace, longer lines extend', () => {
    expect(applyTextDiff('> 2026 09 30 00 00', '                30')).toBe('> 2026 09 30 00 30')
    expect(applyTextDiff('ABCD', ' & ')).toBe('A CD')
    expect(applyTextDiff('AB', '  XY')).toBe('ABXY')
  })

  it('rebuilds values from n-th order differences', () => {
    const header = ['     3.04           OBSERVATION DATA    G                   RINEX VERSION / TYPE', 'G    1 C1C                                                  SYS / # / OBS TYPES', '                                                            END OF HEADER']
    const crx = [
      '3.0                 COMPACT RINEX FORMAT                    CRINEX VERS   / TYPE',
      'test                                                        CRINEX PROG / DATE',
      ...header,
      '> 2026 09 30 00 00  0.0000000  0  1      G05',
      '',
      '3&20000000000 ',
      '                 30',
      '',
      '5000',
      '                1 0',
      '',
      '-200',
      '',
    ].join('\n')
    const out = crxToRinex(crx).split('\n').filter((l) => l.startsWith('G05'))
    // 20 000 000.000, then +5.000 (first difference), then +5.000 − 0.200 (second difference).
    expect(out.map((l) => Number(l.slice(3, 17)))).toEqual([20000000, 20000005, 20000009.8])
  })

  it('decompresses a real EUREF file: three epochs, the first pseudorange as recorded', () => {
    expect(obs.marker).toBe('TLMF')
    expect(obs.epochs).toHaveLength(3)
    expect(obs.epochs[0].c1.get(2)).toBeCloseTo(24136530.458, 3)
    // 30 s apart, no satellite's range changes by more than 1 km/s.
    for (const [prn, pr] of obs.epochs[1].c1) {
      const before = obs.epochs[0].c1.get(prn)
      if (before !== undefined) expect(Math.abs(pr - before), `G${prn}`).toBeLessThan(30_000)
    }
  })

  it('refuses a file that is not compact RINEX 3', () => {
    expect(() => crxToRinex('just text\n')).toThrow()
  })
})

describe('RINEX 3 navigation', () => {
  it('reads the GPS records and the Klobuchar coefficients', () => {
    expect(nav.ephemerides.length).toBeGreaterThan(25)
    expect(nav.klobuchar).not.toBeNull()
    const e = nav.ephemerides[0]
    expect(e.sqrtA).toBeGreaterThan(5100)
    expect(e.sqrtA).toBeLessThan(5200)
    expect(e.e).toBeGreaterThan(0)
    expect(e.e).toBeLessThan(0.05)
  })

  it('puts the antenna its height above the marker', () => {
    const marker: [number, number, number] = [4594489.826, -678367.903, 4357065.833]
    const arp = antennaPosition({ approxXyz: marker, antennaDeltaHen: [3.046, 0, 0] })
    expect(Math.hypot(arp[0] - marker[0], arp[1] - marker[1], arp[2] - marker[2])).toBeCloseTo(3.046, 3)
    expect(Math.hypot(...arp)).toBeGreaterThan(Math.hypot(...marker))
    expect(antennaPosition({ approxXyz: marker, antennaDeltaHen: [0, 0, 0] })).toEqual(marker)
  })

  it('counts time from the GPS epoch', () => {
    expect(gpsSeconds(1980, 1, 6, 0, 0, 0)).toBe(0)
    expect(Math.floor(gpsSeconds(2026, 9, 30, 0, 0, 0) / 604800)).toBe(2438)
  })
})

describe('broadcast orbits (IS-GPS-200)', () => {
  it('uses the GPS Earth rotation rate, not the WGS-84 one', () => {
    expect(GPS_OMEGA_E_RAD_S).toBe(7.2921151467e-5)
  })

  // The broadcast orbit refers to the antenna phase centre, the IGS orbit to the centre of
  // mass (up to about 2.6 m apart on some blocks), on top of the broadcast orbit's own error.
  it('agree with the IGS rapid orbits within 4 m at 00:15 (median under 2 m)', () => {
    const lines = read('IGS-rapid-2epochs.sp3').split('\n')
    // A satellite the IGS orbit leaves at zero at 00:00 has no precise orbit yet (G25 that day): left out.
    const at00 = lines.slice(1, lines.findIndex((l) => l.startsWith('*  2026  9 30  0 15'))).filter((l) => l.startsWith('PG'))
    const missing = new Set(at00.filter((l) => Number(l.slice(4, 18)) === 0).map((l) => Number(l.slice(2, 4))))
    const at15 = lines.slice(lines.findIndex((l) => l.startsWith('*  2026  9 30  0 15')) + 1).filter((l) => l.startsWith('PG'))
    const t = gpsSeconds(2026, 9, 30, 0, 15, 0)
    const diffs: number[] = []
    for (const l of at15) {
      const prn = Number(l.slice(2, 4))
      if (missing.has(prn)) continue
      const eph = pickEphemeris(nav.ephemerides, prn, t)
      if (!eph) continue
      const sp3: Vec3 = [Number(l.slice(4, 18)) * 1000, Number(l.slice(18, 32)) * 1000, Number(l.slice(32, 46)) * 1000]
      const d = norm(sub(satState(eph, t).ecef, sp3))
      expect(d, `G${prn}`).toBeLessThan(4)
      diffs.push(d)
    }
    expect(diffs.length).toBeGreaterThan(25)
    expect(diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)]).toBeLessThan(2)
  })

  it('picks only healthy ephemerides within their fit interval', () => {
    const t = gpsSeconds(2026, 9, 30, 0, 0, 0)
    expect(pickEphemeris(nav.ephemerides, 2, t)).not.toBeNull()
    expect(pickEphemeris(nav.ephemerides, 2, t + 10 * 3600)).toBeNull()
  })
})

describe('Klobuchar', () => {
  it('gives a plausible L1 delay, larger at low elevation', () => {
    const k = nav.klobuchar!
    const zenith = klobucharM(k, 43.6, 1.4, 0, 90, 13 * 3600)
    // Looking south, the pierce point moves towards the equator and the slant factor (~2.7 at 10°) adds to it.
    const low = klobucharM(k, 43.6, 1.4, 180, 10, 13 * 3600)
    expect(zenith).toBeGreaterThan(1)
    expect(zenith).toBeLessThan(20)
    expect(low).toBeGreaterThan(zenith * 2)
    // At night only the constant 5 ns term remains.
    expect(klobucharM(k, 43.6, 1.4, 0, 90, 2 * 3600)).toBeCloseTo(5e-9 * 299792458, 1)
  })
})

describe('GPS-alone fix at Toulouse (TLMF)', () => {
  it('lands within 5 m of the surveyed position in every epoch', () => {
    for (const ep of obs.epochs) {
      const fix = solveSpp(ep.tS, ep.c1, nav.ephemerides, nav.klobuchar, obs.approxXyz)
      expect(fix).not.toBeNull()
      const err = fixError(fix!.ecef, obs.approxXyz)!
      expect(Math.hypot(err.hM, err.vM)).toBeLessThan(5)
      expect(fix!.used.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('needs four satellites', () => {
    const ep = obs.epochs[0]
    const three = new Map([...ep.c1].slice(0, 3))
    expect(solveSpp(ep.tS, three, nav.ephemerides, nav.klobuchar, obs.approxXyz)).toBeNull()
  })
})
