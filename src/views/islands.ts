/**
 * Terrain of the made-up archipelago: the two airport islands and a few islets, as a
 * height function over the local NM frame. Pure, so the flight view and the network
 * map draw the same islands. Heights are made up for this fictional region.
 */
import { valueNoise } from '@/core/random'
import { DEPARTURE, DESTINATION, type Airport } from '@/core/region'

export interface Island {
  id: string
  /** Centre, local NM. */
  eastNm: number
  northNm: number
  /** Semi-axes, NM. */
  rxNm: number
  ryNm: number
  peakFt: number
  airport?: Airport
}

const runwayHalfNm = (a: Airport) => a.runwayLengthM / 2 / 1852

export const ISLANDS: readonly Island[] = [
  // Each airport island is placed so its runway sits near the coast and the approach is over the sea.
  // North Isle: the runway points east off the island's east coast, so the climb-out is over the sea.
  { id: 'north-isle', eastNm: DEPARTURE.thresholdEastNm - 1.6, northNm: DEPARTURE.thresholdNorthNm + 0.6, rxNm: 3.6, ryNm: 2.8, peakFt: 1400, airport: DEPARTURE },
  { id: 'coral-isle', eastNm: DESTINATION.thresholdEastNm + 4.6, northNm: DESTINATION.thresholdNorthNm + 0.6, rxNm: 5.6, ryNm: 3.8, peakFt: 1900, airport: DESTINATION },
  { id: 'islet-1', eastNm: -30, northNm: -2, rxNm: 1.8, ryNm: 1.3, peakFt: 700 },
  { id: 'islet-2', eastNm: 4, northNm: 9, rxNm: 2.4, ryNm: 1.6, peakFt: 1100 },
  { id: 'islet-3', eastNm: 28, northNm: 4, rxNm: 1.5, ryNm: 1.1, peakFt: 500 },
]

/** Terrain height of one island at a point, ft; below 0 is under the sea. */
export function islandHeightFt(isl: Island, eastNm: number, northNm: number): number {
  const d = Math.hypot((eastNm - isl.eastNm) / isl.rxNm, (northNm - isl.northNm) / isl.ryNm)
  const n = valueNoise(eastNm * 0.55 + isl.rxNm, northNm * 0.55, 7) * 0.7 + valueNoise(eastNm * 1.7, northNm * 1.7, 3) * 0.3
  const mask = Math.max(0, 1 - d * d)
  let h = -80 + mask * (80 + isl.peakFt * n * mask)
  const a = isl.airport
  if (a) {
    // A flat apron around the runway, a little above the sea.
    const along = eastNm - (a.thresholdEastNm + runwayHalfNm(a))
    const across = northNm - a.thresholdNorthNm
    const flat = Math.max(Math.abs(across) / 0.6, (Math.abs(along) - runwayHalfNm(a)) / 0.5)
    if (flat < 1) h = a.elevationFt - 10 + (h - (a.elevationFt - 10)) * flat * flat
  }
  return h
}

/** Terrain height anywhere in the region, ft (the sea is −80 ft deep here). */
export function terrainFtAt(eastNm: number, northNm: number): number {
  let h = -80
  for (const isl of ISLANDS) h = Math.max(h, islandHeightFt(isl, eastNm, northNm))
  return h
}
