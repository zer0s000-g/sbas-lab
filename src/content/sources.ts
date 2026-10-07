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
  | 'gps-sps-ps-2020'
  | 'egnos-service-notice-34'
  | 'egnos-service-notice-35'
  | 'euspa-egnos-ws2022'
  | 'faa-cgsic-2026'
  | 'faa-waas-ps-2008'
  | 'icao-doc9613'
  | 'igrf-14'
  | 'faa-waas-pan97'
  | 'faa-waas-pan92'
  | 'faa-sbas-worldwide'
  | 'faa-waas-qfacts'
  | 'egnos-mpr-2026-08'
  | 'icao-apac-itf8-japan'
  | 'jcab-msas-2021'
  | 'icao-apac-itf7-india'
  | 'aai-gagan-2025'
  | 'icao-apac-itf8-korea'
  | 'icao-apac-itf8-report'
  | 'southpan-sdd'
  | 'navigation-bdsbas-2021'
  | 'roscosmos-icg18'
  | 'icao-a41-wp298'
  | 'asecna-anga-2024'
  | 'icao-sam-saccsa-2015'
  | 'esa-navisp-uksbas'
  | 'bkg-gdc'
  | 'euref-epn'
  | 'eu-2017-373-pers'
  | 'eu-2015-340'
  | 'essp-lpv-guidelines'
  | 'icao-doc9849-3rd'
  | 'canso-asecna-2020'
  | 'gfz-kp'
  | 'icao-apac-sbas-guidance-2025'

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
    title: 'Annex 10, Aeronautical Telecommunications, Volume I, Radio Navigation Aids (Chapter 3 §3.7; Appendix B; Attachment D)',
    edition: 'Eighth Edition, July 2023 (amendment pages dated 2/11/23)',
    publisher: 'ICAO',
    access: 'read',
    note: 'Read by the AI check (October 2026). The original build used it through Doc 9849 Table 2-1, which reproduces Table 3.7.2.4-1.',
  },
  'icao-doc4444': { id: 'icao-doc4444', title: 'Procedures for Air Navigation Services, Air Traffic Management (PANS-ATM), Doc 4444', edition: 'Sixteenth Edition, 2016, incl. Amendment 8 (later amendments to confirm)', publisher: 'ICAO', access: 'read' },
  'rtca-do229': { id: 'rtca-do229', title: 'DO-229, Minimum Operational Performance Standards for GPS/SBAS Airborne Equipment', edition: 'edition to confirm', publisher: 'RTCA', access: 'not-reached', note: 'Sold by RTCA; values marked "to confirm" wait for a reviewer with the document.' },
  'eurocae-ed259': { id: 'eurocae-ed259', title: 'ED-259, MOPS for Galileo/GPS/SBAS L1/L5 (DFMC) airborne equipment', edition: 'February 2019 (or later revision; to confirm)', publisher: 'EUROCAE', access: 'not-reached' },
  'nima-tr8350': { id: 'nima-tr8350', title: 'Department of Defense World Geodetic System 1984, TR8350.2', edition: 'Third Edition, amended', publisher: 'NIMA (now NGA)', access: 'not-reached' },
  'is-gps-200': { id: 'is-gps-200', title: 'Interface Specification IS-GPS-200, NAVSTAR GPS Space Segment/Navigation User Interfaces', edition: 'IS-GPS-200N', publisher: 'US Space Force', access: 'read' },
  'gps-gov-prn': { id: 'gps-gov-prn', title: 'GPS L1 C/A PRN code assignments', edition: 'January 2026 edition', publisher: 'gps.gov', url: 'https://www.gps.gov/technical/prn-codes/', access: 'via-search' },
  'egnos-sol-sdd': {
    id: 'egnos-sol-sdd',
    title: 'EGNOS Safety of Life (SoL) Service Definition Document',
    edition: 'Issue 3.6 (in force at the time of writing)',
    publisher: 'EUSPA',
    url: 'https://egnos.gsc-europa.eu/library/technical-documents',
    access: 'read',
    note: 'Read in full by the AI check (October 2026), including Figure 3 (the 38 RIMS sites); the original build used search results quoting it.',
  },
  'euspa-geo3-2025': { id: 'euspa-geo3-2025', title: 'EGNOS system release: GEO-3 satellite enters operational status', edition: 'August/September 2025', publisher: 'EUSPA', url: 'https://www.euspa.europa.eu/newsroom-events/news/egnos-system-release-geo-3', access: 'via-search' },
  'egnos-service-notice-33': { id: 'egnos-service-notice-33', title: 'EGNOS Service Notice 33', edition: '8 August 2025', publisher: 'ESSP / EGNOS user support', url: 'https://egnos.gsc-europa.eu/', access: 'read' },
  'egnos-service-notice-34': { id: 'egnos-service-notice-34', title: 'EGNOS Service Notice 34', edition: '8 September 2025', publisher: 'ESSP / EGNOS user support', url: 'https://egnos.gsc-europa.eu/sites/default/files/documents/service_notice-34.pdf', access: 'read' },
  'egnos-service-notice-35': { id: 'egnos-service-notice-35', title: 'EGNOS Service Notice 35', edition: '17 October 2025', publisher: 'ESSP / EGNOS user support', url: 'https://egnos.gsc-europa.eu/sites/default/files/documents/service_notice-35.pdf', access: 'read' },
  'egnos-realtime': { id: 'egnos-realtime', title: 'EGNOS user support, Realtime (GEO status)', edition: 'read on 5 October 2026', publisher: 'EGNOS user support', url: 'https://egnos.gsc-europa.eu/egnos-system/realtime', access: 'read' },
  'euspa-essp-contract': { id: 'euspa-essp-contract', title: 'EUSPA taps ESSP for EGNOS service provider role', edition: '6 September 2022', publisher: 'EUSPA', url: 'https://www.euspa.europa.eu/newsroom-events/news/euspa-taps-essp-egnos-service-provider-role', access: 'read' },
  'euspa-egnos-ws2022': { id: 'euspa-egnos-ws2022', title: 'EGNOS Programme Status (EGNOS Workshop 2022)', edition: '2022', publisher: 'EUSPA', url: 'https://egnos.gsc-europa.eu/sites/default/files/workshop2022/01.%20EGNOSProgrammeStatus2022.pdf', access: 'read' },
  'euspa-egnos-v3': {
    id: 'euspa-egnos-v3',
    title: 'EGNOS (programme status and roadmaps, EUSPA Industry Days 2026)',
    edition: '2026 deck (EUSPA document 02_EGNOS)',
    publisher: 'EUSPA',
    url: 'https://www.euspa.europa.eu/sites/default/files/documents/02_EGNOS.pdf',
    access: 'read',
    note: 'The infrastructure and services roadmaps are bar charts without exact dates; years are read from the bar positions.',
  },
  'essp-ewa-2024': { id: 'essp-ewa-2024', title: 'EWA for SoL aviation users (ESSP presentation)', edition: 'March 2024', publisher: 'ESSP', url: 'https://egnos.gsc-europa.eu/sites/default/files/2024-03/9.%20ESSP%20JAL%20-%20EWA%20for%20SoL%20AV%20users.pdf', access: 'read' },
  'egnos-sp-report': { id: 'egnos-sp-report', title: 'EGNOS Service Provision Yearly Report', edition: '2021–2022', publisher: 'ESSP', access: 'via-search' },
  'eu-decision-2017-1406': { id: 'eu-decision-2017-1406', title: 'Commission Implementing Decision (EU) 2017/1406 on the location of the ground-based infrastructure of EGNOS', edition: '31 July 2017', publisher: 'European Commission', url: 'https://eur-lex.europa.eu/eli/dec_impl/2017/1406/oj/eng', access: 'read', note: 'The legal location list; the current RIMS network (SoL SDD v3.6 Figure 3) no longer has every site it names (Alexandria, Abu Simbel, Kourou).' },
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
  'gps-sps-ps-2020': {
    id: 'gps-sps-ps-2020',
    title: 'Global Positioning System Standard Positioning Service Performance Standard (SPS PS)',
    edition: '5th Edition, April 2020',
    publisher: 'US Department of Defense',
    url: 'https://archive.gps.gov/technical/ps/2020-SPS-performance-standard.pdf',
    access: 'read',
  },
  'faa-cgsic-2026': { id: 'faa-cgsic-2026', title: 'FAA Navigation Programs (D. Lawrence, CGSIC briefing)', edition: 'April 2026', publisher: 'FAA', url: 'https://www.gps.gov/sites/default/files/2026-04/Lawrence%20CGSIC%20Apr%202026%20FAA%20Navigation%20Programs_Final.pdf', access: 'read' },
  'faa-waas-ps-2008': { id: 'faa-waas-ps-2008', title: 'Global Positioning System Wide Area Augmentation System (WAAS) Performance Standard', edition: '1st Edition, 31 October 2008', publisher: 'FAA', url: 'https://gssc.esa.int/navipedia/index.php/WAAS_Performances', access: 'via-search', note: 'Read through the table ESA Navipedia reproduces from it.' },
  'icao-doc9613': { id: 'icao-doc9613', title: 'Performance-based Navigation (PBN) Manual, Doc 9613', edition: 'Fifth Edition, 2023', publisher: 'ICAO', access: 'read' },
  'igrf-14': {
    id: 'igrf-14',
    title: 'International Geomagnetic Reference Field, 14th generation (IGRF-14)',
    edition: '2024 release; evaluated at epoch 2025.0',
    publisher: 'IAGA',
    url: 'https://www.ncei.noaa.gov/products/international-geomagnetic-reference-field',
    access: 'read',
    note: 'The dip equator was computed from the IGRF-14 coefficients (ppigrf 2.1.0), not read off a map.',
  },
  'esa-ems': { id: 'esa-ems', title: 'EGNOS Message Server (EMS) User Interface Document', edition: 'Issue 2.0', publisher: 'ESA', url: 'http://www.egnos-pro.esa.int/ems/', access: 'via-search' },
  'faa-waas-pan97': { id: 'faa-waas-pan97', title: 'WAAS Performance Analysis Report #97 (1 April to 30 June 2026)', edition: 'July 2026', publisher: 'FAA William J. Hughes Technical Center', url: 'https://www.nstb.tc.faa.gov/reports/FAA_WAAS_PAN_Report_97_v1.0.pdf', access: 'read' },
  'faa-waas-pan92': { id: 'faa-waas-pan92', title: 'WAAS Performance Analysis Report #92 (1 January to 31 March 2025)', edition: 'April 2025', publisher: 'FAA William J. Hughes Technical Center', url: 'https://www.nstb.tc.faa.gov/reports/', access: 'read', note: 'Table 5-3 lists the WAAS message time-outs (UDREI 12/18 s, long-term 240/360 s, ionosphere 600 s).' },
  'faa-sbas-worldwide': { id: 'faa-sbas-worldwide', title: 'SBAS Worldwide fact sheet', edition: 'rev. 27 November 2025', publisher: 'FAA', url: 'https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/techops/navservices/gnss/library/factsheets/sbas_worldwide-reduced.pdf', access: 'read' },
  'faa-waas-qfacts': { id: 'faa-waas-qfacts', title: 'WAAS Quick Facts', edition: 'rev. 27 November 2025', publisher: 'FAA', url: 'https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/techops/navservices/gnss/library/factsheets/waas-qfacts-reduced.pdf', access: 'read' },
  'egnos-mpr-2026-08': { id: 'egnos-mpr-2026-08', title: 'EGNOS Services Monthly Performance Report, August 2026 (No. 184)', edition: 'Issue 1.0, 7 September 2026', publisher: 'ESSP / EUSPA', url: 'https://egnos.gsc-europa.eu/sites/default/files/documents/184%20-%20Monthly%20Performance%20Report%20-%20August%202026.pdf', access: 'read' },
  'icao-apac-itf8-japan': { id: 'icao-apac-itf8-japan', title: 'GBAS/SBAS ITF/8 IP/05: Update on SBAS implementation status in Japan', edition: 'May 2026', publisher: 'Japan (JCAB) via ICAO Asia/Pacific Office', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2026/GBAS-SBAS%20ITF%208/WPs%20IPs%20Presentations/IP05%20AI4%20Updates%20on%20SBAS%20system%20and%20implementation%20status%20in%20Japan.pdf', access: 'read' },
  'jcab-msas-2021': { id: 'jcab-msas-2021', title: 'MSAS status and future plan (GBAS/SBAS ITF/3 WP/04)', edition: 'September 2021', publisher: 'JCAB, MLIT via ICAO Asia/Pacific Office', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2021/2021%20Third%20meeting%20of%20GBAS%20SBAS%20Implementation%20Task%20Force%20GBAS%20SBAS%20ITF3/3-Working%20Papers/Agenda-3-WP-04-MSAS-Status-and-future-plan_Sep_2021_Japan.pdf', access: 'read' },
  'icao-apac-itf7-india': { id: 'icao-apac-itf7-india', title: 'GBAS/SBAS ITF/7 IP/05b: GAGAN based LPV procedure implementation update in India', edition: 'May 2025', publisher: 'India (AAI) via ICAO Asia/Pacific Office', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2025/2025%20GBASSBAS%20ITF7/4-Information%20Papers/A4-IP05b-GAGAN-SBAS-BASED-LPV-PROCEDURE-IMPLEMENTATION-UPDATE-IN-INDIA.pdf', access: 'read' },
  'aai-gagan-2025': { id: 'aai-gagan-2025', title: 'GAGAN System (ICAO APAC SBAS-GBAS Implementation Workshop for Airspace Users)', edition: '14 October 2025', publisher: 'Airports Authority of India', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2025/2025%20GBASSBAS%20Implementation%20Workshop%20for%20Air%20Space/Presentations/1-1-6-GAGAN-system-Venugopal.pdf', access: 'read' },
  'icao-apac-itf8-korea': { id: 'icao-apac-itf8-korea', title: 'GBAS/SBAS ITF/8 IP/07: Korean SBAS (KASS) operations using the 2nd GEO satellite', edition: 'May 2026', publisher: 'Republic of Korea (MOLIT) via ICAO Asia/Pacific Office', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2026/GBAS-SBAS%20ITF%208/WPs%20IPs%20Presentations/IP07%20AI4%20KOREAN%20SBAS%20KASS%20Operations%20using%202nd%20GEO%20satellite.pdf', access: 'read' },
  'icao-apac-itf8-report': { id: 'icao-apac-itf8-report', title: 'Report of the Eighth Meeting of the ICAO Asia/Pacific GBAS/SBAS Implementation Task Force', edition: 'May 2026 (draft)', publisher: 'ICAO Asia/Pacific Office', url: 'https://www.icao.int/sites/default/files/APAC/Meetings/2026/GBAS-SBAS%20ITF%208/Report/Final-Report-GBAS-SBAS-ITF-8.pdf', access: 'read' },
  'southpan-sdd': { id: 'southpan-sdd', title: 'SouthPAN Service Definition Document for Signal-In-Space Open Services (SBAS-STN-0001)', edition: 'Rev 04, 9 April 2026', publisher: 'Geoscience Australia and Toitū Te Whenua LINZ', url: 'https://www.ga.gov.au/scientific-topics/positioning-navigation/positioning-australia/about-the-program/southpan', access: 'read' },
  'navigation-bdsbas-2021': { id: 'navigation-bdsbas-2021', title: 'Development of BeiDou Satellite-Based Augmentation System, NAVIGATION 68(2):405–417', edition: 'June 2021', publisher: 'Institute of Navigation', url: 'https://navi.ion.org/content/navi/68/2/405.full.pdf', access: 'read' },
  'roscosmos-icg18': { id: 'roscosmos-icg18', title: 'GLONASS Status (ICG-18, Tokyo)', edition: '13 February 2024', publisher: 'Roscosmos via UNOOSA/ICG', url: 'https://www.unoosa.org/documents/pdf/icg/2024/Tokyo2024/A04_GLONASS.pdf', access: 'read' },
  'icao-a41-wp298': { id: 'icao-a41-wp298', title: 'A41-WP/298: Progress on the implementation of GNSS/SBAS in Africa', edition: '8 August 2022', publisher: 'AFCAC, ICAO Assembly 41st Session', url: 'https://www.icao.int/sites/default/files/sp-files/Meetings/a41/Documents/WP/wp_298_en.pdf', access: 'read' },
  'asecna-anga-2024': { id: 'asecna-anga-2024', title: 'Seychelles Civil Aviation Authority and ASECNA: ANGA programme (press release)', edition: 'December 2024', publisher: 'ASECNA', url: 'https://www.asecna.aero/', access: 'read' },
  'icao-sam-saccsa-2015': { id: 'icao-sam-saccsa-2015', title: 'SAM/IG/15-WP/12: Follow-up to activities of Regional Project RLA/03/902 (SACCSA)', edition: '30 April 2015', publisher: 'ICAO South American Regional Office', url: 'https://www.icao.int/sites/default/files/sp-files/SAM/Documents/2015-SAMIG15/SAMIG15_WP12%20SACCSA.pdf', access: 'read' },
  'esa-navisp-uksbas': { id: 'esa-navisp-uksbas', title: 'NAVISP-EL3-025: UK SBAS Test-Bed Phase 2', edition: 'page updated 31 August 2026', publisher: 'ESA NAVISP', url: 'https://navisp.esa.int/project/details/247/show', access: 'read' },
  'bkg-gdc': { id: 'bkg-gdc', title: 'BKG GNSS Data Center: IGS broadcast ephemeris (BRDC00IGS) and EUREF observation files, 30 September 2026', edition: 'day 273 of 2026', publisher: 'Bundesamt für Kartographie und Geodäsie (BKG)', url: 'https://igs.bkg.bund.de/', access: 'read' },
  'euref-epn': { id: 'euref-epn', title: 'EUREF Permanent GNSS Network: station data', edition: 'CC BY 4.0', publisher: 'EUREF', url: 'https://epncb.oma.be/', access: 'read' },
  'eu-2017-373-pers': { id: 'eu-2017-373-pers', title: 'Commission Implementing Regulation (EU) 2017/373, Annex XIII (Part-PERS), with AMC/GM (ED Decision 2020/020/R)', edition: 'Easy Access Rules for ATM/ANS, revision March 2025', publisher: 'EU / EASA', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017R0373', access: 'read' },
  'eu-2015-340': { id: 'eu-2015-340', title: 'Commission Regulation (EU) 2015/340, Annex I (Part ATCO), with AMC1 ATCO.D.010 (ED Decision 2023/011/R)', edition: 'Easy Access Rules for ATCO, revision March 2024', publisher: 'EU / EASA', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32015R0340', access: 'read' },
  'essp-lpv-guidelines': { id: 'essp-lpv-guidelines', title: 'Guidelines for ANSP/Airports and Aircraft Operators for LPV implementation', edition: 'September 2015', publisher: 'ESSP', access: 'read' },
  'icao-doc9849-3rd': { id: 'icao-doc9849-3rd', title: 'Global Navigation Satellite System (GNSS) Manual, Doc 9849', edition: 'Third Edition, 2017', publisher: 'ICAO', access: 'read', note: 'The edition the curriculum mapping cites by section.' },
  'canso-asecna-2020': { id: 'canso-asecna-2020', title: 'ASECNA launch pre-operational SBAS service', edition: '25 September 2020', publisher: 'CANSO (relaying ASECNA)', url: 'https://canso.org/asecna-launch-pre-operational-sbas-service/', access: 'read' },
  'gfz-kp': { id: 'gfz-kp', title: 'Geomagnetic Kp index (nowcast)', edition: 'preliminary values for 30 September 2026 (Kp at most 0.7)', publisher: 'GFZ German Research Centre for Geosciences', url: 'https://kp.gfz.de/', access: 'read', note: 'CC BY 4.0.' },
  'icao-apac-sbas-guidance-2025': {
    id: 'icao-apac-sbas-guidance-2025',
    title: 'Guidance Document for Implementation of SBAS in the Asia/Pacific Region (Attachment A to the GBAS/SBAS ITF/7 report)',
    edition: 'May 2025 (draft for endorsement, CNS SG/29 WP/11, June 2025)',
    publisher: 'ICAO Asia/Pacific GBAS/SBAS Implementation Task Force',
    access: 'read',
    note: 'Its §2.4-2.5 on GAGAN quote the certified performance and e-AIP India ENR 4.3.',
  },
}
