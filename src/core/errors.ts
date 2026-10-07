/**
 * The range error of one satellite, broken into its parts: satellite clock, orbit
 * (ephemeris), ionosphere, troposphere, multipath and receiver noise (docs/SBAS_CONTENT.md,
 * "The chain" 2). Every part is a pure function of (seed, satellite, time), so jumping
 * to a moment gives exactly the same errors as playing up to it.
 *
 * Sizes are illustrative, chosen to be typical rather than worst case; the true
 * errors are drawn smaller than the σ the receiver assumes, so the protection levels
 * bound them in the nominal case, as they must.
 */
import { DEG, GPS_L1_HZ, GPS_L5_HZ } from './units'
import { hash2 } from './random'

/** A deterministic, smoothly varying Gaussian-like process with standard deviation ≈ sigma and correlation time tau. */
export function smoothGauss(code: number, tS: number, tauS: number, sigma: number, seed: number): number {
  if (!Number.isFinite(tS)) return 0
  const x = tS / tauS
  const k = Math.floor(x)
  const f = x - k
  const g = (i: number) => {
    const u1 = Math.max(hash2(code, i, seed), 1e-12)
    const u2 = hash2(code, i, seed + 101)
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
  // Smoothstep between independent knots; scaled back up to keep the variance near sigma².
  const s = f * f * (3 - 2 * f)
  const a = g(k)
  const b = g(k + 1)
  const v = a * (1 - s) + b * s
  const norm = Math.sqrt((1 - s) ** 2 + s * s)
  return (v / norm) * sigma
}

export function satCode(id: string): number {
  let code = 7
  for (let i = 0; i < id.length; i++) code = (code * 31 + id.charCodeAt(i)) >>> 0
  return code
}

// TODO(expert-review): illustrative sizes of the GPS broadcast clock and orbit errors along the line of sight (1σ, m).
export const SIGMA_CLOCK_M = 1.1
export const SIGMA_ORBIT_M = 0.8

/** Tropospheric mapping function (the one of the RTCA DO-229 tropospheric model; the zenith delay below is the page's own). */
// TODO(expert-review): DO-229 Appendix A tropospheric model: m(E) = 1.001 / sqrt(0.002001 + sin²E), σ_tvu = 0.12 m.
export function tropoMapping(elDeg: number): number {
  const s = Math.sin(Math.max(elDeg, 0) * DEG)
  return 1.001 / Math.sqrt(0.002001 + s * s)
}
export const SIGMA_TROPO_VERTICAL_M = 0.12
/**
 * Zenith tropospheric delay at sea level the receiver model assumes, m: a fixed value
 * scaled with height (exp(−h/7000 m)), a simplification of the DO-229 model, whose
 * zenith delay depends on latitude, season and height.
 */
export const TROPO_ZENITH_MODEL_M = 2.4

/** Airborne multipath σ, m, by elevation. */
// TODO(expert-review): DO-229 airborne multipath model σ_mp = 0.13 + 0.53·exp(−θ/10°) m; receiver noise σ_noise = 0.36 m (AAD-A-like).
export const sigmaMultipathM = (elDeg: number) => 0.13 + 0.53 * Math.exp(-Math.max(elDeg, 0) / 10)
export const SIGMA_NOISE_M = 0.36
export const sigmaAirL1M = (elDeg: number) => Math.hypot(sigmaMultipathM(elDeg), SIGMA_NOISE_M)

/**
 * The ionosphere-free combination of L1 and L5 removes the first-order ionospheric
 * delay but amplifies multipath and noise. With independent, equal noise on the two
 * frequencies the factor is √(γ² + 1)/(γ − 1) with γ = (f1/f5)² ≈ 1.79, which gives
 * ≈ 2.59: the "about 2.6" of Doc 9849 §5.2.1.6.
 */
export const IF_GAMMA = (GPS_L1_HZ / GPS_L5_HZ) ** 2
export const IF_NOISE_FACTOR = Math.sqrt(IF_GAMMA ** 2 + 1) / (IF_GAMMA - 1)

/** Share of the assumed σ the true errors are drawn with: the model bounds the truth. */
const TRUTH_SHARE = 0.7

export interface SatErrorParts {
  /** Satellite clock error after the broadcast clock correction, m. */
  clockM: number
  /** Orbit (ephemeris) error projected on the line of sight, m. */
  orbitM: number
  /** True tropospheric slant delay, m. */
  tropoM: number
  /** Multipath and noise on L1 and on L5, m. */
  mpNoiseL1M: number
  mpNoiseL5M: number
}

export interface FaultInjection {
  /** Satellite clock jump (the "satellite clock jump" failure). */
  satId: string
  startS: number
  jumpM: number
}

/** The errors that do not depend on the ionosphere, for one satellite seen from one receiver. */
export function satErrors(satId: string, elDeg: number, heightM: number, tS: number, seed: number, receiverKey = 0, fault?: FaultInjection | null): SatErrorParts {
  const code = satCode(satId)
  let clockM = smoothGauss(code, tS, 900, SIGMA_CLOCK_M * TRUTH_SHARE, seed)
  if (fault && fault.satId === satId && tS >= fault.startS) clockM += fault.jumpM
  const orbitM = smoothGauss(code, tS, 1800, SIGMA_ORBIT_M * TRUTH_SHARE, seed + 1)
  const scaleHeight = Math.exp(-Math.max(heightM, 0) / 7000)
  // The truth differs a little from the receiver's model (weather).
  const zenith = (TROPO_ZENITH_MODEL_M + smoothGauss(code >>> 3, tS, 3600, SIGMA_TROPO_VERTICAL_M * TRUTH_SHARE, seed + 2)) * scaleHeight
  const tropoM = zenith * tropoMapping(elDeg)
  const rcv = code + receiverKey * 7919
  const mpNoiseL1M = smoothGauss(rcv, tS, 6, sigmaAirL1M(elDeg) * TRUTH_SHARE, seed + 3)
  const mpNoiseL5M = smoothGauss(rcv, tS, 6, sigmaAirL1M(elDeg) * TRUTH_SHARE, seed + 4)
  return { clockM, orbitM, tropoM, mpNoiseL1M, mpNoiseL5M }
}

/** The receiver's tropospheric model delay, m. */
export const tropoModelM = (elDeg: number, heightM: number) => TROPO_ZENITH_MODEL_M * Math.exp(-Math.max(heightM, 0) / 7000) * tropoMapping(elDeg)
