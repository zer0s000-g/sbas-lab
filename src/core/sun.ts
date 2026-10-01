/**
 * Where the sun is in the sky over the region, for the flight view's daylight, sea glint
 * and shading. The same equinox model as the space view's day and night side
 * (declination 0, local solar time from `localSolarHour`), so both views agree.
 */
import { DEG } from './units'

/** Unit vector toward the sun in the local east-north-up frame, at a local solar hour (0–24) and latitude. */
export function sunEnu(localHour: number, latDeg: number): [number, number, number] {
  const h = (((localHour - 12) % 24) + 24) % 24 // hours after local noon
  const H = h * 15 * DEG
  const phi = latDeg * DEG
  // Declination 0: the sun moves along the celestial equator.
  const east = -Math.sin(H)
  const north = -Math.sin(phi) * Math.cos(H)
  const up = Math.cos(phi) * Math.cos(H)
  const n = Math.hypot(east, north, up) || 1
  return [east / n, north / n, up / n]
}

/** Sun elevation above the horizon, degrees (negative at night). */
export const sunElevationDeg = (localHour: number, latDeg: number) => Math.asin(Math.max(-1, Math.min(1, sunEnu(localHour, latDeg)[2]))) / DEG

/**
 * How much daylight there is, 0 (night) to 1 (full day). Civil twilight (sun 6° below
 * the horizon) counts as dark, and the light is full once the sun is 12° up.
 */
export function daylight(elevationDeg: number): number {
  const k = Math.min(1, Math.max(0, (elevationDeg + 6) / 18))
  return k * k * (3 - 2 * k)
}
