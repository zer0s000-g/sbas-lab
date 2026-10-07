/**
 * The answers to the exam's second question, "LAB201 is on final: what do the crew and the
 * controller do now?". On final the crew act on what the cockpit shows, not on the cause:
 * lost GEO signals, an ionospheric storm, RIMS offline and EGNOS switched off all end the
 * same way (LPV drops to LNAV), so they share one right response. The "Break something"
 * texts (failures.ts crewAtc) also cover what happens before a flight (NOTAMs, planning);
 * on final that is too late, so the exam does not use them.
 *
 * Every examable failure is right for exactly one response; the last two are right for
 * none (tests/essp/exam-responses.test.ts checks both against the simulation).
 */
import type { InFlightResponse } from '@/assessment/assessment'

export const IN_FLIGHT_RESPONSES: readonly InFlightResponse[] = [
  {
    id: 'continue',
    seen: 'An alarm for one satellite; LPV stays.',
    text: 'Nothing to do: the receiver drops the faulty satellite by itself and the LPV approach continues.',
    rightFor: ['clockJump'],
    claims: ['sbas.do-not-use', 'ops.time-to-alert'],
  },
  {
    id: 'reportLpvLoss',
    seen: 'LPV drops to LNAV.',
    text: 'The crew report the loss of LPV to ATC and continue to LNAV minima or ask for another approach.',
    rightFor: ['geoLost', 'storm', 'stationOffline', 'sbasOff'],
    claims: ['sbas.mode-annunciation', 'ops.abas-lnav', 'atc.phraseology'],
  },
  {
    id: 'reportInterference',
    seen: 'No satellites and no GNSS position at all.',
    text: 'The crew report the interference. ATC gives radar vectors, and the aircraft uses its inertial system, DME or an ILS where one exists.',
    rightFor: ['jamming'],
    claims: ['ops.gnss-loss-fallback', 'atc.phraseology'],
  },
  {
    id: 'gpsAloneLpv',
    seen: 'Right for none: GPS alone supports LNAV minima, not LPV.',
    text: 'The crew switch EGNOS off and keep flying down to the LPV minima on GPS alone.',
    rightFor: [],
    claims: ['ops.abas-lnav'],
  },
  {
    id: 'closeAirport',
    seen: 'Right for none: LNAV, radar, DME and ILS still work without EGNOS.',
    text: 'ATC closes the airport until EGNOS is back, and every aircraft diverts.',
    rightFor: [],
    claims: ['ops.gnss-loss-fallback', 'ops.abas-lnav'],
  },
]
