/**
 * The region of the active scenario (src/scenarios): the local flight frame, the two
 * airports, the SBAS ground segment, the clock at the gate, and the geometry shared by
 * every scenario (the magnetic equator, solar and civil time, the runway frame).
 *
 * What is real and what is not is the scenario's to say (CLAUDE.md, design.md §6): see
 * src/scenarios/indonesia/region.ts (a what-if Indonesian SBAS) and
 * src/scenarios/essp/region.ts (EGNOS, operated by ESSP).
 */
import { geodeticToLocal, type LocalFrame } from './geo'
import { DEG, M_PER_NM } from './units'
import type { Airport, Station } from './sites'
import { SCENARIO } from '@/scenarios/active'

export type { Airport, Station, StationKind } from './sites'

const R = SCENARIO.region

/** Honesty labels for what the page shows. */
export const HYPOTHETICAL = R.honesty.hypothetical
export const ILLUSTRATIVE_SITE = R.honesty.illustrativeSite
export const REAL_SOURCE = R.honesty.realSource

/**
 * The origin of the local flight frame (NM east/north), about midway between the two
 * airports, so the frame's distortion stays small over the whole route.
 */
export const REGION: LocalFrame = R.frame

/** The airport LAB201 leaves from, at the threshold of the runway it takes off from. */
export const DEPARTURE: Airport = R.departure
/** The airport LAB201 lands at, at the landing threshold of its LPV approach. */
export const DESTINATION: Airport = R.destination

export const AIRPORT_LIST: readonly Airport[] = [DEPARTURE, DESTINATION]

/** The airport nearest a local point (for views that draw one airport at a time). */
export function nearestAirport(eastNm: number, northNm: number): Airport {
  const d = (a: Airport) => Math.hypot(eastNm - a.thresholdEastNm, northNm - a.thresholdNorthNm)
  return d(DEPARTURE) <= d(DESTINATION) ? DEPARTURE : DESTINATION
}

/** The SBAS ground segment: RIMS, master control centres and uplink stations. */
export const STATIONS: readonly Station[] = R.stations

export const RIMS_STATIONS = STATIONS.filter((s) => s.kind === 'rims')
export const MASTER = STATIONS.find((s) => s.kind === 'mcc' && s.role === 'primary')!

// ---------------------------------------------------------------------------
// Magnetic equator
// ---------------------------------------------------------------------------

// TODO(expert-review): dip-equator latitudes are read approximately from IGRF maps (epoch ~2025) every 15° of
// longitude; the real line wanders between these points.
/** Geographic latitude of the magnetic (dip) equator, degrees, at longitudes −180, −165, …, 180. */
export const DIP_EQUATOR_TABLE: readonly number[] = [-2, -4, -6, -8, -9, -10, -11, -12, -11, -4, 1, 7, 10, 10, 9, 8, 7.5, 8.5, 9.5, 10, 9.5, 8.5, 6, 2, -2]

/** Latitude of the magnetic equator at a longitude, degrees (linear between table points). */
export function dipEquatorLatDeg(lonDeg: number): number {
  const l = ((((lonDeg + 180) % 360) + 360) % 360) / 15
  const i = Math.min(Math.floor(l), DIP_EQUATOR_TABLE.length - 2)
  const f = l - i
  return DIP_EQUATOR_TABLE[i] * (1 - f) + DIP_EQUATOR_TABLE[i + 1] * f
}

/** Latitude relative to the magnetic equator, degrees (a simple stand-in for magnetic latitude). */
export const magLatDeg = (latDeg: number, lonDeg: number) => latDeg - dipEquatorLatDeg(lonDeg)

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** UTC hour at the gate when the journey starts. */
export const START_UTC_HOUR = R.startUtcHour
/** Local solar time at the frame origin when the journey starts. */
export const START_LOCAL_HOUR = START_UTC_HOUR + REGION.origin.lonDeg / 15

/** Local solar time, hours 0–24, at a longitude, for a given journey time and start hour (solar time at the origin). */
export function localSolarHour(tS: number, lonDeg: number, startLocalHour = START_LOCAL_HOUR): number {
  const utcAtStart = startLocalHour - REGION.origin.lonDeg / 15
  const h = utcAtStart + tS / 3600 + lonDeg / 15
  return ((h % 24) + 24) % 24
}

export interface ZoneTime {
  /** The civil time zone's name, e.g. "WIB" or "CET". */
  zone: string
  /** Hours 0–24 on the zone's clock. */
  hour: number
}

/** Civil time along the route, in the scenario's time zones. */
export function zoneTime(tS: number, lonDeg: number, startLocalHour = START_LOCAL_HOUR): ZoneTime {
  const utc = startLocalHour - REGION.origin.lonDeg / 15 + tS / 3600
  const { zone, offsetH } = R.zoneAt(lonDeg)
  return { zone, hour: (((utc + offsetH) % 24) + 24) % 24 }
}

// ---------------------------------------------------------------------------
// Runway frame
// ---------------------------------------------------------------------------

/** Runway-frame metres (`a` along the runway in use from its threshold, `r` to the right) to local NM east/north. */
export function runwayToLocalNm(ap: Airport, aM: number, rM: number): [number, number] {
  const c = ap.runwayCourseDeg * DEG
  const e = aM * Math.sin(c) + rM * Math.cos(c)
  const n = aM * Math.cos(c) - rM * Math.sin(c)
  return [ap.thresholdEastNm + e / M_PER_NM, ap.thresholdNorthNm + n / M_PER_NM]
}

/** Local NM east/north to runway-frame metres. */
export function localNmToRunway(ap: Airport, eastNm: number, northNm: number): [number, number] {
  const c = ap.runwayCourseDeg * DEG
  const e = (eastNm - ap.thresholdEastNm) * M_PER_NM
  const n = (northNm - ap.thresholdNorthNm) * M_PER_NM
  return [e * Math.sin(c) + n * Math.cos(c), e * Math.cos(c) - n * Math.sin(c)]
}

/** A point given by latitude and longitude, in the local frame, NM. */
export const localOf = (latDeg: number, lonDeg: number) => geodeticToLocal(REGION, { latDeg, lonDeg, hM: 0 })
