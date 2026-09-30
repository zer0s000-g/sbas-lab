/**
 * The fictional region: an equatorial archipelago, its two airports, the SBAS
 * ground stations and the journey's start time. Every name, position and station
 * here is made up for this fictional region; none of it describes a real place,
 * airport or SBAS. The coordinates only give the satellite geometry a realistic
 * latitude near the equator.
 */
import type { Geodetic, LocalFrame } from './geo'

export const MADE_UP = 'made up for this fictional region'

/** The origin of the local flight frame (NM east/north). */
export const REGION: LocalFrame = { origin: { latDeg: -2, lonDeg: 91, hM: 0 } }

export interface Airport {
  id: string
  name: string
  /** Runway threshold (landing end), local NM. */
  thresholdEastNm: number
  thresholdNorthNm: number
  elevationFt: number
  /** Runway true course for the runway in use, degrees. */
  runwayCourseDeg: number
  runway: string
  runwayLengthM: number
}

export const DEPARTURE: Airport = {
  id: 'NORTH-ISLE',
  name: 'North Isle',
  thresholdEastNm: -48,
  thresholdNorthNm: -18,
  elevationFt: 20,
  runwayCourseDeg: 90,
  runway: '09',
  runwayLengthM: 2800,
}

export const DESTINATION: Airport = {
  id: 'CORAL-ISLE',
  name: 'Coral Isle',
  thresholdEastNm: 44,
  thresholdNorthNm: 14,
  elevationFt: 30,
  runwayCourseDeg: 90,
  runway: '09',
  runwayLengthM: 3000,
}

export type StationKind = 'reference' | 'master' | 'uplink'

export interface Station {
  id: string
  kind: StationKind
  pos: Geodetic
}

/** SBAS ground network: reference stations spread wide enough to watch the ionosphere over the region, one master, one uplink. */
export const STATIONS: readonly Station[] = [
  { id: 'REF-1', kind: 'reference', pos: { latDeg: -10, lonDeg: 84, hM: 10 } },
  { id: 'REF-2', kind: 'reference', pos: { latDeg: -10, lonDeg: 95, hM: 10 } },
  { id: 'REF-3', kind: 'reference', pos: { latDeg: 2.5, lonDeg: 84, hM: 10 } },
  { id: 'REF-4', kind: 'reference', pos: { latDeg: 3, lonDeg: 90, hM: 10 } },
  { id: 'REF-5', kind: 'reference', pos: { latDeg: -4, lonDeg: 86, hM: 10 } },
  { id: 'REF-6', kind: 'reference', pos: { latDeg: -2.3, lonDeg: 93.5, hM: 10 } },
  { id: 'REF-7', kind: 'reference', pos: { latDeg: -7, lonDeg: 90, hM: 10 } },
  { id: 'MASTER', kind: 'master', pos: { latDeg: -1.8, lonDeg: 91.4, hM: 15 } },
  { id: 'UPLINK', kind: 'uplink', pos: { latDeg: -1.9, lonDeg: 91.6, hM: 15 } },
]

export const REFERENCE_STATIONS = STATIONS.filter((s) => s.kind === 'reference')

// TODO(expert-review): the magnetic equator is modelled as a parallel at a fixed geographic latitude; the real dip equator is curved.
export const MAG_EQUATOR_LAT_DEG = 6

/** Local solar time at the region's longitude when the journey starts (a late-morning departure). */
export const START_LOCAL_HOUR = 10

/** Local solar time, hours 0–24, at a longitude, for a given journey time and start hour. */
export function localSolarHour(tS: number, lonDeg: number, startLocalHour = START_LOCAL_HOUR): number {
  const utcAtStart = startLocalHour - REGION.origin.lonDeg / 15
  const h = utcAtStart + tS / 3600 + lonDeg / 15
  return ((h % 24) + 24) % 24
}
