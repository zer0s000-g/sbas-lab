/**
 * What the page says in each phase of the AirNav Indonesia scenario, in plain language
 * (CLAUDE.md: analogy first, jargon gets tooltips, formulas only in "Go deeper"). Each
 * entry names its Doc 9849 sources (docs/SOURCES.md).
 *
 * The story: LAB201 from Jakarta Soekarno-Hatta (WIII) to Bali I Gusti Ngurah Rai (WADD),
 * guided by a hypothetical Indonesian SBAS broadcast through Japan's Michibiki GEOs.
 */
import type { Narration } from '@/journey/narration'
import type { PhaseId } from '@/journey/phases'

// TODO(expert-review): the controller hand-off (Jakarta FIR to Ujung Pandang FIR, Makassar) is described in general
// terms; confirm the FIR boundary along this route and the unit names.
export const NARRATION: Readonly<Record<PhaseId, Narration>> = {
  gate: {
    title: 'Trusted guidance, every phase of flight',
    now: 'At Soekarno-Hatta, Jakarta, the crew of LAB201 check the forecast of SBAS approach availability at Bali and the SBAS NOTAMs, just as they check the weather.',
    benefit: 'SBAS guides the whole flight, from the gate to the runway at Bali. Its LPV approach needs only satellite signals, no equipment at the airport, so the same kind of approach could serve the many Indonesian runways that have no ILS.',
    source: 'Doc 9849 §4.3.3.1, §4.3.3.4.1',
  },
  takeoff: {
    title: 'A first fix from GPS alone',
    now: 'LAB201 taxis out to runway 07R. The receiver measures its distance to each satellite it can see and works out where it is. Watch the GPS-only dot next to the true position.',
    benefit: 'SBAS supports departures too: it tells the receiver which satellites to trust and corrects their clocks and orbits.',
    source: 'Doc 9849 §3.1, §4.3.1.5',
  },
  climb: {
    title: 'Why four satellites',
    now: 'Climbing out over the Java Sea. Three distances fix a point in space. A fourth is needed because the receiver clock is not perfect. The spread of the satellites in the sky, the DOP, sets how errors grow into position errors.',
    benefit: 'In the terminal area the alert limit is 1 NM (1.85 km) with 15 s to alert. With SBAS the protection level is a few metres.',
    source: 'Doc 9849 §3.1, Table 2-1',
  },
  errors: {
    title: 'What makes a range wrong',
    now: 'Slowed down so you can see it: one satellite range, broken into its errors. They come from the satellite clock, the orbit, the ionosphere, the troposphere, multipath and noise. Indonesia lies near the magnetic equator, where the ionosphere is the largest error of all.',
    benefit: 'SBAS corrects the clock, orbit and ionosphere errors for the whole region. The receiver models the troposphere. Multipath and noise stay.',
    source: 'Doc 9849 §4.3.1.1, §5.2.1',
  },
  reference: {
    title: 'RIMS: watchers at known spots',
    now: 'Sixteen reference stations (RIMS), from Banda Aceh to Merauke, listen to the same satellites. Because each knows exactly where it is, every difference it measures is a satellite or ionosphere error.',
    benefit: 'A network spread across the archipelago sees the errors that every aircraft over Indonesia would see.',
    source: 'Doc 9849 §4.3.1.1',
  },
  master: {
    title: 'The master control centre',
    now: 'The master control centre in Jakarta, with a backup in Makassar, turns the measurements into corrections for each satellite, a grid of ionospheric delays, and a bound on what is left (UDRE, GIVE). A satellite it cannot trust is set to "Do not use".',
    benefit: 'The corrections come with integrity: the aircraft knows how far to trust them.',
    source: 'Doc 9849 §4.3.1.1–4.3.1.4.2',
  },
  uplink: {
    title: 'Up to Michibiki',
    now: 'Two ground uplink stations send the messages to Japan’s Michibiki satellites QZS-3 and QZS-6, 35 786 km above the equator. Each stays over the same spot on Earth. The satellites are real; the Indonesian service they carry here is a what-if.',
    benefit: 'Two GEOs, each with its own uplink, reach every aircraft over Indonesia at once, and one can carry on if the other is lost.',
    source: 'Doc 9849 §4.3.1.2',
  },
  broadcast: {
    title: 'The first correction arrives',
    now: 'QZS-3 (PRN 137) and QZS-6 (PRN 129) rebroadcast the messages on the GPS frequencies, one message each second. Over the Java Sea, LAB201 applies the first corrections: the position jumps toward the truth and the protection cylinder appears.',
    benefit: 'From now on LAB201 knows its position to about a metre, with a protection level it can trust.',
    source: 'Doc 9849 §4.3.1.2, §4.3.2.3–4.3.2.4',
  },
  cruise: {
    title: 'En route with integrity',
    now: 'At FL330 along the north coast of Java, the alert limit is 2 NM (3.7 km) with 5 minutes to alert. The SBAS protection level is hundreds of times smaller. Controllers in Jakarta hand LAB201 to Makassar.',
    benefit: 'LAB201 broadcasts this position on ADS-B. Its integrity lets the controller trust the position shown on the screen.',
    source: 'Doc 9849 Table 2-1, §1.4.3, §2.2.4.6',
  },
  descent: {
    title: 'Loading the approach',
    now: 'Over East Java the crew load the RNP approach to runway 09 at Bali from the database (or by its channel number). A CRC checks that its final approach data block is unchanged. The receiver tracks both GEOs and arms "LPV".',
    benefit: 'The final approach path lives in the aircraft database, so no antennas at the airport need maintaining or flight-checking.',
    source: 'Doc 9849 §4.3.2.7, §4.3.2.9, §4.3.2.10',
  },
  final: {
    title: 'LPV engaged',
    now: 'On final over the sea west of Bali the limits are tight: HAL 40 m, VAL 50 m, 10 s to alert. The protection cylinder must stay inside the alert-limit wireframe all the way to the decision altitude.',
    benefit: 'Dual-frequency SBAS removes the ionospheric delay, so near the equator LPV is available where single-frequency SBAS could not provide it.',
    source: 'Doc 9849 Table 2-1, §5.2.1.5, §6.8.2',
  },
  landing: {
    title: 'Down at Bali',
    now: 'Touchdown on runway 09 at I Gusti Ngurah Rai, then the taxi to the terminal. SBAS guided LAB201 from the gate in Jakarta to the gate in Bali.',
    benefit: 'SBAS approaches give lower minima and vertical guidance without airport equipment. LPV with a 35 m VAL can reach a 200 ft decision height.',
    source: 'Doc 9849 §4.3.3.1, §4.3.3.3',
  },
}
