/**
 * What the page says in each phase of the ESSP-SAS scenario, in plain language
 * (CLAUDE.md: analogy first, jargon gets tooltips, formulas only in "Go deeper").
 * Every entry lists the claims behind it (src/content/claims); the Sources sheet shows
 * each claim's source and review status.
 *
 * The story: LAB201 from Toulouse-Blagnac (LFBO) to Nice Côte d'Azur (LFMN), guided by
 * EGNOS, the European SBAS, whose service ESSP provides.
 */
import type { Narration } from '@/journey/narration'
import type { PhaseId } from '@/journey/phases'

export const NARRATION: Readonly<Record<PhaseId, Narration>> = {
  gate: {
    title: 'Checking EGNOS before the flight',
    now: 'At Toulouse-Blagnac, the crew of LAB201 check the NOTAMs for Nice, just as they check the weather. When EGNOS is predicted not to support LPV at an airport, ESSP proposes a NOTAM to that country’s NOTAM office.',
    benefit: 'EGNOS guides the whole flight, from the gate in Toulouse to the runway at Nice. Its LPV approaches need only satellite signals, no landing aid at the airport.',
    source: 'Doc 9849 §4.3.3.1, §4.3.3.4.1; ESSP NOTAM proposal service',
    claims: ['ops.notam', 'essp.notam-proposal', 'sbas.no-airport-equipment'],
  },
  takeoff: {
    title: 'A first fix from GPS alone',
    now: 'LAB201 taxis out to runway 14L. The receiver measures its distance to each satellite it can see and works out where it is. Watch the GPS-only dot next to the true position.',
    benefit: 'EGNOS supports departures too: it tells the receiver which satellites to trust and corrects their clocks and orbits.',
    source: 'Doc 9849 §3.1, §4.3.1.5; Annex 10 Table 3.7.2.4-1',
    claims: ['gnss.four-satellites', 'sbas.operations-supported', 'ops.departure-row'],
  },
  climb: {
    title: 'Why four satellites',
    now: 'Climbing out over the Lauragais toward the Mediterranean. Three distances fix a point in space. A fourth is needed because the receiver clock is not perfect. The spread of the satellites in the sky, the DOP, sets how errors grow into position errors.',
    benefit: 'In the terminal area the alert limit is 1 NM (1.85 km) with 15 s to alert. With EGNOS the protection level is a few metres.',
    source: 'Doc 9849 §3.1, Table 2-1',
    claims: ['gnss.four-satellites', 'ops.alert-limits'],
  },
  errors: {
    title: 'What makes a range wrong',
    now: 'Slowed down so you can see it: one satellite range, broken into its errors. They come from the satellite clock, the orbit, the ionosphere, the troposphere, multipath and noise. Over Europe the ionosphere is calmer than near the equator, but it is still a large error, and solar storms stir it up.',
    benefit: 'EGNOS corrects the clock, orbit and ionosphere errors over Europe. The receiver models the troposphere. Multipath and noise stay.',
    source: 'Doc 9849 §4.3.1.1, §5.2.1',
    claims: ['gnss.errors', 'iono.storm'],
  },
  reference: {
    title: 'RIMS: watchers at known spots',
    now: 'EGNOS has about 40 reference stations (RIMS), from the Canary Islands to Finland and beyond. The map shows the ones named in the public sources this page uses. Because each knows exactly where it is, every difference it measures is a satellite or ionosphere error.',
    benefit: 'A network spread across a continent sees the errors that every aircraft over Europe would see.',
    source: 'Doc 9849 §4.3.1.1; EGNOS SoL SDD',
    claims: ['sbas.reference-stations', 'egnos.ground-segment', 'egnos.rims-sites'],
  },
  master: {
    title: 'The mission control centres',
    now: 'EGNOS has two mission control centres, at Torrejón in Spain and Ciampino in Italy: one leads while the other stands by. They turn the measurements into corrections for each satellite, a grid of ionospheric delays, and a bound on what is left (UDRE, GIVE). A satellite they cannot trust is set to "Do not use".',
    benefit: 'The corrections come with integrity: the aircraft knows how far to trust them.',
    source: 'Doc 9849 §4.3.1.1–4.3.1.4.2; EU Implementing Decision 2017/1406',
    claims: ['egnos.mcc-sites', 'sbas.master-corrections', 'sbas.udre-give', 'sbas.do-not-use'],
  },
  uplink: {
    title: 'Up to the EGNOS satellites',
    now: 'Navigation land earth stations (NLES) send the messages up to the EGNOS satellites SES-5 (5°E) and Eutelsat 5 West B (5°W), 35 786 km above the equator. Each stays over the same spot on Earth. Which NLES feeds which satellite is drawn as an example.',
    benefit: 'Two GEOs reach every aircraft in the service area at once, and one can carry on if the other is lost.',
    source: 'Doc 9849 §4.3.1.2; EUSPA and EGNOS service notices',
    claims: ['sbas.geo-broadcast', 'egnos.geos', 'egnos.nles-sites'],
  },
  broadcast: {
    title: 'The first correction arrives',
    now: 'SES-5 (PRN 136) and Eutelsat 5 West B (PRN 121) broadcast the messages on the GPS L1 frequency, one message each second. Over the Gulf of Lion, LAB201 applies the first corrections: the position jumps toward the truth and the protection cylinder appears.',
    benefit: 'From now on LAB201 knows its position to about a metre, with a protection level it can trust.',
    source: 'Doc 9849 §4.3.1.2, §4.3.2.3–4.3.2.4',
    claims: ['egnos.geos', 'sbas.message-rate', 'sbas.protection-levels'],
  },
  cruise: {
    title: 'En route with integrity',
    now: 'Climbing to FL330 over the Gulf of Lion, the alert limit is 2 NM (3.7 km) with 5 minutes to alert. The EGNOS protection level is hundreds of times smaller.',
    benefit: 'LAB201 broadcasts this position on ADS-B. Its integrity lets the controller trust the position shown on the screen.',
    source: 'Doc 9849 Table 2-1, §1.4.3, §2.2.4.6',
    claims: ['ops.alert-limits', 'ops.adsb'],
  },
  descent: {
    title: 'Loading the approach',
    now: 'South of Toulon the crew load the RNP approach to runway 04L at Nice from the database (or by its channel number). A CRC checks that its final approach data block is unchanged; the block names EGNOS as the SBAS provider. The receiver tracks both GEOs and arms "LPV".',
    benefit: 'The final approach path lives in the aircraft database, so no landing aid at the airport needs maintaining or flight-checking.',
    source: 'Doc 9849 §4.3.2.7, §4.3.2.9, §4.3.2.10; EUROCONTROL FAS data block tool',
    claims: ['sbas.fas-crc', 'sbas.channel', 'sbas.two-geos', 'egnos.fas-provider-id'],
  },
  final: {
    title: 'LPV-200 engaged',
    now: 'On final over the Baie des Anges the limits are tight: HAL 40 m, VAL 35 m, 6 s to alert. The protection cylinder must stay inside the alert-limit wireframe all the way to the decision altitude.',
    benefit: 'Over Europe the single-frequency EGNOS grid follows the ionosphere well enough for LPV-200, down to a 200 ft decision height. Near the equator the same kind of service could not: the AirNav Indonesia scenario shows why.',
    source: 'Doc 9849 Table 2-1, §4.3.3.3, §5.2.1.5; EGNOS SoL SDD',
    claims: ['ops.alert-limits', 'sbas.cat1-200ft', 'egnos.lpv200', 'iono.equatorial-l1'],
  },
  landing: {
    title: 'Down at Nice',
    now: 'Touchdown on runway 04L at Nice Côte d’Azur, then the taxi to the terminal. EGNOS guided LAB201 from the gate in Toulouse to the gate in Nice.',
    benefit: 'SBAS approaches give lower minima and vertical guidance without airport equipment. In Europe, an air navigation service provider that publishes them first signs an EGNOS Working Agreement with ESSP.',
    source: 'Doc 9849 §4.3.3.1; ESSP EGNOS Working Agreements',
    claims: ['sbas.no-airport-equipment', 'essp.ewa'],
  },
}
