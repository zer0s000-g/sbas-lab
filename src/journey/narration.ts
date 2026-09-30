/**
 * What the page says in each phase, in plain language (CLAUDE.md: analogy first, jargon
 * gets tooltips, formulas only in "Go deeper"). Each entry names its Doc 9849 sources
 * (docs/SOURCES.md). Stage 4 turns the bracketed terms into <Term> tooltips.
 */
import type { PhaseId } from './phases'

export interface Narration {
  title: string
  /** What is happening now. */
  now: string
  /** What SBAS gives LAB201 in this phase. */
  benefit: string
  source: string
}

export const NARRATION: Readonly<Record<PhaseId, Narration>> = {
  gate: {
    title: 'SBAS is a service you plan on',
    now: 'Before departure the crew check the forecast of SBAS approach availability at Coral Isle and the NOTAMs, just as they check the weather.',
    benefit: 'The destination has no ILS. Its RNP approach with LPV minima needs only the satellite signals, no equipment at the airport.',
    source: 'Doc 9849 §4.3.3.1, §4.3.3.4.1',
  },
  takeoff: {
    title: 'A first fix from GPS alone',
    now: 'The receiver measures its distance to each satellite it can see and works out where it is. Watch the GPS-only dot next to the true position.',
    benefit: 'SBAS supports departures too: it tells the receiver which satellites to trust and corrects their clocks and orbits.',
    source: 'Doc 9849 §3.1, §4.3.1.5',
  },
  climb: {
    title: 'Why four satellites',
    now: 'Three distances fix a point in space. A fourth is needed because the receiver clock is not perfect. The spread of the satellites in the sky, the DOP, sets how errors grow into position errors.',
    benefit: 'In the terminal area the alert limit is 1 NM (1.85 km) with 15 s to alert. With SBAS the protection level is a few metres.',
    source: 'Doc 9849 §3.1, Table 2-1',
  },
  errors: {
    title: 'What makes a range wrong',
    now: 'Slowed down so you can see it: one satellite range, broken into its errors. They come from the satellite clock, the orbit, the ionosphere (usually the largest), the troposphere, multipath and noise.',
    benefit: 'SBAS corrects the clock, orbit and ionosphere errors for the whole region. The receiver models the troposphere. Multipath and noise stay.',
    source: 'Doc 9849 §4.3.1.1, §5.2.1',
  },
  reference: {
    title: 'Surveyors at known spots',
    now: 'Reference stations at surveyed positions listen to the same satellites. Because they know exactly where they are, every difference they measure is a satellite or ionosphere error.',
    benefit: 'A network spread over the region can see the errors that every aircraft in it would see.',
    source: 'Doc 9849 §4.3.1.1',
  },
  master: {
    title: 'The master station',
    now: 'The master station turns the measurements into corrections for each satellite, a grid of ionospheric delays, and a bound on what is left (UDRE, GIVE). A satellite it cannot trust is set to "Do not use".',
    benefit: 'The corrections come with integrity: the aircraft knows how far to trust them.',
    source: 'Doc 9849 §4.3.1.1–4.3.1.4.2',
  },
  uplink: {
    title: 'Up to the GEO satellite',
    now: 'An uplink station sends the messages to a geostationary satellite 35 786 km above the equator, which stays over the same spot on Earth.',
    benefit: 'One GEO can reach aircraft across a whole region at once.',
    source: 'Doc 9849 §4.3.1.2',
  },
  broadcast: {
    title: 'The first correction arrives',
    now: 'The GEO rebroadcasts the messages on the GPS frequencies, one message each second. LAB201 applies the first corrections: the position jumps toward the truth and the protection cylinder appears.',
    benefit: 'From now on LAB201 knows its position to about a metre, with a protection level it can trust.',
    source: 'Doc 9849 §4.3.1.2, §4.3.2.3–4.3.2.4',
  },
  cruise: {
    title: 'En route with integrity',
    now: 'At cruise the alert limit is 2 NM (3.7 km) with 5 minutes to alert. The SBAS protection level is hundreds of times smaller.',
    benefit: 'LAB201 broadcasts this position on ADS-B. Its integrity lets the controller trust the position shown on the screen.',
    source: 'Doc 9849 Table 2-1, §1.4.3, §2.2.4.6',
  },
  descent: {
    title: 'Loading the approach',
    now: 'The crew load the RNP approach from the database (or by its channel number). A CRC checks that its final approach data block is unchanged. The receiver tracks two SBAS satellites and arms "LPV".',
    benefit: 'The final approach path lives in the aircraft database, so no ILS antennas need maintaining or flight-checking.',
    source: 'Doc 9849 §4.3.2.7, §4.3.2.9, §4.3.2.10',
  },
  final: {
    title: 'LPV engaged',
    now: 'On final the limits are tight: HAL 40 m, VAL 50 m, 10 s to alert. The protection cylinder must stay inside the alert-limit wireframe all the way to the decision altitude.',
    benefit: 'Dual-frequency SBAS removes the ionospheric delay, so near the equator LPV is available where single-frequency SBAS could not provide it.',
    source: 'Doc 9849 Table 2-1, §5.2.1.5, §6.8.2',
  },
  landing: {
    title: 'Down at Coral Isle',
    now: 'Touchdown. SBAS gave LAB201 an approach with vertical guidance to a runway with no ILS.',
    benefit: 'SBAS approaches give lower minima and vertical guidance without airport equipment. LPV with a 35 m VAL can reach a 200 ft decision height.',
    source: 'Doc 9849 §4.3.3.1, §4.3.3.3',
  },
}
