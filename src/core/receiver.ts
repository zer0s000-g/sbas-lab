/**
 * The aircraft receiver: from the satellites' measurements to a position error, the
 * dilution of precision and the protection levels, in three modes that share the
 * same measurements (so the page can compare them honestly):
 *
 * - "abas": GPS alone with the broadcast ionospheric model and receiver autonomous
 *   integrity monitoring with fault detection and exclusion (RAIM/FDE, Doc 9849 §4.2).
 *   No vertical protection level: ABAS supports approaches down to LNAV (§1.4.2.2).
 * - "l1sbas": L1 SBAS: clock/orbit corrections bounded by UDRE, the ionospheric grid
 *   bounded by GIVE (§4.3.2.3–4.3.2.4).
 * - "dfmc": dual-frequency SBAS: the ionosphere-free L1/L5 combination removes the
 *   ionospheric delay; corrections bounded by DFRE; noise amplified by about 2.6
 *   (§4.3.1.4.1, §4.3.2.3.1, §5.2.1.6).
 *
 * The solution is the weighted least-squares solution linearised at the true position:
 * the position error is S·ε, where ε are the range errors and S the weighted
 * pseudo-inverse of the geometry. Protection levels follow the SBAS form
 * HPL = K_H·d_major and VPL = K_V·d_V from the weighted covariance (§4.3.2.4).
 */
import type { Vec3 } from './geo'
import { invert, multiply, transpose, type Matrix } from './linalg'
import { isFiniteNumber } from './guard'

export type ReceiverMode = 'abas' | 'l1sbas' | 'dfmc'

export interface Measurement {
  satId: string
  /** Line of sight to the satellite, east/north/up unit vector. */
  los: Vec3
  elDeg: number
  /** Range error left after the mode's corrections, m (what the solution sees). */
  errorM: number
  /** σ the receiver assumes for that error, m. */
  sigmaM: number
}

// TODO(expert-review): K factors (RTCA DO-229 / Annex 10 Appendix B): K_H,PA = 6.0, K_H,NPA = 6.18, K_V,PA = 5.33.
export const K_H_PA = 6.0
export const K_H_NPA = 6.18
export const K_V_PA = 5.33

export interface Fix {
  mode: ReceiverMode
  /** Position error, m, east/north/up. */
  errorEnu: Vec3
  horizontalErrorM: number
  verticalErrorM: number
  hdop: number
  vdop: number
  pdop: number
  /** Protection levels, m. VPL null where the mode gives none (ABAS). */
  hplM: number
  vplM: number | null
  used: string[]
  excluded: string[]
  /** RAIM/FDE detected an inconsistency it could not exclude (ABAS). */
  alarm: boolean
}

/** Fewer than four usable satellites: no position ("no fix"). */
export type FixResult = Fix | null

interface Solution {
  s: Matrix
  cov: Matrix
  dop: Matrix
  dx: number[]
}

function geometry(meas: readonly Measurement[]): Matrix {
  return meas.map((m) => [-m.los[0], -m.los[1], -m.los[2], 1])
}

function solveWls(meas: readonly Measurement[]): Solution | null {
  if (meas.length < 4) return null
  const g = geometry(meas)
  const gt = transpose(g)
  const w = meas.map((m) => 1 / Math.max(m.sigmaM, 1e-3) ** 2)
  const gtw = gt.map((row) => row.map((v, j) => v * w[j]))
  const cov = invert(multiply(gtw, g))
  const dop = invert(multiply(gt, g))
  if (!cov || !dop) return null
  const s = multiply(cov, gtw)
  const eps = meas.map((m) => [m.errorM])
  const dx = multiply(s, eps).map((r) => r[0])
  if (!dx.every(isFiniteNumber)) return null
  return { s, cov, dop, dx }
}

/** The semi-major axis of the horizontal error ellipse from the covariance, m. */
export function dMajor(cov: Matrix): number {
  const de2 = cov[0][0]
  const dn2 = cov[1][1]
  const den = cov[0][1]
  return Math.sqrt((de2 + dn2) / 2 + Math.sqrt(((de2 - dn2) / 2) ** 2 + den * den))
}

// TODO(expert-review): RAIM/FDE thresholds are illustrative: χ² quantiles for Pfa ≈ 1e-5 by degrees of freedom, and the matching √λ (pbias) for the missed-detection probability.
/** Detection threshold on the test statistic: the χ² quantile for a false-alarm probability of 1e-5 per epoch, by degrees of freedom (n − 4). */
export const CHI2_THRESHOLD = [0, 19.5, 23.0, 25.9, 28.5, 30.9, 33.1, 35.3, 37.3, 39.3, 41.3]
/**
 * √λ: the non-centrality at which a fault reaches the threshold above with a
 * missed-detection probability of 1e-3 (non-central χ², same degrees of freedom). The
 * RAIM HPL is the largest slope times this.
 */
export const PBIAS = [0, 7.51, 7.81, 8.02, 8.2, 8.35, 8.49, 8.61, 8.72, 8.83, 8.92]
const tableAt = (t: readonly number[], dof: number) => t[Math.min(Math.max(dof, 1), t.length - 1)]

function testStatistic(meas: readonly Measurement[], sol: Solution): number {
  // Weighted sum of squared residuals: residual = ε − G·dx.
  const g = geometry(meas)
  let q = 0
  meas.forEach((m, i) => {
    const pred = g[i][0] * sol.dx[0] + g[i][1] * sol.dx[1] + g[i][2] * sol.dx[2] + g[i][3] * sol.dx[3]
    q += (m.errorM - pred) ** 2 / Math.max(m.sigmaM, 1e-3) ** 2
  })
  return q
}

/** RAIM horizontal protection level (weighted slope method): the largest horizontal error an undetected single fault could cause. */
function raimHpl(meas: readonly Measurement[], sol: Solution): number {
  const n = meas.length
  if (n < 5) return Infinity
  const g = geometry(meas)
  let maxSlope = 0
  for (let i = 0; i < n; i++) {
    // Diagonal of the hat matrix P = G·S.
    let pii = 0
    for (let k = 0; k < 4; k++) pii += g[i][k] * sol.s[k][i]
    const denom = 1 - pii
    if (denom <= 1e-9) return Infinity
    const slope = (Math.hypot(sol.s[0][i], sol.s[1][i]) * meas[i].sigmaM) / Math.sqrt(denom)
    maxSlope = Math.max(maxSlope, slope)
  }
  return maxSlope * tableAt(PBIAS, n - 4)
}

function build(mode: ReceiverMode, meas: readonly Measurement[], sol: Solution, excluded: string[], alarm: boolean, pa: boolean): Fix {
  const [e, n, u] = sol.dx
  const hdop = Math.sqrt(sol.dop[0][0] + sol.dop[1][1])
  const vdop = Math.sqrt(sol.dop[2][2])
  const hplM = mode === 'abas' ? raimHpl(meas, sol) : (pa ? K_H_PA : K_H_NPA) * dMajor(sol.cov)
  const vplM = mode === 'abas' ? null : K_V_PA * Math.sqrt(sol.cov[2][2])
  return {
    mode,
    errorEnu: [e, n, u],
    horizontalErrorM: Math.hypot(e, n),
    verticalErrorM: Math.abs(u),
    hdop,
    vdop,
    pdop: Math.hypot(hdop, vdop),
    hplM,
    vplM,
    used: meas.map((m) => m.satId),
    excluded,
    alarm,
  }
}

/**
 * Solve one epoch. For ABAS, fault detection and exclusion: when the residuals are
 * inconsistent and at least six satellites are in view, the satellite whose removal
 * makes them consistent again is excluded (§4.2.1.3). `pa` selects the precision
 * approach K factor for SBAS modes.
 */
export function solveFix(mode: ReceiverMode, meas: readonly Measurement[], opts: { pa?: boolean } = {}): FixResult {
  const clean = meas.filter((m) => isFiniteNumber(m.errorM) && isFiniteNumber(m.sigmaM) && m.sigmaM > 0 && Number.isFinite(m.sigmaM) && m.los.every(isFiniteNumber))
  const sol = solveWls(clean)
  if (!sol) return null
  const pa = opts.pa ?? false
  if (mode !== 'abas' || clean.length < 5) return build(mode, clean, sol, [], false, pa)
  const q = testStatistic(clean, sol)
  if (q <= tableAt(CHI2_THRESHOLD, clean.length - 4)) return build(mode, clean, sol, [], false, pa)
  if (clean.length < 6) return build(mode, clean, sol, [], true, pa)
  let best: { meas: Measurement[]; sol: Solution; q: number; id: string } | null = null
  for (const m of clean) {
    const rest = clean.filter((x) => x !== m)
    const s2 = solveWls(rest)
    if (!s2) continue
    const q2 = testStatistic(rest, s2)
    if (!best || q2 < best.q) best = { meas: rest, sol: s2, q: q2, id: m.satId }
  }
  if (!best || best.q > tableAt(CHI2_THRESHOLD, best.meas.length - 4)) return build(mode, clean, sol, [], true, pa)
  return build(mode, best.meas, best.sol, [best.id], false, pa)
}

/** The approach mode the avionics annunciate: the highest level of service supported (Doc 9849 §4.3.2.5). */
export type ApproachMode = 'LPV' | 'LNAV/VNAV' | 'LNAV' | 'NONE'
