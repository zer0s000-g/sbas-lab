/**
 * RINEX 3 readers for what the service-area maps need: the GPS broadcast ephemeris and
 * Klobuchar coefficients from a navigation file, and the GPS L1 C/A pseudoranges from
 * an observation file. Pure; text in, records out. Times are GPS seconds of the week
 * with the GPS week, as the ephemeris uses them.
 */
import { ecefToGeodetic, enuBasis } from './geo'

export interface GpsEphemeris {
  prn: number
  /** Time of clock: GPS week and seconds of week. */
  week: number
  tocS: number
  af0: number
  af1: number
  af2: number
  iode: number
  crs: number
  deltaN: number
  m0: number
  cuc: number
  e: number
  cus: number
  sqrtA: number
  toeS: number
  cic: number
  omega0: number
  cis: number
  i0: number
  crc: number
  omega: number
  omegaDot: number
  idot: number
  /** SV health (0 = healthy). */
  health: number
  tgd: number
  iodc: number
}

export interface Klobuchar {
  alpha: readonly [number, number, number, number]
  beta: readonly [number, number, number, number]
}

export interface NavFile {
  ephemerides: GpsEphemeris[]
  klobuchar: Klobuchar | null
}

const num = (s: string) => Number(s.trim().replace(/[dD]/, 'E'))

/** Seconds since the GPS epoch (1980-01-06) of a calendar time in GPS time. */
export function gpsSeconds(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  return (Date.UTC(y, mo - 1, d, h, mi, 0) - Date.UTC(1980, 0, 6)) / 1000 + s
}

export const WEEK_S = 604800

/** Reads a RINEX 3 navigation file (mixed or GPS); keeps the GPS records. */
export function parseNav(text: string): NavFile {
  const lines = text.split(/\r?\n/)
  let i = 0
  const alpha: number[] = []
  const beta: number[] = []
  for (; i < lines.length; i++) {
    const l = lines[i]
    const label = l.slice(60).trim()
    if (label === 'IONOSPHERIC CORR') {
      const vals = [l.slice(5, 17), l.slice(17, 29), l.slice(29, 41), l.slice(41, 53)].map(num)
      if (l.startsWith('GPSA')) alpha.push(...vals)
      if (l.startsWith('GPSB')) beta.push(...vals)
    }
    if (label === 'END OF HEADER') {
      i++
      break
    }
  }
  const ephemerides: GpsEphemeris[] = []
  while (i < lines.length) {
    const l = lines[i]
    const sys = l[0]
    if (!sys || sys === ' ') {
      i++
      continue
    }
    const nLines = sys === 'R' || sys === 'S' ? 4 : 8
    if (sys !== 'G') {
      i += nLines
      continue
    }
    const rec = lines.slice(i, i + 8)
    i += 8
    if (rec.length < 8) break
    const f = (row: number, col: number) => num(rec[row].slice(4 + 19 * col, 23 + 19 * col))
    const y = Number(l.slice(4, 8))
    const tocAbs = gpsSeconds(y, Number(l.slice(9, 11)), Number(l.slice(12, 14)), Number(l.slice(15, 17)), Number(l.slice(18, 20)), Number(l.slice(21, 23)))
    const week = Math.floor(tocAbs / WEEK_S)
    const eph: GpsEphemeris = {
      prn: Number(l.slice(1, 3)),
      week,
      tocS: tocAbs - week * WEEK_S,
      af0: num(l.slice(23, 42)),
      af1: num(l.slice(42, 61)),
      af2: num(l.slice(61, 80)),
      iode: f(1, 0),
      crs: f(1, 1),
      deltaN: f(1, 2),
      m0: f(1, 3),
      cuc: f(2, 0),
      e: f(2, 1),
      cus: f(2, 2),
      sqrtA: f(2, 3),
      toeS: f(3, 0),
      cic: f(3, 1),
      omega0: f(3, 2),
      cis: f(3, 3),
      i0: f(4, 0),
      crc: f(4, 1),
      omega: f(4, 2),
      omegaDot: f(4, 3),
      idot: f(5, 0),
      health: f(6, 1),
      tgd: f(6, 2),
      iodc: f(6, 3),
    }
    if ([eph.sqrtA, eph.e, eph.toeS, eph.m0].every(Number.isFinite)) ephemerides.push(eph)
  }
  const klobuchar = alpha.length === 4 && beta.length === 4 ? { alpha: alpha as unknown as Klobuchar['alpha'], beta: beta as unknown as Klobuchar['beta'] } : null
  return { ephemerides, klobuchar }
}

export interface ObsEpoch {
  /** Seconds since the GPS epoch (receiver time). */
  tS: number
  /** GPS PRN → L1 C/A pseudorange, m. */
  c1: Map<number, number>
}

export interface ObsFile {
  marker: string
  /** APPROX POSITION XYZ, m (ECEF): the marker. */
  approxXyz: [number, number, number]
  /** ANTENNA: DELTA H/E/N, m: the antenna reference point above (and east, north of) the marker. */
  antennaDeltaHen: [number, number, number]
  epochs: ObsEpoch[]
}

/**
 * Reads a RINEX 3 observation file: the marker, its position and the GPS C1C
 * pseudoranges. `everyS` keeps one epoch in that many seconds (the maps need 5 min).
 */
export function parseObs(text: string, everyS = 1): ObsFile {
  const lines = text.split(/\r?\n/)
  let marker = ''
  let approx: [number, number, number] = [0, 0, 0]
  let delta: [number, number, number] = [0, 0, 0]
  let gpsTypes: string[] = []
  let i = 0
  let want = 0
  for (; i < lines.length; i++) {
    const l = lines[i]
    const label = l.slice(60).trim()
    if (label === 'MARKER NAME') marker = l.slice(0, 60).trim()
    if (label === 'APPROX POSITION XYZ') approx = [num(l.slice(0, 14)), num(l.slice(14, 28)), num(l.slice(28, 42))]
    if (label === 'ANTENNA: DELTA H/E/N') delta = [num(l.slice(0, 14)), num(l.slice(14, 28)), num(l.slice(28, 42))]
    if (label === 'SYS / # / OBS TYPES') {
      if (l[0] === 'G') {
        want = Number(l.slice(3, 6))
        gpsTypes = []
      }
      if (l[0] === 'G' || (l[0] === ' ' && gpsTypes.length < want)) {
        for (let k = 0; k < 13 && gpsTypes.length < want; k++) {
          const t = l.slice(7 + 4 * k, 10 + 4 * k).trim()
          if (t) gpsTypes.push(t)
        }
      } else if (l[0] !== ' ') want = gpsTypes.length
    }
    if (label === 'END OF HEADER') {
      i++
      break
    }
  }
  const c1Index = gpsTypes.indexOf('C1C')
  const epochs: ObsEpoch[] = []
  while (i < lines.length) {
    const l = lines[i++]
    if (!l.startsWith('>')) continue
    const n = Number(l.slice(32, 35))
    const flag = Number(l.slice(31, 32))
    if (flag > 1) {
      i += n
      continue
    }
    const tS = gpsSeconds(Number(l.slice(2, 6)), Number(l.slice(7, 9)), Number(l.slice(10, 12)), Number(l.slice(13, 15)), Number(l.slice(16, 18)), Number(l.slice(18, 29)))
    const keep = Math.abs(tS / everyS - Math.round(tS / everyS)) < 1e-6
    const c1 = new Map<number, number>()
    for (let k = 0; k < n; k++) {
      const d = lines[i++] ?? ''
      if (!keep || d[0] !== 'G' || c1Index < 0) continue
      const v = Number(d.slice(3 + 16 * c1Index, 17 + 16 * c1Index))
      if (v > 1.5e7 && v < 3e7) c1.set(Number(d.slice(1, 3)), v)
    }
    if (keep) epochs.push({ tS, c1 })
  }
  return { marker, approxXyz: approx, antennaDeltaHen: delta, epochs }
}

/**
 * The antenna reference point, ECEF m: the marker position of the header plus the
 * antenna height and offsets (ANTENNA: DELTA H/E/N). A fix from the station's
 * pseudoranges is a fix of the antenna, so it is compared with this point.
 */
export function antennaPosition(obs: Pick<ObsFile, 'approxXyz' | 'antennaDeltaHen'>): [number, number, number] {
  const g = ecefToGeodetic(obs.approxXyz)
  if (!g) return obs.approxXyz
  const { e, n, u } = enuBasis(g.latDeg, g.lonDeg)
  const [h, de, dn] = obs.antennaDeltaHen
  return [0, 1, 2].map((i) => obs.approxXyz[i] + h * u[i] + de * e[i] + dn * n[i]) as [number, number, number]
}
