/**
 * The flight view's sky state, computed once per frame from the journey clock and read
 * by every part of the world (sky dome, sea, clouds, lamps, lights), so all of them show
 * the same time of day. Flight-view units (1 unit = 100 m), north is −z.
 */
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { REGION, localSolarHour } from '@/core/region'
import { daylight, sunElevationDeg, sunEnu } from '@/core/sun'
import { col } from '@/stage/col'
import type { AirportLayout } from '../airports'
import { airportToLocalNm } from '../airports'
import { toFlight, type V3 } from '../scales'
import { M_PER_FT } from '@/core/units'

export interface SkyState {
  /** Unit vector toward the sun, scene axes. */
  sun: THREE.Vector3
  /** 0 night … 1 day. */
  day: number
  /** 0 … 1: how much sunrise or sunset glow the horizon has. */
  dusk: number
  zenith: THREE.Color
  horizon: THREE.Color
  sunColor: THREE.Color
  /** Seconds of wave and cloud motion (stops when the world stops or with reduced motion). */
  motionS: number
}

export interface SkyPalette {
  dayZenith: THREE.Color
  dayHorizon: THREE.Color
  nightZenith: THREE.Color
  nightHorizon: THREE.Color
  dusk: THREE.Color
  sun: THREE.Color
}

export const skyPalette = (t: ThemeTokens): SkyPalette => ({
  dayZenith: col(t, 'world-sky-zenith'),
  dayHorizon: col(t, 'world-sky-horizon'),
  nightZenith: col(t, 'world-sky-night-zenith'),
  nightHorizon: col(t, 'world-sky-night-horizon'),
  dusk: col(t, 'world-sky-dusk'),
  sun: col(t, 'world-sun'),
})

export const newSkyState = (): SkyState => ({
  sun: new THREE.Vector3(0, 1, 0),
  day: 1,
  dusk: 0,
  zenith: new THREE.Color(),
  horizon: new THREE.Color(),
  sunColor: new THREE.Color(),
  motionS: 0,
})

/** Update the sky for a journey time (s) and start hour. */
export function updateSky(s: SkyState, p: SkyPalette, worldS: number, startLocalHour: number) {
  const hour = localSolarHour(worldS, REGION.origin.lonDeg, startLocalHour)
  const [e, n, u] = sunEnu(hour, REGION.origin.latDeg)
  s.sun.set(e, u, -n)
  const el = sunElevationDeg(hour, REGION.origin.latDeg)
  s.day = daylight(el)
  s.dusk = el > -8 ? Math.max(0, 1 - Math.abs(el - 2) / 12) : 0
  s.zenith.copy(p.nightZenith).lerp(p.dayZenith, s.day)
  s.horizon.copy(p.nightHorizon).lerp(p.dayHorizon, s.day).lerp(p.dusk, s.dusk * 0.45)
  s.sunColor.copy(p.sun).lerp(p.dusk, s.dusk * 0.6)
}

/** A runway-frame point (m along, m right, m above the field) in flight-view units. */
export function raToWorld(l: AirportLayout, a: number, r: number, hM = 0): V3 {
  const [e, n] = airportToLocalNm(l.airport, a, r)
  return toFlight(e, n, l.airport.elevationFt + hM / M_PER_FT)
}
