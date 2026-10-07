/**
 * The SBAS of the world, for civil aviation only: who provides each one, its GEOs, its
 * ground segment, and which aviation services it offers or plans. Researched from the
 * providers' and ICAO's public documents (dates in each claim's sources); every system is
 * one claim in src/content/claims/worldwide.ts, which names the sources. Service areas are
 * rough outlines drawn from the providers' wording, never an official map: the page labels
 * them "approximate". Counts left out (null) are not in the sources read.
 */

export type SystemStatus = 'operational' | 'development' | 'test'

export interface AviationService {
  level: string
  /** Year declared or planned (planned years are marked in `planned`). */
  year: number | null
  planned?: boolean
}

export interface SbasGeo {
  name: string
  prn: number | null
  /** Orbital longitude, ° east; null when the sources give none. */
  lonDeg: number | null
  role: 'operational' | 'test' | 'open service' | 'planned' | 'not stated'
}

export interface SbasSystem {
  id: string
  name: string
  full: string
  region: string
  provider: string
  status: SystemStatus
  /** One line: the aviation status today. */
  headline: string
  services: readonly AviationService[]
  geos: readonly SbasGeo[]
  ground: { reference: number | null; master: number | null; uplink: number | null; note: string }
  dfmc: string
  /** Rough outline, [lon, lat] (approximate); null when no area is published. */
  area: readonly (readonly [number, number])[] | null
  areaNote: string
  /** The claim that holds this system's facts. */
  claim: string
}

export const SBAS_SYSTEMS: readonly SbasSystem[] = [
  {
    id: 'waas',
    name: 'WAAS',
    full: 'Wide Area Augmentation System',
    region: 'United States and North America',
    provider: 'Federal Aviation Administration (FAA)',
    status: 'operational',
    headline: 'In service since 2003: en route to LPV-200 across the US National Airspace System.',
    services: [
      { level: 'En route, terminal, non-precision approach (LNAV)', year: 2003 },
      { level: 'LP approaches (first published)', year: 2011 },
      { level: 'LNAV/VNAV, LPV and LPV-200', year: null },
    ],
    geos: [
      { name: 'Eutelsat 117 West B', prn: 131, lonDeg: -117, role: 'operational' },
      { name: 'SES-15', prn: 133, lonDeg: -129, role: 'operational' },
      { name: 'Galaxy 30', prn: 135, lonDeg: -125, role: 'operational' },
    ],
    ground: { reference: 38, master: 3, uplink: 6, note: '38 reference stations in the US, Canada and Mexico (FAA, 2026); master and uplink counts from a secondary source.' },
    dfmc: 'L1 today; the FAA is developing a dual-frequency service.',
    area: [[-168, 71], [-141, 70], [-95, 72], [-62, 66], [-52, 47], [-80, 25], [-87, 15], [-105, 18], [-118, 30], [-125, 40], [-135, 55], [-168, 53]],
    areaNote: 'North America (FAA).',
    claim: 'world.waas',
  },
  {
    id: 'egnos',
    name: 'EGNOS',
    full: 'European Geostationary Navigation Overlay Service',
    region: 'Europe',
    provider: 'ESSP, the EGNOS service provider under contract to EUSPA',
    status: 'operational',
    headline: 'Safety-of-Life service since 2011: NPA and APV-I, LPV-200 since 2015.',
    services: [
      { level: 'NPA and APV-I (LPV)', year: 2011 },
      { level: 'LPV-200', year: 2015 },
    ],
    geos: [
      { name: 'SES-5 (GEO-1)', prn: 136, lonDeg: 5, role: 'operational' },
      { name: 'Eutelsat 5 West B (GEO-3)', prn: 121, lonDeg: -5, role: 'operational' },
      { name: 'ASTRA 5B (GEO-2)', prn: 123, lonDeg: 23.5, role: 'test' },
    ],
    ground: { reference: 38, master: 2, uplink: null, note: '38 RIMS, two mission control centres, two uplink stations (NLES) per GEO (SoL SDD v3.6).' },
    dfmc: 'L1 today; EGNOS v3 is to add a DFMC service for GPS and Galileo.',
    area: [[-25, 72], [35, 72], [45, 60], [45, 36], [35, 33], [10, 35], [-6, 35], [-19, 27], [-31, 37]],
    areaNote: 'Land masses of the EGNOS service area (SoL SDD), ECAC states.',
    claim: 'world.egnos',
  },
  {
    id: 'msas',
    name: 'MSAS',
    full: 'Michibiki Satellite-based Augmentation Service',
    region: 'Japan',
    provider: 'Japan Civil Aviation Bureau (JCAB)',
    status: 'operational',
    headline: 'En route to NPA since 2007; LP and LPV procedures (to 250 ft) published at 25 airports; LPV-200 planned for 2027.',
    services: [
      { level: 'En route to NPA', year: 2007 },
      { level: 'LP and LPV (LPV 250 ft, VAL 50 m), at 25 airports by January 2026', year: null },
      { level: 'LPV-200', year: 2027, planned: true },
    ],
    geos: [
      { name: 'QZS-3', prn: 137, lonDeg: 127, role: 'operational' },
      { name: 'QZS-6', prn: 129, lonDeg: 90.5, role: 'operational' },
      { name: 'QZS-7', prn: 139, lonDeg: null, role: 'planned' },
    ],
    ground: { reference: 13, master: 2, uplink: 3, note: 'Counts of 2021 (JCAB); the 2025 upgrade adds to them.' },
    dfmc: 'DFMC under research (ENRI); no service date.',
    area: [[122, 24], [131, 24], [147, 42], [146, 46], [141, 46], [134, 36], [129, 33], [122, 26]],
    areaNote: 'Japan only (JCAB).',
    claim: 'world.msas',
  },
  {
    id: 'gagan',
    name: 'GAGAN',
    full: 'GPS Aided GEO Augmented Navigation',
    region: 'India',
    provider: 'Airports Authority of India (AAI), certified by DGCA India',
    status: 'operational',
    headline: 'RNP 0.1 en route since 2013 and APV-I since 2015 (99 % of the time over 76 % of the Indian landmass), in the equatorial ionosphere.',
    services: [
      { level: 'RNP 0.1 en route (Indian FIRs)', year: 2013 },
      { level: 'APV-I, LPV to 250 ft (99 % of the time over 76 % of the Indian landmass)', year: 2015 },
    ],
    geos: [
      // ICAO APAC SBAS guidance (2025) §2.4: the uplink sends the messages to all three, and "the GEO satellites
      // broadcast these correction messages"; it does not say whether one of them is a standby.
      { name: 'GSAT-8', prn: 127, lonDeg: 55, role: 'operational' },
      { name: 'GSAT-10', prn: 128, lonDeg: 83, role: 'operational' },
      { name: 'GSAT-15', prn: 132, lonDeg: 93.5, role: 'operational' },
    ],
    ground: { reference: 15, master: 2, uplink: 3, note: 'AAI, 2025.' },
    dfmc: 'Reference stations ready for dual frequency; DFMC planned step by step, no date.',
    area: [[60, 25], [68, 37], [80, 36], [98, 29], [100, 18], [93, 5], [90, 0], [78, 0], [60, 8]],
    areaNote: 'Indian FIRs (RNP 0.1) and 76 % of the Indian landmass (APV-I, 99 % of the time).',
    claim: 'world.gagan',
  },
  {
    id: 'kass',
    name: 'KASS',
    full: 'Korea Augmentation Satellite System',
    region: 'Republic of Korea',
    provider: 'Ministry of Land, Infrastructure and Transport (MOLIT)',
    status: 'operational',
    headline: 'APV-I Safety-of-Life service in the Incheon FIR since December 2023; second GEO since February 2026.',
    services: [{ level: 'APV-I (Incheon FIR)', year: 2023 }],
    geos: [
      { name: 'MEASAT-3D', prn: 134, lonDeg: 91.5, role: 'operational' },
      { name: 'KOREASAT 6A', prn: 142, lonDeg: 116, role: 'operational' },
    ],
    ground: { reference: 7, master: 2, uplink: 3, note: 'Republic of Korea, ICAO APAC 2026.' },
    dfmc: 'L1 today; no DFMC date published.',
    area: [[124, 39.5], [130.5, 38.5], [132.5, 36], [130, 32], [125, 30], [123.5, 32], [123.5, 37.5]],
    areaNote: 'Incheon FIR.',
    claim: 'world.kass',
  },
  {
    id: 'southpan',
    name: 'SouthPAN',
    full: 'Southern Positioning Augmentation Network',
    region: 'Australia and New Zealand',
    provider: 'Geoscience Australia with Toitū Te Whenua LINZ',
    status: 'development',
    headline: 'Open services since 2022, not for aviation; Safety-of-Life aviation services planned from 2028.',
    services: [{ level: 'Safety-of-Life L1 SBAS for aviation (en route to LPV)', year: 2028, planned: true }],
    geos: [{ name: 'Inmarsat-4 F2 payload', prn: 122, lonDeg: 143.5, role: 'open service' }],
    ground: { reference: null, master: null, uplink: 2, note: 'Uplinks at Uralla (Australia) and Awarua (New Zealand); reference-station count not published.' },
    dfmc: 'An open DFMC signal is broadcast already; no date for a Safety-of-Life DFMC service.',
    area: [[113, -21], [129, -11], [142, -10], [154, -28], [166, -34], [179, -37], [178, -41], [167, -47], [146, -44], [115, -35]],
    areaNote: 'Mainland Australia and New Zealand (open service).',
    claim: 'world.southpan',
  },
  {
    id: 'bdsbas',
    name: 'BDSBAS',
    full: 'BeiDou Satellite-Based Augmentation System',
    region: 'China and surrounding areas',
    provider: 'Not named in the sources read',
    status: 'development',
    headline: 'In test and certification; not yet for civil aviation. LPV procedures expected around 2029.',
    services: [{ level: 'LPV', year: 2029, planned: true }],
    geos: [
      { name: 'BDS-3 GEO', prn: 130, lonDeg: 140, role: 'test' },
      { name: 'BDS-3 GEO', prn: 143, lonDeg: 110.5, role: 'test' },
      { name: 'BDS-3 GEO', prn: 144, lonDeg: 80, role: 'test' },
    ],
    ground: { reference: 30, master: 2, uplink: 3, note: 'Counts of 2021 (NAVIGATION journal).' },
    dfmc: 'Single-frequency and DFMC test services since 2020.',
    area: [[73, 39], [87, 49], [97, 42], [119, 50], [124, 53], [135, 48], [123, 39], [122, 30], [109, 18], [98, 22], [85, 28], [79, 32]],
    areaNote: 'China and surrounding areas (wording only, no official map).',
    claim: 'world.bdsbas',
  },
  {
    id: 'sdcm',
    name: 'SDCM',
    full: 'System for Differential Correction and Monitoring',
    region: 'Russia',
    provider: 'Not named in the sources read (status reported by Roscosmos)',
    status: 'development',
    headline: 'Pre-operational; passed preliminary certification tests for APV-I and APV-II (2024). Not certified for civil aviation.',
    services: [{ level: 'APV-I / APV-II (preliminary certification tests)', year: null }],
    geos: [
      { name: 'Luch-5B', prn: 125, lonDeg: -16, role: 'test' },
      { name: 'Luch-5V', prn: 140, lonDeg: 95, role: 'test' },
    ],
    ground: { reference: null, master: null, uplink: null, note: 'Counts not in the sources read.' },
    dfmc: 'L1/L5 DFMC planned; no date.',
    area: [[28, 56], [28, 70], [60, 72], [100, 78], [180, 70], [180, 64], [160, 52], [131, 42], [87, 49], [48, 41], [37, 46]],
    areaNote: 'Russia (wording only, no official map).',
    claim: 'world.sdcm',
  },
  {
    id: 'anga',
    name: 'A-SBAS (ANGA)',
    full: 'Augmented Navigation for Africa',
    region: 'Africa and the Indian Ocean (ASECNA States)',
    provider: 'ASECNA',
    status: 'development',
    headline: 'Demonstration signal since 2020, not usable by certified receivers; services expected from 2028/29.',
    services: [{ level: 'En route, NPA and APV-I', year: 2028, planned: true }],
    geos: [{ name: 'NigComSat-1R (demonstration)', prn: null, lonDeg: null, role: 'test' }],
    ground: { reference: null, master: null, uplink: null, note: 'Demonstration: reference stations, a prototype in Dakar, an uplink in Abuja; operational counts not published.' },
    dfmc: 'To augment GPS and Galileo; no DFMC date.',
    area: null,
    areaNote: 'No service area published yet.',
    claim: 'world.anga',
  },
  {
    id: 'paksbas',
    name: 'Pak-SBAS',
    full: 'Pakistan SBAS',
    region: 'Pakistan',
    provider: 'SUPARCO, with aviation support from the Pakistan Civil Aviation Authority and Pakistan Airports Authority',
    status: 'test',
    headline: 'Commissioned in 2024 and available for testing; aviation implementation being prepared.',
    services: [],
    geos: [{ name: 'PakSat-MM1', prn: 145, lonDeg: 38.2, role: 'test' }],
    ground: { reference: null, master: null, uplink: null, note: 'Counts not in the sources read.' },
    dfmc: 'No DFMC date.',
    area: null,
    areaNote: 'No service area published.',
    claim: 'world.paksbas',
  },
]

/** Earlier studies and test-beds the page mentions without a system card. */
export const SBAS_STUDIES: readonly { name: string; text: string; claim: string }[] = [
  { name: 'SACCSA', text: 'ICAO regional study for the Caribbean, Central and South America (2003–2015); closed, no system built.', claim: 'world.studies' },
  { name: 'UK SBAS test-bed', text: 'Test signal on PRN 158 under ESA NAVISP (phase 2 completed); no aviation service.', claim: 'world.studies' },
]

export const STATUS_TEXT: Readonly<Record<SystemStatus, string>> = {
  operational: 'Operational for aviation',
  development: 'In development',
  test: 'Test signal only',
}

/** The end-to-end chain, in seven steps, the same for every SBAS (claim world.architecture). */
export const SBAS_CHAIN: readonly { id: string; title: string; text: string }[] = [
  { id: 'gnss', title: 'GPS satellites', text: 'GPS satellites broadcast ranging signals. Their clocks and orbits are slightly wrong, and the ionosphere delays the signals.' },
  { id: 'reference', title: 'Reference stations', text: 'Receivers at precisely surveyed sites measure every satellite in view and send the raw data to the master stations, every second.' },
  { id: 'master', title: 'Master stations', text: 'The master stations compute corrections for each satellite and for the ionosphere, and how far each correction can be trusted (integrity).' },
  { id: 'uplink', title: 'Uplink stations', text: 'Uplink stations send the corrections and integrity data to the GEO satellites as messages: 250 bits, one per second.' },
  { id: 'geo', title: 'GEO satellites', text: 'Geostationary satellites broadcast the messages on the GPS L1 frequency, with a GPS-like signal, over the whole region.' },
  { id: 'aircraft', title: 'Aircraft receiver', text: 'The aircraft applies the corrections and computes protection levels: a bound on its position error it can trust.' },
  { id: 'approach', title: 'Approach', text: 'When the protection levels are within the alert limits (LPV-200: 40 m horizontal, 35 m vertical), the crew can fly the approach to LPV minima as low as 200 ft. If a fault makes the position unsafe, the system must warn the aircraft within 6 s of the fault.' },
]
