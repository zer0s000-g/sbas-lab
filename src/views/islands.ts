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
    // The airfield is levelled to the field elevation: hills are cut down over the whole
    // airfield, and low ground is filled only around the pavement (the approach lights
    // beyond the coast stand on a pier). Flat inside, blending out at the edges.
    const along = Math.abs(eastNm - (a.thresholdEastNm + runwayHalfNm(a))) - runwayHalfNm(a)
    const across = Math.abs(northNm - a.thresholdNorthNm)
    const blend = (f: number, start: number) => {
      const k = Math.min(1, Math.max(0, (f - start) / (1 - start)))
      return k * k * (3 - 2 * k)
    }
    if (h > a.elevationFt) h = a.elevationFt + (h - a.elevationFt) * blend(airfieldFlat(isl, eastNm, northNm), 0.7)
    else h = a.elevationFt + (h - a.elevationFt) * blend(Math.max(across / 0.6, along / 0.25), 0.75)
  }
  return h
}

/**
 * Where the levelled airfield is: below 0.7 fully flat, blending out to 1, natural
 * ground beyond. The runway strip, the apron, the terminal and its landside lie inside.
 */
export function airfieldFlat(isl: Island, eastNm: number, northNm: number): number {
  const a = isl.airport
  if (!a) return Infinity
  const along = eastNm - (a.thresholdEastNm + runwayHalfNm(a))
  const across = northNm - a.thresholdNorthNm
  return Math.max(Math.abs(across) / 0.75, (Math.abs(along) - runwayHalfNm(a)) / 0.75)
}

/** Terrain height anywhere in the region, ft (the sea is −80 ft deep here). */
export function terrainFtAt(eastNm: number, northNm: number): number {
  let h = -80
  for (const isl of ISLANDS) h = Math.max(h, islandHeightFt(isl, eastNm, northNm))
  return h
}
