import { describe, expect, it } from 'vitest'
import {
  bubbleDepletion,
  broadcastModelSlantL1,
  delayAt,
  estimateIgps,
  giveIndex,
  GIVEI_NOT_MONITORED,
  igpKey,
  IONO_REFERENCE_SEED,
  interpolateGrid,
  isPostSunset,
  L1_M_PER_TECU,
  piercePoint,
  QUIET,
  scintillationLoss,
  sigmaIonoNoSbasM,
  tauVertNoSbasM,
  verticalTec,
  type IgpEstimate,
} from '@/core/iono'
import { GPS_L5_HZ } from '@/core/units'
import { dipEquatorLatDeg } from '@/core/region'

const at = (hour: number, extra = {}) => ({ ...QUIET, startLocalHour: hour, tS: 0, ...extra })

describe('σ of the broadcast-model ionospheric residual (Annex 10 App B 3.5.5.6.3.2)', () => {
  it('τ_vert is 9 m within 20° of the equator, 4.5 m to 55° and 6 m beyond, on the pierce point’s geographic latitude', () => {
    expect([0, 20, -20].map(tauVertNoSbasM)).toEqual([9, 9, 9])
    expect([20.01, -40, 55, -55].map(tauVertNoSbasM)).toEqual([4.5, 4.5, 4.5, 4.5])
    expect([55.01, -70].map(tauVertNoSbasM)).toEqual([6, 6])
  })
  it('is the larger of T_iono/5 and F_pp·τ_vert', () => {
    const pp = { latDeg: 43, lonDeg: 5, obliquity: 2 }
    expect(sigmaIonoNoSbasM(pp)).toBeCloseTo(9, 12)
    expect(sigmaIonoNoSbasM(pp, 10)).toBeCloseTo(9, 12)
    expect(sigmaIonoNoSbasM(pp, 60)).toBeCloseTo(12, 12)
    expect(sigmaIonoNoSbasM({ ...pp, latDeg: -8 }, 20)).toBeCloseTo(18, 12)
    expect(sigmaIonoNoSbasM(pp, Number.NaN)).toBeCloseTo(9, 12)
  })
})

describe('ionospheric geometry', () => {
  it('a satellite overhead pierces the shell straight above the receiver with obliquity 1', () => {
    const pp = piercePoint(-2, 91, 0, 90)!
    expect(pp.latDeg).toBeCloseTo(-2, 6)
    expect(pp.lonDeg).toBeCloseTo(91, 6)
    expect(pp.obliquity).toBeCloseTo(1, 6)
  })
  it('lower satellites give longer slant paths (obliquity grows toward the horizon)', () => {
    const f = [80, 45, 20, 5].map((el) => piercePoint(-2, 91, 90, el)!.obliquity)
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1])
    expect(f[3]).toBeLessThan(3.1)
  })
  it('below the horizon or with bad input there is no pierce point', () => {
    expect(piercePoint(-2, 91, 0, -1)).toBeNull()
    expect(piercePoint(Number.NaN, 91, 0, 30)).toBeNull()
  })
})

describe('ionospheric delay model (Doc 9849 §5.2.1)', () => {
  it('about 0.16 m of L1 delay per TECU, and 1/f² scaling to L5', () => {
    expect(L1_M_PER_TECU).toBeCloseTo(0.1624, 3)
    expect(delayAt(1, GPS_L5_HZ)).toBeCloseTo(1.793, 3)
  })
  it('follows the sun: more delay in the early afternoon than before dawn', () => {
    expect(verticalTec(-2, 91, at(14))).toBeGreaterThan(3 * verticalTec(-2, 91, at(4)))
  })
  it('has dense bands about 15° either side of the magnetic equator, denser than over it', () => {
    const crest = verticalTec(dipEquatorLatDeg(110) - 15, 110, at(14))
    const trough = verticalTec(dipEquatorLatDeg(110), 110, at(14))
    expect(crest).toBeGreaterThan(trough)
  })
  it('grows in a storm', () => {
    expect(verticalTec(-2, 91, at(14, { storm: 1 }))).toBeGreaterThan(2 * verticalTec(-2, 91, at(14)))
  })
  it('bubbles appear only after local sunset (until about midnight)', () => {
    expect(isPostSunset(20)).toBe(true)
    expect(isPostSunset(0.2)).toBe(true)
    expect(isPostSunset(14)).toBe(false)
    expect(bubbleDepletion(-2, 91, 0, 0)).toBe(0)
    const anyBubble = Array.from({ length: 200 }, (_, i) => bubbleDepletion(-2, 80 + i * 0.1, 0, 1)).some((d) => d > 0.3)
    expect(anyBubble).toBe(true)
  })
  it('scintillation takes out only some satellites, and only in the evening', () => {
    const pps = Array.from({ length: 120 }, (_, i) => piercePoint(-2, 91, i * 3, 20 + (i % 50))!)
    const lostDay = pps.filter((pp, i) => scintillationLoss(`G${i}`, pp, at(12))).length
    const lostNight = pps.filter((pp, i) => scintillationLoss(`G${i}`, pp, at(21))).length
    expect(lostDay).toBe(0)
    expect(lostNight).toBeGreaterThan(0)
    expect(lostNight).toBeLessThan(pps.length / 2)
  })
  it('the GPS broadcast model removes about half of the delay (Doc 9849 §5.2.1.6)', () => {
    const est = broadcastModelSlantL1(10, -2, 91, 0)
    expect(est).toBeGreaterThan(4)
    expect(est).toBeLessThan(6)
  })
})

describe('the ionospheric grid', () => {
  it('GIVE indices grow with the bound and end at "not monitored"', () => {
    expect(giveIndex(0.1)).toBe(0)
    expect(giveIndex(2)).toBeGreaterThan(giveIndex(1))
    expect(giveIndex(1000)).toBe(GIVEI_NOT_MONITORED)
    expect(giveIndex(Number.NaN)).toBe(GIVEI_NOT_MONITORED)
  })
  it('an IGP with too few measurements nearby is not monitored', () => {
    const grid = estimateIgps([{ latDeg: -2, lonDeg: 91, delayM: 5 }], at(12))
    expect(grid.every((g) => g.givei === GIVEI_NOT_MONITORED)).toBe(true)
  })
  it('the grid is less trusted after sunset in the equatorial bands', () => {
    const obs = Array.from({ length: 60 }, (_, i) => ({ latDeg: -10 + (i % 10) * 2, lonDeg: 82 + Math.floor(i / 10) * 3, delayM: 5 }))
    const day = estimateIgps(obs, at(12)).find((g) => g.latDeg === -5 && g.lonDeg === 90)!
    const night = estimateIgps(obs, at(21)).find((g) => g.latDeg === -5 && g.lonDeg === 90)!
    expect(night.givei).toBeGreaterThan(day.givei)
  })
  it('the patterns follow the engine seed; the reference seed and no seed give the same draw', () => {
    const c = { ...QUIET, tS: 0, scintillation: true }
    const tecs = (seed?: number) => Array.from({ length: 50 }, (_, i) => verticalTec(-8, 100 + i * 0.7, { ...c, seed }))
    expect(tecs(IONO_REFERENCE_SEED)).toEqual(tecs(undefined))
    expect(tecs(7)).not.toEqual(tecs(IONO_REFERENCE_SEED))
    expect(broadcastModelSlantL1(10, -2, 91, 0, IONO_REFERENCE_SEED)).toBe(broadcastModelSlantL1(10, -2, 91, 0))
    expect(broadcastModelSlantL1(10, -2, 91, 0, 7)).not.toBe(broadcastModelSlantL1(10, -2, 91, 0))
  })
  it('interpolation returns the corner value at a corner and refuses a pierce point outside the three corners left', () => {
    const mk = (lat: number, lon: number, d: number): IgpEstimate => ({ latDeg: lat, lonDeg: lon, delayM: d, givei: 3 })
    const grid = new Map([mk(-5, 90, 4), mk(-5, 95, 4), mk(0, 90, 4), mk(0, 95, 8)].map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
    expect(interpolateGrid(grid, { latDeg: -5, lonDeg: 90, obliquity: 1 })!.delayM).toBeCloseTo(4, 9)
    expect(interpolateGrid(grid, { latDeg: -2.5, lonDeg: 92.5, obliquity: 1 })!.delayM).toBeCloseTo(5, 9)
    grid.delete(igpKey(0, 95))
    // On the edge of the triangle that is left: three-point interpolation.
    expect(interpolateGrid(grid, { latDeg: -2.5, lonDeg: 92.5, obliquity: 1 })!.delayM).toBeCloseTo(4, 9)
    // Beyond it, towards the missing corner: no correction.
    expect(interpolateGrid(grid, { latDeg: -1, lonDeg: 94, obliquity: 1 })).toBeNull()
    // Two corners missing: no correction.
    grid.delete(igpKey(-5, 90))
    expect(interpolateGrid(grid, { latDeg: -4, lonDeg: 94, obliquity: 1 })).toBeNull()
  })
  // Annex 10 Vol I App B 3.5.5.5.3–3.5.5.5.4 (as read in the AI check): three-point interpolation.
  it('with one corner not monitored or missing, a pierce point in the triangle of the other three gets the three-point interpolation', () => {
    // A linear field d = 1 + 0.1·lat + 0.2·lon: any interpolation over a triangle reproduces it exactly.
    const field = (lat: number, lon: number) => 1 + 0.1 * lat + 0.2 * lon
    const corners: [number, number][] = [[40, 5], [40, 10], [45, 5], [45, 10]]
    // For each corner left out: a point inside the triangle of the three others.
    const inside: Record<string, [number, number]> = { '40,5': [44, 9], '40,10': [44, 6], '45,5': [41, 9], '45,10': [41, 6] }
    for (const [lat, lon] of corners) {
      const out = igpKey(lat, lon)
      for (const missing of ['absent', 'not monitored'] as const) {
        const grid = new Map<string, IgpEstimate>()
        for (const [la, lo] of corners) {
          const k = igpKey(la, lo)
          if (k === out && missing === 'absent') continue
          grid.set(k, { latDeg: la, lonDeg: lo, delayM: field(la, lo), givei: k === out ? GIVEI_NOT_MONITORED : 5 })
        }
        const [pLat, pLon] = inside[out]
        const r = interpolateGrid(grid, { latDeg: pLat, lonDeg: pLon, obliquity: 1 })
        expect(r, `${out} ${missing}`).not.toBeNull()
        expect(r!.delayM, `${out} ${missing}`).toBeCloseTo(field(pLat, pLon), 9)
        expect(Number.isFinite(r!.sigmaM)).toBe(true)
        // The point mirrored across the cell's diagonal is outside that triangle.
        expect(interpolateGrid(grid, { latDeg: 85 - pLat, lonDeg: 15 - pLon, obliquity: 1 }), `${out} mirrored`).toBeNull()
      }
    }
  })
  it('between 60° and 75° of latitude the cells are 5° × 10°, as the IGPs there are 10° apart in longitude', () => {
    const mk = (lat: number, lon: number, d: number): IgpEstimate => ({ latDeg: lat, lonDeg: lon, delayM: d, givei: 5 })
    const grid = new Map([mk(65, 10, 2), mk(65, 20, 4), mk(70, 10, 2), mk(70, 20, 4)].map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
    expect(interpolateGrid(grid, { latDeg: 67, lonDeg: 15, obliquity: 1 })!.delayM).toBeCloseTo(3, 9)
    // South of 60° the same IGPs 10° apart do not make a cell.
    const south = new Map([mk(45, 10, 2), mk(45, 20, 4), mk(50, 10, 2), mk(50, 20, 4)].map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
    expect(interpolateGrid(south, { latDeg: 47, lonDeg: 15, obliquity: 1 })).toBeNull()
    // Beyond 75° (the polar IGPs) the page does not interpolate.
    expect(interpolateGrid(grid, { latDeg: 78, lonDeg: 15, obliquity: 1 })).toBeNull()
  })
})
