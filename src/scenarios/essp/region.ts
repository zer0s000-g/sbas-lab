/**
 * The ESSP-SAS scenario: LAB201 from Toulouse-Blagnac (LFBO) to Nice Côte d'Azur (LFMN),
 * guided by EGNOS, the European SBAS. ESSP (European Satellite Services Provider) is the
 * EGNOS service provider under contract to EUSPA (EUSPA, "EUSPA taps ESSP for EGNOS
 * service provider role", 2022). ESSP's head office is in Toulouse, hence the departure.
 *
 * What is real and what is not (CLAUDE.md, design.md §6):
 * - real: the geography (Natural Earth), the two airports and their runways (aviation
 *   databases reproducing AIP France; to confirm against the AIRAC AIP), the EGNOS
 *   service and its GEOs (./geos), and the EGNOS ground sites shown, each named in a
 *   public source (docs/SOURCES.md, src/content/claims);
 * - simplified: only some of the ground sites are shown (EGNOS has 38 RIMS, SoL SDD
 *   v3.6 §3.3.2.1); their positions are city-level, not the antenna sites;
 * - illustrative, and labelled so: the route's waypoints, the LPV procedure (RNP RWY 04L
 *   with LPV-200 minima, channel and FAS data as an example, not the published one) and
 *   which uplink station feeds which GEO.
 */
import type { LocalFrame } from '@/core/geo'
import { makeAirport, type Airport, type Station } from '@/core/sites'
import type { ZoneOffset } from '../types'

/** Honesty labels for what the page shows. */
export const HYPOTHETICAL = 'illustrative: the route, the LPV procedure and the uplink pairing are examples, not published data'
export const ILLUSTRATIVE_SITE = 'real EGNOS site, city-level position'
export const REAL_SOURCE = 'airport data from aviation databases (AIP France, to confirm)'

/** The origin of the local flight frame, about midway between Toulouse and Nice. */
export const FRAME: LocalFrame = { origin: { latDeg: 43.6, lonDeg: 4.3, hM: 0 } }

const airport = (a: Omit<Airport, 'thresholdEastNm' | 'thresholdNorthNm'>) => makeAirport(FRAME, a)

// TODO(expert-review): LFBO 14L and LFMN 04L thresholds, true courses and elevations are taken from OurAirports
// (public domain), which reproduces AIP France AD 2; confirm against the current AIRAC AIP. LFMN 04L: the landing
// threshold is displaced 305 ft (93 m) from the runway end; the 2570 m length is the published runway length,
// end to end, so the runway is drawn from 93 m before the threshold to 2477 m past it.
// The runways in use are chosen for the story.
/**
 * Toulouse-Blagnac: LAB201 departs from runway 14L (true course 143.1°, 3000 m). The
 * passenger terminal lies east of runway 14L/32R (left of the take-off direction); the
 * parallel runway 14R/32L is 305 m to the west (right).
 */
export const DEPARTURE: Airport = airport({
  id: 'LFBO',
  iata: 'TLS',
  name: 'Toulouse-Blagnac',
  city: 'Toulouse',
  threshold: { latDeg: 43.637402, lonDeg: 1.357620 },
  elevationFt: 490,
  runwayCourseDeg: 143.11,
  runway: '14L',
  runwayLengthM: 3000,
  runwayWidthM: 45,
  parallelOffsetM: 305,
  parallelRunway: '14R',
  terminalSide: -1,
})

/**
 * Nice Côte d'Azur: LAB201 lands on runway 04L (true course 45.0°) from the south-west,
 * over the Baie des Anges. The terminals lie north-west of the runways (left of the
 * landing direction); runway 04R/22L is 312 m to the south-east (right), on land
 * reclaimed from the sea.
 */
export const DESTINATION: Airport = airport({
  id: 'LFMN',
  iata: 'NCE',
  name: "Nice Côte d'Azur",
  city: 'Nice',
  threshold: { latDeg: 43.652389, lonDeg: 7.204857 },
  elevationFt: 11,
  runwayCourseDeg: 45.0,
  runway: '04L',
  runwayLengthM: 2570,
  // The threshold above is the displaced landing threshold, 93 m in from the runway end
  // (OurAirports' 04L end point lies 93 m before it on the runway course).
  thresholdDisplacedM: 93,
  runwayWidthM: 45,
  parallelOffsetM: 312,
  parallelRunway: '04R',
  terminalSide: -1,
})

const site = (kind: Station['kind'], code: string, name: string, latDeg: number, lonDeg: number, extra: Partial<Station> = {}): Station => ({
  id: `${kind.toUpperCase()}-${code}`,
  kind,
  name,
  code: kind === 'rims' ? code : kind === 'mcc' ? 'MCC' : 'NLES',
  pos: { latDeg, lonDeg, hM: 50 },
  ...extra,
})

// TODO(expert-review): EGNOS ground sites. The RIMS shown are in the 38-site network of the EGNOS SoL SDD v3.6
// (Figure 3); the MCC and NLES sites are those of EU Implementing Decision 2017/1406. Positions are the cities', not
// the antennas'. The Azores site's island is not stated in those sources (shown at Ponta Delgada).
/**
 * The EGNOS ground segment shown: 9 RIMS (EGNOS has 38), the two mission control
 * centres (Torrejón, Spain, and Ciampino, Italy) and the navigation land earth stations
 * (NLES) that uplink the messages to the GEOs. Alexandria and Kourou, named in the
 * 2017 decision, are not in the current network (SoL SDD v3.5 removed the Egyptian
 * RIMS; v3.6 Figure 3 has no Kourou), and the Finnish site is Lappeenranta (LAP).
 */
export const STATIONS: readonly Station[] = [
  site('rims', 'TLS', 'Toulouse', 43.6, 1.44),
  site('rims', 'PAR', 'Paris', 48.84, 2.34),
  site('rims', 'LSB', 'Lisbon', 38.72, -9.14),
  site('rims', 'MAD', 'Madeira', 32.65, -16.91),
  site('rims', 'ACR', 'Azores', 37.74, -25.67),
  site('rims', 'LPI', 'La Palma', 28.68, -17.76),
  site('rims', 'ATH', 'Athens', 37.98, 23.73),
  site('rims', 'LAP', 'Lappeenranta', 61.06, 28.19),
  site('rims', 'KUU', 'Kuusamo', 65.97, 29.18),
  // Two MCCs; one leads at a time. Which one leads is the story's choice.
  site('mcc', 'TRJ', 'Torrejón', 40.46, -3.45, { role: 'primary' }),
  site('mcc', 'CIA', 'Ciampino', 41.8, 12.58, { role: 'backup', labelSide: 'right' }),
  // NLES sites. Which NLES feeds which GEO is not in the sources used: the pairing is illustrative.
  site('gus', 'BTZ', 'Betzdorf', 49.69, 6.33, { geoId: 'SES-5' }),
  site('gus', 'RBT', 'Rambouillet', 48.64, 1.83, { geoId: 'E5WB' }),
  site('gus', 'AUS', 'Aussaguel', 43.43, 1.5),
  site('gus', 'BUR', 'Burum', 53.27, 6.21),
  site('gus', 'CAG', 'Cagliari', 39.22, 9.11),
  site('gus', 'FUC', 'Fucino', 42.0, 13.6),
  site('gus', 'RED', 'Redu', 50.0, 5.15),
]

/** Departure from the gate at 08:00 CET (UTC+1). */
export const START_UTC_HOUR = 7

/** Central European Time along the whole route (France, UTC+1; the page does not model summer time). */
export function zoneAt(): ZoneOffset {
  return { zone: 'CET', offsetH: 1 }
}
