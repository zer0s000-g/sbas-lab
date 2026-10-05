/**
 * GPS broadcast ephemeris to satellite position and clock (IS-GPS-200, §20.3.3.4.3 and
 * §20.3.3.3.3.1), and the Klobuchar single-frequency ionospheric model the GPS
 * navigation message carries (§20.3.3.5.2.5). Pure. Real orbits for the service-area
 * maps; the journey keeps its idealised constellation (src/core/orbits).
 */
import type { Vec3 } from './geo'
import type { GpsEphemeris, Klobuchar } from './rinex'
import { WEEK_S } from './rinex'
import { C_M_S, DEG, GPS_L1_HZ, GPS_MU_M3_S2 } from './units'

/**
 * Earth rotation rate the GPS ephemeris is defined with (IS-GPS-200 Table 20-IV). It
 * differs from WGS-84's 7.292115e-5 rad/s in the sixth digit; the broadcast orbit
 * algorithm needs this one.
 */
export const GPS_OMEGA_E_RAD_S = 7.2921151467e-5
/** Relativistic clock correction constant F = −2√μ / c², s/√m. */
const F_REL = -4.442807633e-10

/** t − t_ref, wrapped into ±half a week. */
const sinceS = (tAbsS: number, week: number, refS: number) => {
  let d = tAbsS - (week * WEEK_S + refS)
  if (d > WEEK_S / 2) d -= WEEK_S
  if (d < -WEEK_S / 2) d += WEEK_S
  return d
}

export interface SatState {
  ecef: Vec3
  /** Satellite clock offset (incl. relativity, minus T_GD for L1 C/A users), s. */
  clockS: number
}

/**
 * Satellite position (ECEF at the transmission time, in the frame of that time) and L1
 * C/A clock offset at absolute GPS time t (seconds since 1980-01-06).
 */
export function satState(eph: GpsEphemeris, tAbsS: number): SatState {
  const a = eph.sqrtA * eph.sqrtA
  const n = Math.sqrt(GPS_MU_M3_S2 / (a * a * a)) + eph.deltaN
  const tk = sinceS(tAbsS, eph.week, eph.toeS)
  const mk = eph.m0 + n * tk
  let ek = mk
  for (let k = 0; k < 12; k++) {
    const next = mk + eph.e * Math.sin(ek)
    if (Math.abs(next - ek) < 1e-14) {
      ek = next
      break
    }
    ek = next
  }
  const vk = Math.atan2(Math.sqrt(1 - eph.e * eph.e) * Math.sin(ek), Math.cos(ek) - eph.e)
  const phi = vk + eph.omega
  const s2 = Math.sin(2 * phi)
  const c2 = Math.cos(2 * phi)
  const u = phi + eph.cus * s2 + eph.cuc * c2
  const r = a * (1 - eph.e * Math.cos(ek)) + eph.crs * s2 + eph.crc * c2
  const inc = eph.i0 + eph.idot * tk + eph.cis * s2 + eph.cic * c2
  const xp = r * Math.cos(u)
  const yp = r * Math.sin(u)
  const om = eph.omega0 + (eph.omegaDot - GPS_OMEGA_E_RAD_S) * tk - GPS_OMEGA_E_RAD_S * eph.toeS
  const ecef: Vec3 = [xp * Math.cos(om) - yp * Math.cos(inc) * Math.sin(om), xp * Math.sin(om) + yp * Math.cos(inc) * Math.cos(om), yp * Math.sin(inc)]
  const dt = sinceS(tAbsS, eph.week, eph.tocS)
  const rel = F_REL * eph.e * eph.sqrtA * Math.sin(ek)
  const clockS = eph.af0 + eph.af1 * dt + eph.af2 * dt * dt + rel - eph.tgd
  return { ecef, clockS }
}

/** The ephemeris to use at time t: healthy, closest toe within 2 h (IS-GPS-200 fit interval: 4 h). */
export function pickEphemeris(list: readonly GpsEphemeris[], prn: number, tAbsS: number): GpsEphemeris | null {
  let best: GpsEphemeris | null = null
  let bestD = Infinity
  for (const e of list) {
    if (e.prn !== prn || e.health !== 0) continue
    const d = Math.abs(sinceS(tAbsS, e.week, e.toeS))
    if (d <= 7200 + 1 && d < bestD) {
      best = e
      bestD = d
    }
  }
  return best
}

/** Rotates a satellite position for the Earth's rotation during the signal's travel time. */
export function sagnac(ecef: Vec3, travelS: number): Vec3 {
  const th = GPS_OMEGA_E_RAD_S * travelS
  const c = Math.cos(th)
  const s = Math.sin(th)
  return [c * ecef[0] + s * ecef[1], -s * ecef[0] + c * ecef[1], ecef[2]]
}

/**
 * Klobuchar L1 slant ionospheric delay, m (IS-GPS-200 §20.3.3.5.2.5). Angles in the
 * algorithm are in semicircles; t is GPS seconds of day.
 */
export function klobucharM(k: Klobuchar, latDeg: number, lonDeg: number, azDeg: number, elDeg: number, gpsSecOfDay: number): number {
  const el = elDeg / 180
  const psi = 0.0137 / (el + 0.11) - 0.022
  let phiI = latDeg / 180 + psi * Math.cos(azDeg * DEG)
  phiI = Math.max(-0.416, Math.min(0.416, phiI))
  const lamI = lonDeg / 180 + (psi * Math.sin(azDeg * DEG)) / Math.cos(phiI * Math.PI)
  const phiM = phiI + 0.064 * Math.cos((lamI - 1.617) * Math.PI)
  let t = 43200 * lamI + gpsSecOfDay
  t = ((t % 86400) + 86400) % 86400
  const fSlant = 1 + 16 * (0.53 - el) ** 3
  let amp = 0
  let per = 0
  for (let n = 0; n < 4; n++) {
    amp += k.alpha[n] * phiM ** n
    per += k.beta[n] * phiM ** n
  }
  amp = Math.max(0, amp)
  per = Math.max(72000, per)
  const x = (2 * Math.PI * (t - 50400)) / per
  const delayS = Math.abs(x) < 1.57 ? fSlant * (5e-9 + amp * (1 - x * x / 2 + x ** 4 / 24)) : fSlant * 5e-9
  return delayS * C_M_S
}

/** L1 wavelength, m (for reference in tests and the docs). */
export const L1_WAVELENGTH_M = C_M_S / GPS_L1_HZ
