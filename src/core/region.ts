/**
 * The scenario: LAB201 from Jakarta Soekarno-Hatta (WIII) to Bali I Gusti Ngurah Rai
 * (WADD), and a hypothetical Indonesian SBAS around it.
 *
 * What is real and what is not (CLAUDE.md, design.md §6):
 * - real: the geography, the two airports and their runways (AIP Indonesia AD 2), the
 *   Michibiki GEO satellites QZS-3 and QZS-6 and their SBAS PRNs (core/orbits);
 * - hypothetical: the Indonesian SBAS service itself, its ground sites (placed at real
 *   cities for illustration, not real facilities), the LPV procedure at Bali and the
 *   route's waypoints. Indonesia has no operational SBAS today, and MSAS serves Japan.
 */
import { geodeticToLocal, type Geodetic, type LocalFrame } from './geo'
import { DEG, M_PER_NM } from './units'

/** Honesty labels for what the page shows. */
export const HYPOTHETICAL = 'hypothetical: Indonesia has no operational SBAS today'
export const ILLUSTRATIVE_SITE = 'illustrative site, not a real facility'
export const REAL_SOURCE = 'real airport data (AIP Indonesia)'

/**
 * The origin of the local flight frame (NM east/north), about midway between the two
 * airports, so the frame's distortion stays small over the whole route.
 */
export const REGION: LocalFrame = { origin: { latDeg: -7.5, lonDeg: 111, hM: 0 } }

export interface Airport {
  /** ICAO location indicator. */
  id: string
  iata: string
  /** Airport name. */
  name: string
  /** The city or island it serves, for short labels ("Jakarta", "Bali"). */
  city: string
  /** Threshold of the runway in use (the start of the take-off run, or the landing threshold). */
  threshold: { latDeg: number; lonDeg: number }
  /** The same threshold in the local frame, NM. */
  thresholdEastNm: number
  thresholdNorthNm: number
  elevationFt: number
  /** Runway true course for the runway in use, degrees. */
  runwayCourseDeg: number
  runway: string
  runwayLengthM: number
  runwayWidthM: number
  /** A parallel runway, right of the one in use positive, m (centreline to centreline); none = single runway. */
  parallelOffsetM: number | null
  parallelRunway: string | null
  /** Side of the runway in use where the terminal stands: +1 right of the take-off/landing direction, −1 left. */
  terminalSide: 1 | -1
}

function airport(a: Omit<Airport, 'thresholdEastNm' | 'thresholdNorthNm'>): Airport {
  const l = geodeticToLocal(REGION, { ...a.threshold, hM: 0 })
  return { ...a, thresholdEastNm: l.eastNm, thresholdNorthNm: l.northNm }
}

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

export const AIRPORT_LIST: readonly Airport[] = [DEPARTURE, DESTINATION]

/** The airport nearest a local point (for views that draw one airport at a time). */
export function nearestAirport(eastNm: number, northNm: number): Airport {
  const d = (a: Airport) => Math.hypot(eastNm - a.thresholdEastNm, northNm - a.thresholdNorthNm)
  return d(DEPARTURE) <= d(DESTINATION) ? DEPARTURE : DESTINATION
}

/**
 * The SBAS ground segment (Doc 9849 §4.3.1.1), hypothetical, at illustrative sites:
 * - RIMS, Ranging and Integrity Monitoring Stations (WAAS calls them WRS, MSAS GMS):
 *   receivers at surveyed positions spread across the archipelago;
 * - MCC, master control centres: a primary and a backup, as in MSAS (two MCS);
 * - GUS, ground uplink stations: one for each GEO, so each PRN has its own uplink.
 */
export type StationKind = 'rims' | 'mcc' | 'gus'

export interface Station {
  id: string
  kind: StationKind
  /** City, for labels. */
  name: string
  /** Short code for map labels. */
  code: string
  pos: Geodetic
  /** GUS: the GEO it uplinks to. MCC: primary or backup. */
  geoId?: string
  role?: 'primary' | 'backup'
}

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

/** Departure from the gate at 08:00 WIB (UTC+7). */
export const START_UTC_HOUR = 1
/** Local solar time at the frame origin when the journey starts. */
export const START_LOCAL_HOUR = START_UTC_HOUR + REGION.origin.lonDeg / 15

/** Local solar time, hours 0–24, at a longitude, for a given journey time and start hour (solar time at the origin). */
export function localSolarHour(tS: number, lonDeg: number, startLocalHour = START_LOCAL_HOUR): number {
  const utcAtStart = startLocalHour - REGION.origin.lonDeg / 15
  const h = utcAtStart + tS / 3600 + lonDeg / 15
  return ((h % 24) + 24) % 24
}

export interface ZoneTime {
  zone: 'WIB' | 'WITA' | 'WIT'
  /** Hours 0–24 on the zone's clock. */
  hour: number
}

/**
 * Indonesian standard time along the route: WIB (UTC+7) for Java, WITA (UTC+8) from
 * Bali eastward to Sulawesi and Nusa Tenggara, WIT (UTC+9) for Maluku and Papua.
 * Simplified to meridians (the real boundaries follow provinces): Bali Strait at 114.4°E,
 * and 126°E for WIT.
 */
export function zoneTime(tS: number, lonDeg: number, startLocalHour = START_LOCAL_HOUR): ZoneTime {
  const utc = startLocalHour - REGION.origin.lonDeg / 15 + tS / 3600
  const [zone, offset] = lonDeg < 114.4 ? (['WIB', 7] as const) : lonDeg < 126 ? (['WITA', 8] as const) : (['WIT', 9] as const)
  return { zone, hour: (((utc + offset) % 24) + 24) % 24 }
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
