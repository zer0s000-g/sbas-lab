/**
 * Airports and SBAS ground sites as plain data, and how a scenario builds them in its
 * local flight frame. Shared by every scenario (src/scenarios), so this module imports
 * nothing scenario-specific.
 */
import { geodeticToLocal, type Geodetic, type LocalFrame } from './geo'

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
  /** Published length of the runway in use, end to end, m. */
  runwayLengthM: number
  /**
   * How far the landing threshold (`threshold`, the LTP) lies inside the runway from its
   * end, m (Nice 04L: 93 m). Absent: the threshold is at the runway end. The runway runs
   * from −displacement to length − displacement along the runway frame.
   */
  thresholdDisplacedM?: number
  runwayWidthM: number
  /** A parallel runway, right of the one in use positive, m (centreline to centreline); none = single runway. */
  parallelOffsetM: number | null
  parallelRunway: string | null
  /** Side of the runway in use where the terminal stands: +1 right of the take-off/landing direction, −1 left. */
  terminalSide: 1 | -1
}

/** Runway-frame positions of the two runway ends, m along the runway from the threshold. */
export function runwayExtentM(ap: Pick<Airport, 'runwayLengthM' | 'thresholdDisplacedM'>): { startM: number; endM: number } {
  const d = ap.thresholdDisplacedM ?? 0
  return { startM: 0 - d, endM: ap.runwayLengthM - d }
}

/** An airport placed in a scenario's local frame (its threshold in local NM). */
export function makeAirport(frame: LocalFrame, a: Omit<Airport, 'thresholdEastNm' | 'thresholdNorthNm'>): Airport {
  const l = geodeticToLocal(frame, { ...a.threshold, hM: 0 })
  return { ...a, thresholdEastNm: l.eastNm, thresholdNorthNm: l.northNm }
}

/**
 * The SBAS ground segment (Doc 9849 §4.3.1.1):
 * - RIMS, Ranging and Integrity Monitoring Stations (WAAS calls them WRS, MSAS GMS):
 *   receivers at surveyed positions;
 * - MCC, master (mission) control centres;
 * - GUS, ground uplink stations (EGNOS calls them NLES, Navigation Land Earth Stations).
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
  /** GUS: the GEO it uplinks to (none: shown without an uplink). MCC: primary or backup. */
  geoId?: string
  role?: 'primary' | 'backup'
  /** Which side of its glyph the map labels a master control centre (default: left). */
  labelSide?: 'left' | 'right'
}
