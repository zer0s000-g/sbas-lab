/**
 * The AirNav Indonesia scenario: LAB201 from Jakarta (WIII) to Bali (WADD) with a
 * what-if Indonesian SBAS broadcast through Japan's Michibiki GEOs. The scenario tab
 * names the audience the scenario was made for; it does not name an SBAS operator
 * (Indonesia has no operational SBAS; CLAUDE.md).
 */
import type { ScenarioDef } from '../types'
import { indonesia } from '@/views/geo/indonesia.data'
import { javaBali } from '@/views/geo/javaBali.data'
import { DEPARTURE, DESTINATION, FRAME, HYPOTHETICAL, ILLUSTRATIVE_SITE, REAL_SOURCE, START_UTC_HOUR, STATIONS, zoneAt } from './region'
import { GEOS, GPS_EPOCH_RAAN_DEG } from './geos'
import { route } from './route'
import { NARRATION } from './narration'
import { CLOCK_JUMP_M, EVENING_START_HOUR, FAILURES, OFFLINE_SET } from './failures'
import { TEXTS } from './texts'
import { PEAKS } from './terrain'

export const INDONESIA: ScenarioDef = {
  id: 'indonesia',
  tab: { label: 'AirNav Indonesia', hint: 'Jakarta → Bali · what-if Indonesian SBAS' },
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
    op: 'apv1',
    providerName: 'ID-SBAS (hypothetical)',
    providerId: null,
    referencePathId: 'R09A',
    channel: 54201,
    decisionHeightFt: 250,
    note: `RNP RWY ${DESTINATION.runway} at ${DESTINATION.city} (${DESTINATION.id}), illustrative procedure, not published`,
  },
  igpBox: { lat0: -20, lat1: 15, lon0: 90, lon1: 145 },
  nominalService: 'dfmc',
  failures: { list: FAILURES, offlineSet: OFFLINE_SET, clockJumpM: CLOCK_JUMP_M, eveningStartHour: EVENING_START_HOUR },
  narration: NARRATION,
  texts: TEXTS,
  map: { box: { lat0: -16, lat1: 12, lon0: 92, lon1: 144 }, land: indonesia, lonStep: 10, latStep: 5, lonScale: 1, availabilityCellDeg: 2, legendCorner: 'bottom-left' },
  globeDetail: indonesia,
  terrain: {
    coast: javaBali,
    peaks: PEAKS,
    corridor: { e0: -300, e1: 300, n0: -120, n1: 126 },
    inlandBaseFt: 0,
    hillsFt: 1500,
    note: 'Java, Madura and Bali: the real coastline (Natural Earth 1:10m), a low coastal plain rising inland into hills, the main volcanoes as cones',
  },
}
