/**
 * Geometry on WGS-84: geodetic <-> ECEF <-> local east/north/up, and the azimuth,
 * elevation and range from a receiver to a satellite. Metres and radians inside,
 * degrees at the edges (CLAUDE.md "one set of units").
 */
import { DEG, M_PER_NM, WGS84_A_M, WGS84_E2 } from './units'
import { isFiniteNumber } from './guard'

export type Vec3 = [number, number, number]

export interface Geodetic {
  latDeg: number
  lonDeg: number
  /** Height above the WGS-84 ellipsoid, m. */
  hM: number
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const norm = (a: Vec3) => Math.sqrt(dot(a, a))
export const isVec3 = (v: Vec3) => isFiniteNumber(v[0]) && isFiniteNumber(v[1]) && isFiniteNumber(v[2])

/** Prime-vertical radius of curvature at a latitude, m. */
export function primeVerticalRadius(latRad: number): number {
  const s = Math.sin(latRad)
  return WGS84_A_M / Math.sqrt(1 - WGS84_E2 * s * s)
}

/** Meridian radius of curvature at a latitude, m. */
export function meridianRadius(latRad: number): number {
  const s = Math.sin(latRad)
  return (WGS84_A_M * (1 - WGS84_E2)) / Math.pow(1 - WGS84_E2 * s * s, 1.5)
}

export function geodeticToEcef({ latDeg, lonDeg, hM }: Geodetic): Vec3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const n = primeVerticalRadius(lat)
  const c = Math.cos(lat)
  return [(n + hM) * c * Math.cos(lon), (n + hM) * c * Math.sin(lon), (n * (1 - WGS84_E2) + hM) * Math.sin(lat)]
}

/** ECEF to geodetic (iterative; converges to well below a millimetre in a few steps). Null for a bad input or the Earth's centre. */
export function ecefToGeodetic([x, y, z]: Vec3): Geodetic | null {
  if (!isVec3([x, y, z])) return null
  const p = Math.hypot(x, y)
  if (p < 1 && Math.abs(z) < 1) return null
  const lon = Math.atan2(y, x)
  let lat = Math.atan2(z, p * (1 - WGS84_E2))
  let h = 0
  for (let i = 0; i < 8; i++) {
    const n = primeVerticalRadius(lat)
    h = p / Math.max(Math.cos(lat), 1e-12) - n
    lat = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + h)))
  }
  return { latDeg: lat / DEG, lonDeg: lon / DEG, hM: h }
}

/** Unit vectors east, north and up at a geodetic point, in ECEF. */
export function enuBasis(latDeg: number, lonDeg: number): { e: Vec3; n: Vec3; u: Vec3 } {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const sl = Math.sin(lat)
  const cl = Math.cos(lat)
  const so = Math.sin(lon)
  const co = Math.cos(lon)
  return { e: [-so, co, 0], n: [-sl * co, -sl * so, cl], u: [cl * co, cl * so, sl] }
}

/** An ECEF difference vector expressed in east/north/up at a reference point. */
export function ecefToEnu(d: Vec3, ref: Geodetic): Vec3 {
  const { e, n, u } = enuBasis(ref.latDeg, ref.lonDeg)
  return [dot(d, e), dot(d, n), dot(d, u)]
}

export interface LookAngles {
  azDeg: number
  elDeg: number
  rangeM: number
  /** Unit line of sight from the receiver to the satellite, east/north/up. */
  los: Vec3
}

/** Azimuth (true, 0–360), elevation and range from a receiver to a satellite. Null for bad input. */
export function lookAngles(receiver: Geodetic, satEcef: Vec3): LookAngles | null {
  if (!isVec3(satEcef) || !isFiniteNumber(receiver.latDeg) || !isFiniteNumber(receiver.lonDeg) || !isFiniteNumber(receiver.hM)) return null
  const d = sub(satEcef, geodeticToEcef(receiver))
  const rangeM = norm(d)
  if (!(rangeM > 0)) return null
  const [e, n, u] = ecefToEnu(d, receiver)
  const los: Vec3 = [e / rangeM, n / rangeM, u / rangeM]
  const azDeg = ((Math.atan2(e, n) / DEG) % 360 + 360) % 360
  const elDeg = Math.asin(Math.max(-1, Math.min(1, los[2]))) / DEG
  return { azDeg, elDeg, rangeM, los }
}

/**
 * A small local plane around a region origin, in NM east and north, for the flight.
 * It converts with the radii of curvature at the origin: over the ~100 NM of this
 * journey the error is well under a metre, far below anything the page shows.
 */
export interface LocalFrame {
  origin: Geodetic
}

export function localToGeodetic(frame: LocalFrame, eastNm: number, northNm: number, hM: number): Geodetic {
  const lat0 = frame.origin.latDeg * DEG
  const dLat = (northNm * M_PER_NM) / meridianRadius(lat0)
  const dLon = (eastNm * M_PER_NM) / (primeVerticalRadius(lat0) * Math.cos(lat0))
  return { latDeg: frame.origin.latDeg + dLat / DEG, lonDeg: frame.origin.lonDeg + dLon / DEG, hM }
}

export function geodeticToLocal(frame: LocalFrame, g: Geodetic): { eastNm: number; northNm: number } {
  const lat0 = frame.origin.latDeg * DEG
  const northNm = ((g.latDeg - frame.origin.latDeg) * DEG * meridianRadius(lat0)) / M_PER_NM
  const eastNm = ((g.lonDeg - frame.origin.lonDeg) * DEG * primeVerticalRadius(lat0) * Math.cos(lat0)) / M_PER_NM
  return { eastNm, northNm }
}
