/**
 * The words the page's panels, guided stops, footer and text alternatives use in the
 * ESSP-SAS scenario.
 */
import type { ScenarioDef } from '../types'

export const TEXTS: ScenarioDef['texts'] = {
  flightNote: 'Real airports, the real EGNOS satellites, and real EGNOS ground sites at city level. The route, the LPV procedure at Nice and the uplink pairing are illustrative.',
  statusNote: 'EGNOS v2 broadcasts L1 SBAS today. A dual-frequency (DFMC) service is planned for EGNOS v3 (EUSPA: early 2030s); the "EGNOS v3 preview" switch shows it.',
  benefitGate: 'No navigation integrity requirement at the gate. The crew check the NOTAMs, including any proposed by ESSP for EGNOS LPV unavailability.',
  benefitLanding: 'On the ground: no navigation integrity requirement. EGNOS brought LAB201 down to LPV-200 minima at Nice with satellite signals alone.',
  benefitCompareNote: 'L1 only: EGNOS v2 today, on the same satellites. Over Europe its VPL fits LPV-200 too; dual-frequency helps most in storms and near the equator.',
  serviceNames: { l1: 'EGNOS v2 · L1 SBAS', dfmc: 'EGNOS v3 DFMC (planned)', off: 'Off (GPS alone)' },
  stops: {
    firstFix: { title: 'First fix from GPS alone', body: 'LAB201 knows where it is from GPS alone: a few metres off, with a large protection level and no vertical guarantee.' },
    firstCorrection: { title: 'The first correction has arrived', body: 'The EGNOS messages from SES-5 and Eutelsat 5 West B have reached LAB201. Its position jumps toward the truth and the protection cylinder shrinks to a few metres.' },
    lpvEngaged: { title: 'LPV engaged', body: 'On final to runway 04L at Nice with EGNOS vertical guidance. The protection levels are inside HAL 40 m and VAL 35 m, so the avionics annunciate LPV, flown to LPV-200 minima.' },
    touchdown: { title: 'Touchdown in Nice', body: 'An approach with vertical guidance from the satellites alone, after EGNOS guided every phase of the flight from Toulouse.' },
  },
  footer:
    'The simulation is simplified to teach principles. Technical values follow ICAO Annex 10 Volume I, ICAO Doc 9849 and RTCA DO-229 where stated; every claim’s source and review status is listed under Sources, and they should be checked by a qualified GNSS/CNS engineer. EGNOS is the European SBAS; ESSP provides the EGNOS service under contract to EUSPA. The route, the LPV procedure at Nice and the uplink pairing shown are illustrative, not published data. This page is not published or endorsed by ESSP or EUSPA.',
  networkHonesty: 'Map of Europe · EGNOS sites named in public sources, at city level, not all of them · uplink pairing illustrative',
  spaceHonestySites: 'ground sites at city level · uplink pairing illustrative',
  describeSpace: 'Space view: the Earth, the GPS constellation and the EGNOS GEOs SES-5 and Eutelsat 5 West B over Europe.',
  describeNetwork: 'Network map of Europe: EGNOS ground sites named in public sources (RIMS reference stations, the two mission control centres and the uplink stations) and the ionospheric grid.',
  describeClimb: 'over the Lauragais toward the Mediterranean',
  describeCruise: 'over the Gulf of Lion, with the French coast to the north',
  describeFinal: 'over the Baie des Anges with the coast and the runway ahead',
  uplinkCode: 'NLES',
  stationsLegend: '▲ RIMS  ■ mission control centre  ◠ uplink station (NLES)',
  availabilityLegend: '▦ LPV-200 available (tinted area)',
  routeLegend: '┄ LAB201 route, Toulouse to Nice',
}
