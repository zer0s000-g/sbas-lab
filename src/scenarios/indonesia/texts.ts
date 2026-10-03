/**
 * The words the page's panels, guided stops, footer and text alternatives use in the
 * AirNav Indonesia scenario.
 */
import type { ScenarioDef } from '../types'
import { HYPOTHETICAL } from './region'

export const TEXTS: ScenarioDef['texts'] = {
  flightNote: `Real airports and Michibiki satellites. The SBAS service, its ground sites and the route are ${HYPOTHETICAL}.`,
  statusNote:
    'The DFMC service belongs to the hypothetical Indonesian SBAS. Real DFMC services are planned, not yet in operation (Doc 9849 §4.3.4.5); Japan tests DFMC on Michibiki’s L5 signal.',
  benefitGate: 'No navigation integrity requirement at the gate. The crew check the SBAS forecast and NOTAMs.',
  benefitLanding: 'On the ground: no navigation integrity requirement. SBAS brought LAB201 down to LPV minima at Bali with satellite signals alone.',
  benefitCompareNote: 'L1 only: the same approach with the single-frequency grid. Near the equator its VPL is too large for LPV (Doc 9849 §5.2.1.5).',
  serviceNames: { dfmc: 'DFMC SBAS (L1/L5)', l1: 'L1 SBAS', off: 'Off (GPS alone)' },
  stops: {
    firstFix: { title: 'First fix from GPS alone', body: 'LAB201 knows where it is from GPS alone: a few metres off, with a large protection level and no vertical guarantee.' },
    firstCorrection: { title: 'The first correction has arrived', body: 'The SBAS messages from QZS-3 and QZS-6 have reached LAB201. Its position jumps toward the truth and the protection cylinder shrinks to a few metres.' },
    lpvEngaged: { title: 'LPV engaged', body: 'On final to runway 09 at Bali with SBAS vertical guidance. The protection levels are inside HAL 40 m and VAL 50 m, so the avionics annunciate LPV.' },
    touchdown: { title: 'Touchdown in Bali', body: 'An approach with vertical guidance from the satellites alone, after SBAS guided every phase of the flight from Jakarta.' },
  },
  footer:
    'The simulation is simplified to teach principles. Technical values follow ICAO Annex 10 Volume I and RTCA DO-229 where stated and should be checked by a qualified GNSS/CNS engineer. Indonesia has no operational SBAS today: the SBAS service, its ground sites and the LPV procedure shown are hypothetical. QZS-3 and QZS-6 are real Japanese Michibiki satellites, shown here for illustration; MSAS, the SBAS they carry, serves Japan.',
  networkHonesty: 'Map of Indonesia to scale · ground sites illustrative · hypothetical Indonesian SBAS',
  describeSpace: 'Space view: the Earth, the GPS constellation and the Michibiki SBAS GEOs over Indonesia.',
  describeNetwork:
    'Network map of Indonesia: the hypothetical SBAS ground segment, with RIMS reference stations, master control centres, uplink stations and the ionospheric grid.',
  describeClimb: 'over the Java Sea',
  describeCruise: 'along Java, with the Java Sea to the north and the volcanoes below',
  describeFinal: 'over the sea with the coast and the runway ahead',
  uplinkCode: 'GUS',
  stationsLegend: '▲ RIMS  ■ master centre  ◠ uplink station',
  availabilityLegend: '▦ LPV available (tinted area)',
  routeLegend: '┄ LAB201 route, Jakarta to Bali',
}
