import { describe, expect, it } from 'vitest'
import {
  bubbleDepletion,
  broadcastModelSlantL1,
  delayAt,
  estimateIgps,
  giveIndex,
  GIVEI_NOT_MONITORED,
  igpKey,
  interpolateGrid,
  isPostSunset,
  L1_M_PER_TECU,
  piercePoint,
  QUIET,
  scintillationLoss,
  verticalTec,
  type IgpEstimate,
} from '@/core/iono'
import { GPS_L5_HZ } from '@/core/units'
import { MAG_EQUATOR_LAT_DEG } from '@/core/region'

const at = (hour: number, extra = {}) => ({ ...QUIET, startLocalHour: hour, tS: 0, ...extra })

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
    const crest = verticalTec(MAG_EQUATOR_LAT_DEG - 15, 91, at(14))
    const trough = verticalTec(MAG_EQUATOR_LAT_DEG, 91, at(14))
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
  it('interpolation returns the corner value at a corner and refuses a missing corner', () => {
    const mk = (lat: number, lon: number, d: number): IgpEstimate => ({ latDeg: lat, lonDeg: lon, delayM: d, givei: 3 })
    const grid = new Map([mk(-5, 90, 4), mk(-5, 95, 4), mk(0, 90, 4), mk(0, 95, 8)].map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
    expect(interpolateGrid(grid, { latDeg: -5, lonDeg: 90, obliquity: 1 })!.delayM).toBeCloseTo(4, 9)
    expect(interpolateGrid(grid, { latDeg: -2.5, lonDeg: 92.5, obliquity: 1 })!.delayM).toBeCloseTo(5, 9)
    grid.delete(igpKey(0, 95))
    expect(interpolateGrid(grid, { latDeg: -2.5, lonDeg: 92.5, obliquity: 1 })).toBeNull()
  })
})
