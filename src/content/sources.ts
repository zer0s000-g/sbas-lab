/**
 * The documents SBAS Lab's claims rest on (src/content/claims). Each names its edition
 * or date where one is known, and how this build reached it: some primary documents
 * are sold or restricted (ICAO, RTCA, EUROCAE) and were used through ICAO Doc 9849 or
 * public summaries; some public pages could only be read through search results quoting
 * them. A claim's status (src/content/claims/types.ts) says how far it has been checked.
 */

export type SourceId =
  | 'icao-doc9849'
  | 'icao-annex10'
  | 'icao-doc4444'
  | 'rtca-do229'
  | 'eurocae-ed259'
  | 'nima-tr8350'
  | 'is-gps-200'
  | 'gps-gov-prn'
  | 'egnos-sol-sdd'
  | 'euspa-geo3-2025'
  | 'egnos-service-notice-33'
  | 'egnos-realtime'
  | 'euspa-essp-contract'
  | 'euspa-egnos-v3'
  | 'essp-ewa-2024'
  | 'egnos-sp-report'
  | 'eu-decision-2017-1406'
  | 'esa-egnos'
  | 'eurocontrol-fasdb'
  | 'ourairports'
  | 'natural-earth'
  | 'aip-indonesia'
  | 'aip-france'
  | 'jcab-ews2025'
  | 'icao-apac-ip15'
  | 'egnos-toolkit'
  | 'rtklib'
  | 'esa-ems'

export interface SourceDoc {
  id: SourceId
  title: string
  /** Edition, version or date, as far as known. */
  edition: string
  publisher: string
  /** Where to get it (public pages only). */
  url?: string
  /** How this build used it. */
  access: 'read' | 'via-search' | 'via-doc9849' | 'not-reached'
  note?: string
}

export const SOURCES: Readonly<Record<SourceId, SourceDoc>> = {
  'icao-doc9849': { id: 'icao-doc9849', title: 'Global Navigation Satellite System (GNSS) Manual, Doc 9849', edition: 'Fifth Edition, 2025', publisher: 'ICAO', access: 'read', note: 'The primary source of the original build (docs/SOURCES.md).' },
  'icao-annex10': {
    id: 'icao-annex10',
    title: 'Annex 10, Aeronautical Telecommunications, Volume I, Radio Navigation Aids (Chapter 3 §3.7; Appendix B)',
    edition: 'edition and amendment to confirm',
    publisher: 'ICAO',
    access: 'via-doc9849',
    note: 'Used through Doc 9849 Table 2-1, which reproduces Table 3.7.2.4-1, and public summaries of it.',
  },
  'icao-doc4444': { id: 'icao-doc4444', title: 'Procedures for Air Navigation Services, Air Traffic Management (PANS-ATM), Doc 4444', edition: 'Sixteenth Edition, as amended (to confirm)', publisher: 'ICAO', access: 'not-reached' },
  'rtca-do229': { id: 'rtca-do229', title: 'DO-229, Minimum Operational Performance Standards for GPS/SBAS Airborne Equipment', edition: 'edition to confirm', publisher: 'RTCA', access: 'not-reached', note: 'Sold by RTCA; values marked "to confirm" wait for a reviewer with the document.' },
  'eurocae-ed259': { id: 'eurocae-ed259', title: 'ED-259, MOPS for Galileo/GPS/SBAS L1/L5 (DFMC) airborne equipment', edition: 'February 2019 (or later revision; to confirm)', publisher: 'EUROCAE', access: 'not-reached' },
  'nima-tr8350': { id: 'nima-tr8350', title: 'Department of Defense World Geodetic System 1984, TR8350.2', edition: 'Third Edition, amended', publisher: 'NIMA (now NGA)', access: 'not-reached' },
  'is-gps-200': { id: 'is-gps-200', title: 'Interface Specification IS-GPS-200, NAVSTAR GPS Space Segment/Navigation User Interfaces', edition: 'current revision (to confirm)', publisher: 'US Space Force', access: 'not-reached' },
  'gps-gov-prn': { id: 'gps-gov-prn', title: 'GPS L1 C/A PRN code assignments', edition: 'January 2026 edition', publisher: 'gps.gov', url: 'https://www.gps.gov/technical/prn-codes/', access: 'via-search' },
  'egnos-sol-sdd': {
    id: 'egnos-sol-sdd',
    title: 'EGNOS Safety of Life (SoL) Service Definition Document',
    edition: 'v3.6 (in force at the time of writing)',
    publisher: 'EUSPA',
    url: 'https://egnos.gsc-europa.eu/library/technical-documents',
    access: 'via-search',
    note: 'The EGNOS user support site was not reachable from the build environment; facts were taken from search results quoting it. To be read in full by the reviewer.',
  },
  'euspa-geo3-2025': { id: 'euspa-geo3-2025', title: 'EGNOS system release: GEO-3 satellite enters operational status', edition: 'August/September 2025', publisher: 'EUSPA', url: 'https://www.euspa.europa.eu/newsroom-events/news/egnos-system-release-geo-3', access: 'via-search' },
  'egnos-service-notice-33': { id: 'egnos-service-notice-33', title: 'EGNOS Service Notice 33', edition: '2025', publisher: 'ESSP / EGNOS user support', url: 'https://egnos.gsc-europa.eu/', access: 'via-search' },
  'egnos-realtime': { id: 'egnos-realtime', title: 'EGNOS user support, Realtime (GEO status)', edition: 'consulted through search, 2026', publisher: 'EGNOS user support', url: 'https://egnos.gsc-europa.eu/egnos-system/realtime', access: 'via-search' },
  'euspa-essp-contract': { id: 'euspa-essp-contract', title: 'EUSPA taps ESSP for EGNOS service provider role', edition: 'September 2022', publisher: 'EUSPA', url: 'https://www.euspa.europa.eu/newsroom-events/news/euspa-taps-essp-egnos-service-provider-role', access: 'via-search' },
  'euspa-egnos-v3': { id: 'euspa-egnos-v3', title: 'EGNOS (programme overview, EGNOS v3 timeline)', edition: 'EUSPA document 02_EGNOS', publisher: 'EUSPA', url: 'https://www.euspa.europa.eu/sites/default/files/documents/02_EGNOS.pdf', access: 'via-search' },
  'essp-ewa-2024': { id: 'essp-ewa-2024', title: 'EWA for SoL aviation users (ESSP presentation)', edition: 'March 2024', publisher: 'ESSP', url: 'https://egnos.gsc-europa.eu/sites/default/files/2024-03/9.%20ESSP%20JAL%20-%20EWA%20for%20SoL%20AV%20users.pdf', access: 'via-search' },
  'egnos-sp-report': { id: 'egnos-sp-report', title: 'EGNOS Service Provision Yearly Report', edition: '2021–2022', publisher: 'ESSP', access: 'via-search' },
  'eu-decision-2017-1406': { id: 'eu-decision-2017-1406', title: 'Commission Implementing Decision (EU) 2017/1406 on the location of the ground-based infrastructure of EGNOS', edition: '31 July 2017', publisher: 'European Commission', url: 'https://eur-lex.europa.eu/eli/dec_impl/2017/1406/oj/eng', access: 'via-search', note: 'Later decisions may amend the list; to confirm.' },
  'esa-egnos': { id: 'esa-egnos', title: 'ESA pages on EGNOS (How does EGNOS work; EGNOS ground segment)', edition: 'various', publisher: 'ESA', access: 'via-search' },
  'eurocontrol-fasdb': { id: 'eurocontrol-fasdb', title: 'SBAS FAS Data Block Tool, source reference documentation', edition: 'online tool', publisher: 'EUROCONTROL', url: 'https://fasdb.eurocontrol.int/fasdb/app/help.htm', access: 'via-search' },
  ourairports: { id: 'ourairports', title: 'OurAirports runway data (runways.csv)', edition: 'downloaded 3 October 2026', publisher: 'OurAirports (public domain)', url: 'https://ourairports.com/data/', access: 'read', note: 'A community database; it reproduces AIP data but is not an official source.' },
  'natural-earth': { id: 'natural-earth', title: 'Natural Earth land polygons, 1:10m, 1:50m and 1:110m', edition: 'version 5.x', publisher: 'Natural Earth (public domain)', url: 'https://www.naturalearthdata.com/', access: 'read' },
  'aip-indonesia': { id: 'aip-indonesia', title: 'AIP Indonesia, AD 2 (WIII, WADD)', edition: 'current AIRAC (to confirm)', publisher: 'Indonesia AIS', access: 'not-reached' },
  'aip-france': { id: 'aip-france', title: 'AIP France, AD 2 (LFBO, LFMN)', edition: 'current AIRAC (to confirm)', publisher: 'SIA France', url: 'https://www.sia.aviation-civile.gouv.fr/', access: 'not-reached' },
  'jcab-ews2025': { id: 'jcab-ews2025', title: 'MSAS (Michibiki Satellite-based Augmentation Service), JCAB / JRANSA', edition: 'EGNOS Workshop 2025, Berlin', publisher: 'JCAB', access: 'read' },
  'icao-apac-ip15': { id: 'icao-apac-ip15', title: 'ICAO APAC CNS SG/24 IP15 (Japan)', edition: '2020', publisher: 'ICAO APAC', access: 'read' },
  'egnos-toolkit': {
    id: 'egnos-toolkit',
    title: 'EGNOS Toolkit (libegnos) 0.5.1, with its example EMS file 20110325h15.ems',
    edition: '0.5.1 (2012), EUPL v1.1',
    publisher: 'EGNOS Toolkit authors (SourceForge)',
    url: 'https://sourceforge.net/projects/libegnos/',
    access: 'read',
    note: 'An hour of EGNOS messages recorded by ESA’s EGNOS Message Server (EMS).',
  },
  rtklib: { id: 'rtklib', title: 'RTKLIB, src/sbas.c', edition: '2.4.x', publisher: 'T. Takasu (BSD 2-clause)', url: 'https://github.com/tomojitakasu/RTKLIB', access: 'read', note: 'An independent SBAS message decoder, used to cross-check SBAS Lab’s.' },
  'esa-ems': { id: 'esa-ems', title: 'EGNOS Message Server (EMS) User Interface Document', edition: 'Issue 2.0', publisher: 'ESA', url: 'http://www.egnos-pro.esa.int/ems/', access: 'via-search' },
}
