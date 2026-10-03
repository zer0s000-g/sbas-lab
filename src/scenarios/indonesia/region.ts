/**
 * The AirNav Indonesia scenario: LAB201 from Jakarta Soekarno-Hatta (WIII) to Bali
 * I Gusti Ngurah Rai (WADD), and a hypothetical Indonesian SBAS around it.
 *
 * What is real and what is not (CLAUDE.md, design.md §6):
 * - real: the geography, the two airports and their runways (AIP Indonesia AD 2), the
 *   Michibiki GEO satellites QZS-3 and QZS-6 and their SBAS PRNs (./geos);
 * - hypothetical: the Indonesian SBAS service itself, its ground sites (placed at real
 *   cities for illustration, not real facilities), the LPV procedure at Bali and the
 *   route's waypoints. Indonesia has no operational SBAS today, and MSAS serves Japan.
 */
import type { LocalFrame } from '@/core/geo'
import { makeAirport, type Airport, type Station } from '@/core/sites'
import type { ZoneOffset } from '../types'

/** Honesty labels for what the page shows. */
export const HYPOTHETICAL = 'hypothetical: Indonesia has no operational SBAS today'
export const ILLUSTRATIVE_SITE = 'illustrative site, not a real facility'
export const REAL_SOURCE = 'real airport data (AIP Indonesia)'

/**
 * The origin of the local flight frame (NM east/north), about midway between the two
 * airports, so the frame's distortion stays small over the whole route.
 */
export const FRAME: LocalFrame = { origin: { latDeg: -7.5, lonDeg: 111, hM: 0 } }

const airport = (a: Omit<Airport, 'thresholdEastNm' | 'thresholdNorthNm'>) => makeAirport(FRAME, a)

// TODO(expert-review): runway threshold coordinates, true courses, lengths and elevations are taken from aviation
// databases that reproduce AIP Indonesia AD 2 (WIII, WADD); confirm against the current AIRAC AIP. The departure
// runway (07R) is chosen for the story, not taken from a published preference.
/** Jakarta Soekarno-Hatta: LAB201 departs from runway 07R. Terminals lie between the parallel runways. */
export const DEPARTURE: Airport = airport({
  id: 'WIII',
  iata: 'CGK',
  name: 'Soekarno-Hatta',
  city: 'Jakarta',
  threshold: { latDeg: -6.1425, lonDeg: 106.6437 },
  elevationFt: 34,
  runwayCourseDeg: 68.4,
  runway: '07R',
  runwayLengthM: 3660,
  runwayWidthM: 60,
  parallelOffsetM: -2400,
  parallelRunway: '07L',
  terminalSide: -1,
})

/** Bali I Gusti Ngurah Rai: LAB201 lands on runway 09, over the sea from the west. Terminal north of the runway. */
export const DESTINATION: Airport = airport({
  id: 'WADD',
  iata: 'DPS',
  name: 'I Gusti Ngurah Rai',
  city: 'Bali',
  threshold: { latDeg: -8.748958, lonDeg: 115.153872 },
  elevationFt: 11,
  runwayCourseDeg: 87.66,
  runway: '09',
  runwayLengthM: 2996,
  runwayWidthM: 45,
  parallelOffsetM: null,
  parallelRunway: null,
  terminalSide: -1,
})

/**
 * The SBAS ground segment (Doc 9849 §4.3.1.1), hypothetical, at illustrative sites:
 * - RIMS spread across the archipelago;
 * - MCC: a primary and a backup, as in MSAS (two MCS);
 * - GUS: one for each GEO, so each PRN has its own uplink.
 */
const rims = (code: string, name: string, latDeg: number, lonDeg: number): Station => ({ id: `RIMS-${code}`, kind: 'rims', name, code, pos: { latDeg, lonDeg, hM: 20 } })

export const STATIONS: readonly Station[] = [
  rims('BTJ', 'Banda Aceh', 5.55, 95.32),
  rims('KNO', 'Medan', 3.59, 98.67),
  rims('PDG', 'Padang', -0.95, 100.35),
  rims('PLM', 'Palembang', -2.99, 104.76),
  rims('PNK', 'Pontianak', -0.03, 109.33),
  rims('JKT', 'Jakarta', -6.2, 106.85),
  rims('SUB', 'Surabaya', -7.25, 112.75),
  rims('DPS', 'Denpasar', -8.65, 115.22),
  rims('KOE', 'Kupang', -10.18, 123.6),
  rims('BPN', 'Balikpapan', -1.27, 116.83),
  rims('UPG', 'Makassar', -5.14, 119.42),
  rims('MDC', 'Manado', 1.47, 124.84),
  rims('AMQ', 'Ambon', -3.7, 128.18),
  rims('SOQ', 'Sorong', -0.88, 131.25),
  rims('DJJ', 'Jayapura', -2.53, 140.72),
  rims('MKQ', 'Merauke', -8.49, 140.4),
  { id: 'MCC-JKT', kind: 'mcc', name: 'Jakarta', code: 'MCC', role: 'primary', pos: { latDeg: -6.12, lonDeg: 106.66, hM: 20 } },
  { id: 'MCC-UPG', kind: 'mcc', name: 'Makassar', code: 'MCC', role: 'backup', pos: { latDeg: -5.06, lonDeg: 119.55, hM: 20 } },
  { id: 'GUS-1', kind: 'gus', name: 'near Jakarta', code: 'GUS', geoId: 'QZS-6', pos: { latDeg: -6.35, lonDeg: 106.95, hM: 60 } },
  { id: 'GUS-2', kind: 'gus', name: 'near Makassar', code: 'GUS', geoId: 'QZS-3', pos: { latDeg: -5.25, lonDeg: 119.6, hM: 60 } },
]

/** Departure from the gate at 08:00 WIB (UTC+7). */
export const START_UTC_HOUR = 1

/**
 * Indonesian standard time along the route: WIB (UTC+7) for Java, WITA (UTC+8) from
 * Bali eastward to Sulawesi and Nusa Tenggara, WIT (UTC+9) for Maluku and Papua.
 * Simplified to meridians (the real boundaries follow provinces): Bali Strait at 114.4°E,
 * and 126°E for WIT.
 */
export function zoneAt(lonDeg: number): ZoneOffset {
  return lonDeg < 114.4 ? { zone: 'WIB', offsetH: 7 } : lonDeg < 126 ? { zone: 'WITA', offsetH: 8 } : { zone: 'WIT', offsetH: 9 }
}
