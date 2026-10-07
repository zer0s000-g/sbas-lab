/**
 * Facts the page shows outside the claims registry (the SBAS worldwide cards, the shipped
 * service-area map, docs/SOURCES.md) agree with their claims, and claims that state a
 * size of the model's own approximations state it right. Runs in both scenario projects.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claim } from '@/content/claims'
import { SBAS_SYSTEMS } from '@/content/sbasSystems'
import { SERVICE_MAP_GRID_DEG, SERVICE_MAP_STEP_S } from '@/data/servicemap/meta'
import { GEO_RADIUS_M, GPS_RADIUS_M } from '@/core/orbits'
import { GPS_OMEGA_E_RAD_S } from '@/core/ephemeris'
import { GPS_MU_M3_S2, WGS84_OMEGA_E_RAD_S } from '@/core/units'

const ROOT = join(import.meta.dirname, '..', '..')

describe('claims and what the page shows elsewhere', () => {
  it('every number an SBAS worldwide card shows is in its claim (text, note or value)', () => {
    const missing: string[] = []
    for (const s of SBAS_SYSTEMS) {
      const c = claim(s.claim)!
      const hay = `${c.text} ${c.note ?? ''} ${JSON.stringify(c.value ?? '')}`
      const shown: [string, number | null][] = [
        ['reference stations', s.ground.reference],
        ['master stations', s.ground.master],
        // EGNOS has two NLES per GEO; its card leaves the uplink count empty.
        ['uplink stations', s.id === 'egnos' ? null : s.ground.uplink],
        ...s.geos.map((g): [string, number | null] => [`${g.name} PRN`, g.prn]),
        ...s.geos.map((g): [string, number | null] => [`${g.name} longitude`, g.lonDeg === null ? null : Math.abs(g.lonDeg)]),
        ...s.services.map((v): [string, number | null] => [`${v.level} year`, v.year]),
        ...[...`${s.headline} ${s.services.map((v) => v.level).join(' ')}`.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m): [string, number | null] => [`text "${m[0]}"`, Number(m[0])]),
      ]
      for (const [what, n] of shown) if (n !== null && !new RegExp(`(^|[^\\d.])${String(n).replace('.', '\\.')}(?![\\d])`).test(hay)) missing.push(`${s.id}: ${what} = ${n}`)
    }
    expect(missing).toEqual([])
  })

  it('the QZS-6 claim of the AirNav Indonesia scenario agrees with the MSAS card (operational since October 2025)', () => {
    const qzs6 = SBAS_SYSTEMS.find((s) => s.id === 'msas')!.geos.find((g) => g.name === 'QZS-6')!
    expect(qzs6.role).toBe('operational')
    const text = claim('scenario.qzs6-status')!.text
    expect(text).not.toMatch(/under test|service date .* to confirm/)
    expect(text).toMatch(/October 2025/)
    expect(claim('world.msas')!.text).toMatch(/QZS-6 since October 2025/)
  })

  it('the service-map claim binds the grid and step of every shipped map', () => {
    const dir = join(ROOT, 'src', 'data', 'servicemap')
    const maps = readdirSync(dir).filter((f) => f.endsWith('.json'))
    expect(maps.length).toBeGreaterThan(0)
    for (const f of maps) {
      const m = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { spec: { stepDeg: number }; stepS: number }
      expect([m.spec.stepDeg, m.stepS], f).toEqual([SERVICE_MAP_GRID_DEG, SERVICE_MAP_STEP_S])
    }
    expect(claim('servicemap.method')!.value).toEqual([2, 600])
  })

  it('gnss.earth-rotation states the size of the WGS-84 vs IS-GPS-200 rate difference on the model orbits', () => {
    // The model uses ω in the GEO radius, cbrt(μ/ω²), and in the node rotation −ω·t of each GPS orbit.
    const geoM = Math.abs(Math.cbrt(GPS_MU_M3_S2 / GPS_OMEGA_E_RAD_S ** 2) - GEO_RADIUS_M)
    const gpsPerHourM = GPS_RADIUS_M * Math.abs(GPS_OMEGA_E_RAD_S - WGS84_OMEGA_E_RAD_S) * 3600
    expect(geoM).toBeCloseTo(0.565, 3)
    expect(gpsPerHourM).toBeLessThan(0.145)
    const text = claim('gnss.earth-rotation')!.text
    expect(text).not.toMatch(/millimetre/)
    expect(text).toContain(`about ${geoM.toFixed(1)} m in the GEO orbit radius`)
    expect(text).toContain(`at most ${gpsPerHourM.toFixed(2)} m per hour`)
  })

  it('docs/SOURCES.md repeats none of the statements the registry corrected', () => {
    const md = readFileSync(join(ROOT, 'docs', 'SOURCES.md'), 'utf8')
    expect(claim('dfmc.planned')!.text).toMatch(/early 2030s/)
    expect(claim('ops.adsb')!.text).toMatch(/horizontal protection level/)
    expect(claim('dfmc.equatorial-apv')!.text).toMatch(/expected/)
    const stale = [/EGNOS from 2028/, /integrity is linked to GNSS alert limits/, /Dual-frequency SBAS makes APV possible/, /could not reach the\s+EGNOS, EUSPA, ESA, EUR-Lex or ICAO websites/, /QZS-6[^|]*under test/]
    expect(stale.filter((re) => re.test(md)).map(String)).toEqual([])
  })
})
