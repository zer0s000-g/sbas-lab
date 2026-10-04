/**
 * The ESSP-SAS scenario: LAB201 from Toulouse-Blagnac (LFBO) to Nice Côte d'Azur (LFMN)
 * with EGNOS, the European SBAS, whose service ESSP provides under contract to EUSPA.
 * EGNOS v2 is a single-frequency (L1) service: the journey flies it, with LPV-200 minima
 * at Nice; the planned dual-frequency EGNOS v3 is a preview switch.
 */
import type { ScenarioDef } from '../types'

const europe = () => import('@/views/geo/europe.data').then((m) => m.europe)
const southFrance = () => import('@/views/geo/southFrance.data').then((m) => m.southFrance)
import { DEPARTURE, DESTINATION, FRAME, HYPOTHETICAL, ILLUSTRATIVE_SITE, REAL_SOURCE, START_UTC_HOUR, STATIONS, zoneAt } from './region'
import { GEOS, GPS_EPOCH_RAAN_DEG } from './geos'
import { route } from './route'
import { NARRATION } from './narration'
import { CLOCK_JUMP_M, EVENING_START_HOUR, FAILURES, OFFLINE_SET } from './failures'
import { TEXTS } from './texts'
import { PEAKS } from './terrain'

export const ESSP: ScenarioDef = {
  id: 'essp',
  tab: { label: 'ESSP-SAS', hint: 'Toulouse → Nice · EGNOS' },
  region: {
    frame: FRAME,
    departure: DEPARTURE,
    destination: DESTINATION,
    stations: STATIONS,
    startUtcHour: START_UTC_HOUR,
    zoneAt,
    honesty: { hypothetical: HYPOTHETICAL, illustrativeSite: ILLUSTRATIVE_SITE, realSource: REAL_SOURCE },
  },
  geos: GEOS,
  gpsEpochRaanDeg: GPS_EPOCH_RAAN_DEG,
  route,
  approach: {
    // LPV-200: HAL 40 m, VAL 35 m, 6 s to alert (Doc 9849 Table 2-1, §4.3.3.3).
    op: 'cat1',
    providerName: 'EGNOS',
    // EGNOS is SBAS service provider 1 in the FAS data block (EUROCONTROL FAS data block tool).
    providerId: 1,
    referencePathId: 'R04L',
    // TODO(expert-review): channel number and FAS data of the RNP RWY 04L approach at Nice are illustrative, not the published procedure.
    channel: 40642,
    decisionHeightFt: 200,
    note: `RNP RWY ${DESTINATION.runway} at ${DESTINATION.city} (${DESTINATION.id}) with LPV-200 minima, illustrative procedure, not the published one`,
  },
  // DO-229 spaces IGPs 5° apart up to 55° latitude; the box stays inside that band.
  igpBox: { lat0: 25, lat1: 55, lon0: -25, lon1: 40 },
  nominalService: 'l1',
  failures: { list: FAILURES, offlineSet: OFFLINE_SET, clockJumpM: CLOCK_JUMP_M, eveningStartHour: EVENING_START_HOUR },
  narration: NARRATION,
  texts: TEXTS,
  map: { box: { lat0: 26, lat1: 68, lon0: -28, lon1: 36 }, land: europe, lonStep: 10, latStep: 10, lonScale: Math.cos((47 * Math.PI) / 180), availabilityCellDeg: 3, legendCorner: 'top-left' },
  globeDetail: europe,
  terrain: {
    coast: southFrance,
    peaks: PEAKS,
    corridor: { e0: -162, e1: 162, n0: -60, n1: 60 },
    inlandBaseFt: 420,
    hillsFt: 900,
    note: 'Southern France from Toulouse to Nice: the real coastline (Natural Earth 1:10m), a plain rising inland into hills, a few summits as cones',
  },
}
