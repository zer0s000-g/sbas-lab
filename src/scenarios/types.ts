/**
 * What a scenario is: one flight, LAB201, from gate to gate, the SBAS around it, and the
 * words the page uses to tell its story. Everything here is plain data (and a route
 * builder), so the simulation in src/core stays pure: the same scenario always gives
 * the same journey.
 *
 * Type-only imports: the scenario modules must not import runtime values from the
 * modules that read the active scenario (src/core/region, orbits, flight, …).
 */
import type { LocalFrame } from '@/core/geo'
import type { Airport, Station } from '@/core/sites'
import type { SatDef } from '@/core/orbits'
import type { RouteHelpers, Waypoint } from '@/core/flight'
import type { OperationId } from '@/core/operations'
import type { SbasService } from '@/core/sbasWorld'
import type { PhaseId } from '@/journey/phases'
import type { Narration } from '@/journey/narration'
import type { FailureDef } from '@/journey/failures'
import type { StopId } from '@/journey/engine'
import type { CoastData } from '@/views/geo/coast'
import type { ScenarioId } from './id'

export interface ZoneOffset {
  zone: string
  /** Hours ahead of UTC. */
  offsetH: number
}

/**
 * Coastline data, loaded on demand: it is the bulk of a scenario, and only lazily loaded
 * views (the map, the globe, the terrain) draw it, so it stays out of the first page load.
 */
export type CoastLoader = () => Promise<CoastData>

export interface Peak {
  name: string
  latDeg: number
  lonDeg: number
  heightM: number
}

export interface ScenarioDef {
  id: ScenarioId
  /** The scenario tab: who it is for, and a short line on what it shows. */
  tab: { label: string; hint: string }
  region: {
    /** The origin of the local flight frame (NM east/north), about midway along the route. */
    frame: LocalFrame
    departure: Airport
    destination: Airport
    stations: readonly Station[]
    /** UTC hour at the gate when the journey starts. */
    startUtcHour: number
    /** The civil time zone at a longitude along the route. */
    zoneAt: (lonDeg: number) => ZoneOffset
    honesty: { hypothetical: string; illustrativeSite: string; realSource: string }
  }
  /** The SBAS GEO satellites the receiver tracks. */
  geos: readonly SatDef[]
  /** Rotates the GPS constellation so the journey starts with a typical geometry. */
  gpsEpochRaanDeg: number
  route: (h: RouteHelpers) => Waypoint[]
  approach: {
    /** The operation whose alert limits the FAS data block carries. */
    op: OperationId
    /** SBAS service provider, as a name. */
    providerName: string
    /** The numeric SBAS service provider ID of the FAS data block, or null when the provider has none. */
    providerId: number | null
    referencePathId: string
    channel: number
    decisionHeightFt: number
    note: string
  }
  /** The IGPs of the service area. */
  igpBox: { lat0: number; lat1: number; lon0: number; lon1: number }
  /** The SBAS service the aircraft uses when nothing is broken. */
  nominalService: SbasService
  failures: {
    list: readonly FailureDef[]
    /** RIMS taken offline by the "stations offline" failure. */
    offlineSet: readonly string[]
    clockJumpM: number
    /** Local solar hour for the evening flight. */
    eveningStartHour: number
  }
  narration: Readonly<Record<PhaseId, Narration>>
  texts: {
    flightNote: string
    statusNote: string
    benefitGate: string
    benefitLanding: string
    /** Under the benefit table on the descent and final when an "L1 only" column is shown. */
    benefitCompareNote: string
    serviceNames: Readonly<Record<SbasService, string>>
    stops: Readonly<Record<StopId, { title: string; body: string }>>
    footer: string
    networkHonesty: string
    describeSpace: string
    describeNetwork: string
    /** Where the flight view is looking, away from the airports. */
    describeClimb: string
    describeCruise: string
    describeFinal: string
    /** The uplink station's map label. */
    uplinkCode: string
    routeLegend: string
    /** The network map legend for the ground sites and for the LPV-availability tint. */
    stationsLegend: string
    availabilityLegend: string
  }
  map: {
    /** The network map box. */
    box: { lat0: number; lat1: number; lon0: number; lon1: number }
    /** The land outlines, loaded with the map (only the active scenario's are ever downloaded). */
    land: CoastLoader
    /** Graticule spacing, degrees. */
    lonStep: number
    latStep: number
    /** East–west scale of a degree of longitude against one of latitude (cos of the map's middle latitude; 1 near the equator). */
    lonScale: number
    /** Cell size of the LPV-availability tint, degrees. */
    availabilityCellDeg: number
    /** Where the legend goes: over open sea, clear of the sites (bottom left over the Indian Ocean; top left over the Atlantic). */
    legendCorner: 'bottom-left' | 'top-left'
  }
  /** The finer land the globe draws over the coarse world, loaded with the space view. */
  globeDetail: CoastLoader
  terrain: {
    /** The coastline the terrain is built on, loaded with the 3D views. */
    coast: CoastLoader
    peaks: readonly Peak[]
    /** The corridor along the route, local NM. */
    corridor: { e0: number; e1: number; n0: number; n1: number }
    /** Height of the inland plain the hills rise from, ft. */
    inlandBaseFt: number
    /** Amplitude of the inland hills, ft. */
    hillsFt: number
    /** What the flight view's terrain is, for its comment and label. */
    note: string
  }
}
