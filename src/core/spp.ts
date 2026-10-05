/**
 * GPS-alone single-point positioning from real L1 C/A pseudoranges: broadcast orbits
 * and clocks (./ephemeris), the Klobuchar ionospheric model, the DO-229 tropospheric
 * model (./errors), Earth-rotation correction, and an iterated weighted least-squares
 * fix for position and receiver clock. Pure. This is what a GPS-only receiver at a
 * reference station computes; its error against the surveyed position is the real
 * GPS-alone accuracy the service-area maps show next to their protection levels.
 */
import { ecefToEnu, ecefToGeodetic, lookAngles, norm, sub, type Geodetic, type Vec3 } from './geo'
import { klobucharM, pickEphemeris, sagnac, satState } from './ephemeris'
import { WEEK_S, type GpsEphemeris, type Klobuchar } from './rinex'
import { tropoModelM } from './errors'
import { C_M_S } from './units'
import { invert } from './linalg'

export interface SppResult {
  ecef: Vec3
  geodetic: Geodetic
  /** Receiver clock offset, m. */
  clockM: number
  used: number[]
  /** Unit vectors to the satellites used, ENU, with elevations (for protection levels). */
  los: { prn: number; los: Vec3; elDeg: number; azDeg: number }[]
}

const MASK_DEG = 5

/**
 * Solves a GPS-alone fix at receiver time tAbsS from pseudoranges (PRN → m). Starts from
 * `guess` (the station's approximate position, or the Earth's centre). Null with fewer
 * than four usable satellites or when the iteration does not converge.
 */
export function solveSpp(tAbsS: number, c1: ReadonlyMap<number, number>, ephs: readonly GpsEphemeris[], klob: Klobuchar | null, guess: Vec3 = [0, 0, 0]): SppResult | null {
  let x: number[] = [guess[0], guess[1], guess[2], 0]
  let used: number[] = []
  let los: SppResult['los'] = []
  for (let iter = 0; iter < 10; iter++) {
    const rows: number[][] = []
    const res: number[] = []
    const w: number[] = []
    used = []
    los = []
    const rx: Vec3 = [x[0], x[1], x[2]]
    const geo = norm(rx) > 6e6 ? ecefToGeodetic(rx) : null
    for (const [prn, pr] of c1) {
      const eph = pickEphemeris(ephs, prn, tAbsS)
      if (!eph) continue
      // Transmission time from the pseudorange, then the satellite there, rotated into the frame of reception.
      let tx = tAbsS - pr / C_M_S
      let st = satState(eph, tx)
      tx -= st.clockS
      st = satState(eph, tx)
      const travel = norm(sub(st.ecef, rx)) / C_M_S
      const satPos = sagnac(st.ecef, geo ? travel : pr / C_M_S)
      const d = sub(satPos, rx)
      const range = norm(d)
      let iono = 0
      let tropo = 0
      let wt = 1
      if (geo) {
        const look = lookAngles(geo, satPos)
        if (!look || look.elDeg < MASK_DEG) continue
        const sod = (((tAbsS % WEEK_S) % 86400) + 86400) % 86400
        iono = klob ? klobucharM(klob, geo.latDeg, geo.lonDeg, look.azDeg, look.elDeg, sod) : 0
        tropo = tropoModelM(look.elDeg, geo.hM)
        wt = Math.sin(look.elDeg * (Math.PI / 180)) ** 2
        los.push({ prn, los: look.los, elDeg: look.elDeg, azDeg: look.azDeg })
      }
      const predicted = range + x[3] - C_M_S * st.clockS + iono + tropo
      rows.push([-d[0] / range, -d[1] / range, -d[2] / range, 1])
      res.push(pr - predicted)
      w.push(wt)
      used.push(prn)
    }
    if (rows.length < 4) return null
    // Normal equations HᵀWH dx = HᵀW r.
    const n = 4
    const A = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
    const b = Array.from({ length: n }, () => 0)
    for (let k = 0; k < rows.length; k++)
      for (let i = 0; i < n; i++) {
        b[i] += rows[k][i] * w[k] * res[k]
        for (let j = 0; j < n; j++) A[i][j] += rows[k][i] * w[k] * rows[k][j]
      }
    const inv = invert(A)
    if (!inv) return null
    const dx = inv.map((row) => row.reduce((s, v, j) => s + v * b[j], 0))
    if (!dx.every(Number.isFinite)) return null
    x = x.map((v, i) => v + dx[i])
    if (Math.hypot(dx[0], dx[1], dx[2]) < 1e-3) {
      const ecef: Vec3 = [x[0], x[1], x[2]]
      const geodetic = ecefToGeodetic(ecef)
      if (!geodetic || !geo) continue
      return { ecef, geodetic, clockM: x[3], used, los }
    }
  }
  return null
}

/** Horizontal and vertical error of a fix against the surveyed position, m. */
export function fixError(fix: Vec3, truth: Vec3): { hM: number; vM: number } | null {
  const g = ecefToGeodetic(truth)
  if (!g) return null
  const enu = ecefToEnu(sub(fix, truth), g)
  return { hM: Math.hypot(enu[0], enu[1]), vM: enu[2] }
}
