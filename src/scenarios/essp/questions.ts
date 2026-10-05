/**
 * The ESSP-SAS assessment: learning objectives and quiz questions. Every answer rests on
 * claims in the registry (src/content/claims), so a reviewer who signs a claim off also
 * signs off the questions that use it. The objectives are this page's own: a training
 * organisation maps them to its syllabus.
 */
import { presentQuestion, type AuthoredQuestion, type Objective, type Question } from '@/assessment/assessment'

export const OBJECTIVES: readonly Objective[] = [
  { id: 'obj.principle', text: 'Explain how GNSS positioning works and which errors SBAS corrects.' },
  { id: 'obj.architecture', text: 'Describe the EGNOS architecture: RIMS, mission control centres, uplink stations and GEO satellites.' },
  { id: 'obj.integrity', text: 'Explain protection levels, alert limits and time to alert, and what happens when a protection level exceeds its alert limit.' },
  { id: 'obj.operations', text: 'Relate EGNOS to operations: LPV-200 and APV-I approaches, the FAS data block, departures and fallback.' },
  { id: 'obj.provision', text: 'Describe EGNOS service provision: ESSP’s role, EGNOS Working Agreements, NOTAM proposals and service notices.' },
  { id: 'obj.threats', text: 'Recognise ionospheric storms, lost GEOs and interference, their effect on the service, and what crews and controllers do.' },
]

/** The questions as authored: the right answer is always the first option. */
const AUTHORED: readonly AuthoredQuestion[] = [
  {
    id: 'q.four-satellites',
    prompt: 'Why does a GNSS receiver need at least four satellites?',
    options: ['Three for its position and one for the error of its own clock', 'One for each GPS orbital plane in view', 'Three for its position and one for the EGNOS corrections', 'Four for the four layers of the ionosphere'],
    explain: 'Three distances fix a point; the receiver clock is not perfect, so a fourth range solves for its error.',
    claims: ['gnss.four-satellites'],
    objective: 'obj.principle',
  },
  {
    id: 'q.ionosphere',
    prompt: 'Which error does EGNOS estimate on a grid of points and broadcast to single-frequency users?',
    options: ['The ionospheric delay', 'The tropospheric delay', 'Multipath at the aircraft', 'Receiver noise'],
    explain: 'The master centres compute vertical ionospheric delays at the grid points, each bounded by its GIVE. The receiver models the troposphere; multipath and noise stay.',
    claims: ['gnss.errors', 'sbas.master-corrections', 'sbas.udre-give'],
    objective: 'obj.principle',
  },
  {
    id: 'q.rims',
    prompt: 'What does a RIMS (Ranging and Integrity Monitoring Station) do?',
    options: ['Measures the satellites from a surveyed position, so each difference it sees is a satellite or ionosphere error', 'Broadcasts the corrections to the aircraft', 'Uplinks the messages to the GEO satellites', 'Approves LPV procedures for an airport'],
    explain: 'Reference stations at known positions watch the satellites and send their measurements to the mission control centres, which compute the corrections.',
    claims: ['sbas.reference-stations', 'egnos.ground-segment'],
    objective: 'obj.architecture',
  },
  {
    id: 'q.geos',
    prompt: 'Which satellites broadcast the EGNOS Safety-of-Life signal in this scenario?',
    options: ['SES-5 (PRN 136) and Eutelsat 5 West B (PRN 121)', 'ASTRA 5B (PRN 123) and SES-5 (PRN 136)', 'QZS-3 (PRN 137) and QZS-6 (PRN 129)', 'Any four GPS satellites in view'],
    explain: 'GEO-3, Eutelsat 5 West B, entered operational service on 25 August 2025; GEO-2, ASTRA 5B, moved to test on 5 September 2025. Check the current service notice: the status changes.',
    claims: ['egnos.geos', 'egnos.geo-status-current'],
    objective: 'obj.architecture',
  },
  {
    id: 'q.protection-level',
    prompt: 'What is a protection level?',
    options: ['A bound on the position error, computed by the receiver, that it compares with the alert limit', 'The accuracy the receiver achieves 95 % of the time', 'The height the approach is protected down to', 'The minimum number of satellites for an approach'],
    explain: 'The receiver combines UDRE, GIVE and its own error models into HPL and VPL, upper bounds on the error, and compares them with HAL and VAL.',
    claims: ['sbas.protection-levels'],
    objective: 'obj.integrity',
  },
  {
    id: 'q.vpl-val',
    prompt: 'On final, the VPL grows above the VAL. What happens?',
    options: ['LPV is no longer annunciated; the avionics offer the best level of service still supported, such as LNAV', 'Nothing until the VPL reaches the decision height', 'The receiver doubles the VAL', 'The receiver switches to another GEO satellite and continues LPV'],
    explain: 'A protection level above its alert limit means the operation is not available; the avionics annunciate the highest level of service the signal still supports.',
    claims: ['sbas.mode-annunciation', 'ops.alert-limits'],
    objective: 'obj.integrity',
  },
  {
    id: 'q.lpv200',
    prompt: 'What are the alert limits and the time to alert of an LPV-200 approach?',
    options: ['HAL 40 m, VAL 35 m, 6 s', 'HAL 40 m, VAL 50 m, 10 s', 'HAL 556 m, no VAL, 10 s', 'HAL 1.85 km, no VAL, 15 s'],
    explain: 'SBAS Category I (LPV-200) uses HAL 40 m and VAL 35 m with 6 s to alert; APV-I is HAL 40 m, VAL 50 m, 10 s.',
    claims: ['ops.alert-limits', 'sbas.cat1-200ft', 'egnos.lpv200'],
    objective: 'obj.operations',
  },
  {
    id: 'q.departure',
    prompt: 'Which row of the ICAO Annex 10 signal-in-space requirements does a departure share?',
    options: ['Initial, intermediate and non-precision approach: 220 m accuracy, 10 s to alert', 'Terminal: 0.74 km accuracy, 15 s to alert', 'En route: 3.7 km accuracy, 5 minutes to alert', 'APV-I: 16 m horizontal accuracy, VAL 50 m'],
    explain: 'ICAO Annex 10 puts departure in one row with initial, intermediate and non-precision approach. Its alert-limit note gives no HAL for departure: this page applies the non-precision 0.3 NM (556 m), and the value the avionics use (RTCA DO-229) is still to be confirmed.',
    claims: ['ops.departure-row'],
    objective: 'obj.operations',
  },
  {
    id: 'q.fas',
    prompt: 'What protects the final approach segment (FAS) data block of an LPV approach from being changed?',
    options: ['A CRC the avionics check before they use the block', 'A password the crew enter with the channel number', 'The EGNOS GEO broadcasts the block on every approach', 'The ILS localiser at the airport'],
    explain: 'The FAS data block defines the final approach in the aircraft database and carries a CRC; the avionics reject a block whose CRC does not match.',
    claims: ['sbas.fas-crc', 'egnos.fas-provider-id'],
    objective: 'obj.operations',
  },
  {
    id: 'q.notam',
    prompt: 'EGNOS APV-I is predicted unavailable at an airport tomorrow morning. Who proposes the NOTAM, and to whom?',
    options: ['ESSP, the EGNOS service provider, to the NOTAM office concerned', 'The crew of the first flight, to air traffic control', 'The airport’s engineers, to EUSPA', 'The GEO satellite operator, to the airlines'],
    explain: 'ESSP’s NOTAM proposal service predicts when an EGNOS service level will be unavailable at airports with EGNOS-based procedures and sends proposed NOTAMs by AFTN to the NOTAM offices, which validate and publish them.',
    claims: ['essp.notam-proposal', 'ops.notam'],
    objective: 'obj.provision',
  },
  {
    id: 'q.ewa',
    prompt: 'What does an air navigation service provider sign before it publishes EGNOS-based (LPV) procedures?',
    options: ['An EGNOS Working Agreement (EWA) with ESSP', 'A satellite lease with the GEO operator', 'A licence for the FAS data block from EUROCONTROL', 'Nothing: EGNOS is free, so no agreement is needed'],
    explain: 'An ANSP must sign an EWA with ESSP, the EGNOS service provider, to implement EGNOS-based (LPV) procedures; the Safety-of-Life service itself is free of direct charge to users.',
    claims: ['essp.ewa', 'egnos.sol-free'],
    objective: 'obj.provision',
  },
  {
    id: 'q.storm',
    prompt: 'A severe ionospheric storm hits Europe while LAB201 flies the single-frequency EGNOS v2 service. What does it get on final at Nice?',
    options: ['LNAV: the grid’s GIVE grows until VPL exceeds VAL, so LPV-200 is not available', 'LPV-200 as usual: EGNOS removes the ionosphere with two frequencies', 'No position at all: the storm stops the GPS signals', 'LPV-200, but only with one GEO'],
    explain: 'A storm makes the ionospheric delay change fast and unevenly; the single-frequency grid’s bound grows and vertical guidance is lost while lateral guidance stays. A dual-frequency service (planned for EGNOS v3) removes most of the delay.',
    claims: ['iono.storm', 'iono.dfmc-removes-delay', 'egnos.v3-dfmc'],
    objective: 'obj.threats',
  },
]

/** The questions as shown, each with its options in a fixed shuffled order. */
export const QUESTIONS: readonly Question[] = AUTHORED.map(presentQuestion)

/** The right answer of each question, as authored (for review). */
export const AUTHORED_ANSWERS: readonly string[] = AUTHORED.map((q) => q.options[0])
