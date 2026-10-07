/**
 * The service-area map of a real day (ESSP-SAS): the engine (src/core/serviceMap) on real
 * broadcast orbits, the packed file the page loads (src/data/servicemap), and the switch to
 * real EGNOS messages (checked on the recorded 2011 broadcast).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseNav, gpsSeconds } from '@/core/rinex'
import { gridPoints, groundFromDecoder, igpsOver, levelsAt, modelledGround, packLevel, realSatsAt, unpackLevel } from '@/core/serviceMap'
import { applyMessage, bitsFromHex, decodeMessage, emptyState, parseEms } from '@/core/sbasDecode'
import { EGNOS_RIMS } from '@/scenarios/essp/rimsNetwork'
import { REGION } from '@/core/region'
import { lookAngles } from '@/core/geo'
import { TIMEOUTS_S } from '@/core/messages'
import { decodeServiceMap, availabilityAt, SERVICE_MAP_OPS } from '@/page/essp/serviceMapData'

const ROOT = join(import.meta.dirname, '..', '..')
const nav = parseNav(readFileSync(join(ROOT, 'tests/fixtures/rinex/BRDC-0000.rnx'), 'utf8'))
const t = gpsSeconds(2026, 9, 30, 0, 0, 0)
const sats = realSatsAt(nav.ephemerides, t)
const iono = { tS: 0, startLocalHour: REGION.origin.lonDeg / 15, storm: 0, scintillation: false }
const ground = modelledGround(sats, EGNOS_RIMS, iono, igpsOver({ lat0: 20, lat1: 75, lon0: -40, lon1: 50 }))

describe('the service-map engine on real orbits', () => {
  it('finds the real constellation: about 30 healthy GPS satellites', () => {
    expect(sats.length).toBeGreaterThan(26)
    expect(sats.length).toBeLessThanOrEqual(32)
  })

  it('the modelled EGNOS network monitors every satellite in view of Toulouse', () => {
    const tls = { latDeg: 43.6, lonDeg: 1.4, hM: 150 }
    const inView = sats.filter((s) => (lookAngles(tls, s.ecef)?.elDeg ?? -90) >= 5)
    expect(inView.length).toBeGreaterThan(6)
    for (const s of inView) expect(ground.udrei.get(s.prn), `G${s.prn}`).toBeLessThan(14)
  })

  it('gives LPV-200 at Toulouse and nothing in mid-Atlantic far outside the network', () => {
    const tls = levelsAt({ latDeg: 43.6, lonDeg: 1.4, hM: 150 }, sats, ground)
    expect(tls.vplPaM).not.toBeNull()
    expect(tls.vplPaM!).toBeLessThan(35)
    expect(tls.hplPaM!).toBeLessThan(40)
    const far = levelsAt({ latDeg: 10, lonDeg: -40, hM: 0 }, sats, ground)
    expect(far.vplPaM === null || far.vplPaM > 35).toBe(true)
  })

  it('packs a protection level into a byte that still bounds it', () => {
    for (const m of [0, 0.2, 12.34, 35, 49.9, 99.4, 100, 233, 360]) {
      const back = unpackLevel(packLevel(m))!
      expect(back, `${m}`).toBeGreaterThanOrEqual(m)
      expect(back - m, `${m}`).toBeLessThanOrEqual(m < 100 ? 0.5 : 5)
    }
    expect(unpackLevel(packLevel(600))).toBe(Infinity)
    expect(packLevel(null)).toBe(255)
    expect(packLevel(Number.NaN)).toBe(255)
    expect(unpackLevel(255)).toBeNull()
  })

  it('lays the grid out row by row from the south-west', () => {
    const pts = gridPoints({ lat0: 26, lat1: 30, lon0: -2, lon1: 2, stepDeg: 2 })
    expect(pts).toHaveLength(9)
    expect(pts[0]).toMatchObject({ latDeg: 26, lonDeg: -2 })
    expect(pts[8]).toMatchObject({ latDeg: 30, lonDeg: 2 })
  })
})

describe('real EGNOS messages as the corrections source', () => {
  it('turns the decoded broadcast into UDREIs by GPS PRN and a grid, and drops what has timed out', () => {
    const recs = parseEms(readFileSync(join(ROOT, 'src/replay/data/egnos-prn124-20110329-1500.ems'), 'utf8'))
    const s = emptyState()
    for (const r of recs) {
      const bits = bitsFromHex(r.hex)
      if (bits) applyMessage(s, decodeMessage(bits), r.tS)
    }
    const last = recs[recs.length - 1].tS
    const g = groundFromDecoder(s, last)
    expect(g.udrei.size).toBeGreaterThan(15)
    for (const prn of g.udrei.keys()) expect(prn).toBeLessThanOrEqual(37)
    expect(g.grid.size).toBeGreaterThan(50)
    // An hour later everything has timed out.
    const stale = groundFromDecoder(s, last + 3600)
    expect(stale.udrei.size).toBe(0)
    expect(stale.grid.size).toBe(0)
  })
})

describe('UDREI time-out', () => {
  // UDREIs come in Message Types 2–6 and 24 (FAA WAAS PAN Report 92, Table 5-3): an MT6
  // refreshes the UDREI and its time-out without a new fast correction.
  const decoded = () => {
    const s = emptyState()
    applyMessage(s, { type: 1, maskBits: [5], iodp: 1 }, 0)
    applyMessage(s, { type: 2, iodf: 1, iodp: 1, prc: Array(13).fill(0.5), udrei: Array(13).fill(4) }, 0)
    return s
  }
  it('an MT6 received 5 s ago keeps the UDREI, although the correction is 15 s old', () => {
    const s = decoded()
    applyMessage(s, { type: 6, iodf: [1, 1, 1, 1], udrei: Array(51).fill(4) }, 10)
    expect(groundFromDecoder(s, 15).udrei.get(5)).toBe(4)
  })
  it('without it the UDREI times out after messages.TIMEOUTS_S.udrei.PA', () => {
    const s = decoded()
    expect(groundFromDecoder(s, TIMEOUTS_S.udrei.PA).udrei.get(5)).toBe(4)
    expect(groundFromDecoder(s, TIMEOUTS_S.udrei.PA + 1).udrei.has(5)).toBe(false)
  })
})

describe('the packed map of 30 September 2026', () => {
  const raw = JSON.parse(readFileSync(join(ROOT, 'src/data/servicemap/2026-09-30.json'), 'utf8'))
  const map = decodeServiceMap(raw)

  it('is complete and well-formed', () => {
    expect(map.day).toBe('2026-09-30')
    expect(['modelled', 'egnos']).toContain(map.source)
    expect(map.epochs).toBe(144)
    expect(map.hplPa.length).toBe(map.epochs * map.points.length)
    expect(map.vplPa.length).toBe(map.epochs * map.points.length)
    expect(map.stations.length).toBe(15)
    for (const st of map.stations) {
      expect(st.tS.length, st.id).toBe(288)
      expect(st.hErrCm.every((v) => v === null || Number.isFinite(v)), st.id).toBe(true)
    }
  })

  it('shows LPV-200 over the core of Europe nearly all day (a regression guard)', () => {
    const k = map.indexOf(44, 2)
    expect(availabilityAt(map, k, 'cat1')).toBeGreaterThan(0.99)
    expect(availabilityAt(map, k, 'npa')).toBeGreaterThan(0.99)
  })

  it('has the real GPS-alone error at every station within a few metres (95 %)', () => {
    for (const st of map.stations) {
      const h = st.hErrCm.filter((v): v is number => v !== null).map(Math.abs).sort((a, b) => a - b)
      expect(h[Math.floor(h.length * 0.95)] / 100, st.id).toBeLessThan(10)
    }
  })

  it('offers the three operations the panel compares', () => {
    expect(SERVICE_MAP_OPS.map((o) => o.id)).toEqual(['cat1', 'apv1', 'npa'])
  })
})
