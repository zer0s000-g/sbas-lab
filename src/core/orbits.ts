/**
 * A simplified GPS constellation and the SBAS GEO satellites, as positions in ECEF
 * over time.
 *
 * GPS (Doc 9849 §3.2.2): a nominal 24 satellites in six orbital planes, near-circular
 * orbits at about 20 200 km altitude, 55° inclination, one orbit in about 12 hours.
 * The model uses exactly circular orbits and evenly spaced slots (a Walker 24/6/1
 * pattern); the real slots are not evenly spaced.
 *
 * SBAS GEOs sit over the equator at a fixed longitude (Doc 9849 §4.3.1.2). Which GEOs
 * the receiver tracks is the scenario's (src/scenarios/<id>/geos.ts): Japan's Michibiki
 * satellites QZS-3 and QZS-6 in the AirNav Indonesia scenario, the EGNOS GEOs in the
 * ESSP-SAS scenario.
 */
import { DEG, GPS_MU_M3_S2, WGS84_A_M, WGS84_OMEGA_E_RAD_S } from './units'
import type { Vec3 } from './geo'
import { SCENARIO } from '@/scenarios/active'

/** GPS nominal altitude, m (Doc 9849 §3.2.2). */
export const GPS_ALTITUDE_M = 20_200e3
/** GPS orbital inclination, degrees (Doc 9849 §3.2.2). */
export const GPS_INCLINATION_DEG = 55
export const GPS_PLANES = 6
export const GPS_SLOTS_PER_PLANE = 4
/** Orbit radius, m (the altitude above the equatorial radius). */
export const GPS_RADIUS_M = WGS84_A_M + GPS_ALTITUDE_M
/** Orbital period from Kepler's third law, s (about 11 h 58 min). */
export const GPS_PERIOD_S = 2 * Math.PI * Math.sqrt(GPS_RADIUS_M ** 3 / GPS_MU_M3_S2)

/** Geostationary orbit radius, m: the circular orbit whose period equals one Earth rotation. */
export const GEO_RADIUS_M = Math.cbrt(GPS_MU_M3_S2 / WGS84_OMEGA_E_RAD_S ** 2)
export const GEO_ALTITUDE_M = GEO_RADIUS_M - WGS84_A_M

export type SatKind = 'gps' | 'geo'

export interface SatDef {
  /** Stable id: "G01".."G24" for GPS; the SBAS GEOs by name, e.g. "QZS-3" or "PRN 136". */
  id: string
  /** GEO: the name shown, and the SBAS PRN it broadcasts. */
  name?: string
  prn?: number
  kind: SatKind
  /** GPS: plane letter A–F and the slot's argument of latitude at t = 0. */
  plane?: string
  raanDeg?: number
  argLat0Deg?: number
  /** GEO: the fixed longitude. */
  lonDeg?: number
  /** Broadcasts on L5 as well as L1. */
  l5: boolean
}

// TODO(expert-review): real GPS slot phasing is uneven (IS-GPS / SPS PS almanac); an even Walker 24/6/1 pattern is used here.
const PLANE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
/** Rotates the whole constellation so the journey starts with a typical geometry over the scenario's region. */
// TODO(expert-review): the operational constellation has about 31 satellites; with the nominal 24, GPS-alone RAIM
// gaps are more frequent than in reality, so each scenario's epoch is chosen for a typical approach (scenarios/*/geos.ts).
const EPOCH_RAAN_DEG = SCENARIO.gpsEpochRaanDeg

export const GPS_SATS: readonly SatDef[] = PLANE_LETTERS.flatMap((plane, p) =>
  Array.from({ length: GPS_SLOTS_PER_PLANE }, (_, s): SatDef => ({
    id: `G${String(p * GPS_SLOTS_PER_PLANE + s + 1).padStart(2, '0')}`,
    kind: 'gps',
    plane,
    raanDeg: EPOCH_RAAN_DEG + p * (360 / GPS_PLANES),
    // Walker 24/6/1: 90° between slots in a plane, 15° phase step between planes.
    argLat0Deg: s * (360 / GPS_SLOTS_PER_PLANE) + p * 15,
    // TODO(expert-review): not every GPS satellite broadcasts L5 today; the model assumes all do.
    l5: true,
  })),
)

/** The SBAS GEOs of the active scenario. */
export const GEO_SATS: readonly SatDef[] = SCENARIO.geos

/** A GEO's short label, e.g. "QZS-3 · PRN 137". */
export const geoLabel = (g: SatDef) => (g.prn ? `${g.id} · PRN ${g.prn}` : g.id)

export const ALL_SATS: readonly SatDef[] = [...GPS_SATS, ...GEO_SATS]

/** ECEF position of a satellite at time t (s since the journey epoch). */
export function satEcef(sat: SatDef, tS: number): Vec3 {
  if (sat.kind === 'geo') {
    const lon = (sat.lonDeg ?? 0) * DEG
    return [GEO_RADIUS_M * Math.cos(lon), GEO_RADIUS_M * Math.sin(lon), 0]
  }
  const u = (sat.argLat0Deg ?? 0) * DEG + ((2 * Math.PI) / GPS_PERIOD_S) * tS
  const inc = GPS_INCLINATION_DEG * DEG
  // Right ascension of the node, seen from the rotating Earth.
  const node = (sat.raanDeg ?? 0) * DEG - WGS84_OMEGA_E_RAD_S * tS
  const xp = GPS_RADIUS_M * Math.cos(u)
  const yp = GPS_RADIUS_M * Math.sin(u)
  return [xp * Math.cos(node) - yp * Math.cos(inc) * Math.sin(node), xp * Math.sin(node) + yp * Math.cos(inc) * Math.cos(node), yp * Math.sin(inc)]
}
