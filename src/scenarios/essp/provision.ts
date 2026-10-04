/**
 * What the ESSP-SAS scenario's service-provision panel says: what each role does in the
 * situation on screen (the pilot, the controller, the ATSEP engineer, the service
 * provider), the EGNOS service notices shown as examples, and the EGNOS Working
 * Agreement figures. Each text names the claims behind it (src/content/claims).
 */
import type { FailureId } from '@/journey/failures'

export type Role = 'pilot' | 'atco' | 'atsep' | 'provider'

export const ROLES: readonly { id: Role; label: string; long: string }[] = [
  { id: 'pilot', label: 'Pilot', long: 'Flight crew' },
  { id: 'atco', label: 'ATCO', long: 'Air traffic controller' },
  { id: 'atsep', label: 'ATSEP', long: 'Air traffic safety electronics personnel' },
  { id: 'provider', label: 'Provider', long: 'SBAS service provider (ESSP for EGNOS)' },
]

export interface RoleNote {
  text: string
  claims: readonly string[]
}

type Situation = 'nominal' | Extract<FailureId, 'clockJump' | 'geoLost' | 'storm' | 'stationOffline' | 'jamming' | 'sbasOff' | 'dfmcPreview'>

export const ROLE_NOTES: Readonly<Record<Situation, Readonly<Record<Role, RoleNote>>>> = {
  nominal: {
    pilot: { text: 'Before the flight, check the NOTAMs for LPV availability at the destination and the alternate. On final, the avionics annunciate LPV when EGNOS vertical guidance is within the alert limits.', claims: ['ops.notam', 'sbas.mode-annunciation'] },
    atco: { text: 'Clear LAB201 for the RNP approach as for any other. The ADS-B position it broadcasts carries its integrity, so the position on the screen can be trusted.', claims: ['ops.adsb'] },
    atsep: { text: 'An LPV approach needs no landing aid at the airport to maintain or flight-check. The conventional aids kept for reversion (ILS, DME, VOR) still need to be serviceable.', claims: ['sbas.no-airport-equipment', 'ops.gnss-loss-fallback'] },
    provider: { text: 'ESSP monitors the EGNOS service, publishes service notices for changes such as a GEO entering service, and proposes NOTAMs to the NOTAM offices where APV-I is predicted unavailable.', claims: ['essp.provider', 'essp.notam-proposal', 'egnos.geos'] },
  },
  storm: {
    pilot: { text: 'Expect LNAV minima instead of LPV at Nice. Plan with the higher minima, and check the alternate.', claims: ['iono.storm', 'ops.abas-lnav'] },
    atco: { text: 'NOTAMs may report LPV not available; expect crews to ask for the LNAV approach or another approach.', claims: ['ops.notam'] },
    atsep: { text: 'If GNSS approaches are restricted for long, the conventional aids carry the traffic.', claims: ['ops.gnss-loss-fallback'] },
    provider: { text: 'The prediction shows APV-I unavailable at the airports concerned, and ESSP proposes NOTAMs for them. Space weather advisories warn of the ionospheric disturbance.', claims: ['essp.notam-proposal', 'ops.space-weather'] },
  },
  geoLost: {
    pilot: { text: 'After the time-out the receiver loses LPV and falls back to GPS alone with LNAV. Tell ATC you cannot continue the LPV approach.', claims: ['sbas.two-geos', 'sbas.abas-fallback'] },
    atco: { text: 'Offer the LNAV approach, another approach or vectors. Expect the same report from other aircraft if the SBAS signal is lost over the area.', claims: ['ops.gnss-loss-fallback'] },
    atsep: { text: 'Nothing at the airport has failed: the signal comes from space. Check the conventional aids are serviceable for reversion.', claims: ['sbas.no-airport-equipment', 'ops.gnss-loss-fallback'] },
    provider: { text: 'Losing both GEOs takes the EGNOS signal away from every user in the area. ESSP investigates and informs the users.', claims: ['egnos.geos', 'essp.provider'] },
  },
  clockJump: {
    pilot: { text: 'Nothing to do: the receiver drops the satellite flagged "Do not use" and the approach continues.', claims: ['sbas.do-not-use'] },
    atco: { text: 'Nothing changes on the frequency: the alarm reaches the aircraft within the time to alert.', claims: ['ops.time-to-alert'] },
    atsep: { text: 'Nothing to do at the airport.', claims: ['sbas.no-airport-equipment'] },
    provider: { text: 'EGNOS’s mission control centre detects the fault and broadcasts "Do not use" for the satellite within the time to alert.', claims: ['sbas.do-not-use', 'ops.time-to-alert'] },
  },
  stationOffline: {
    pilot: { text: 'If the outage takes LPV away at the destination, NOTAMs say so before the flight: plan LNAV minima.', claims: ['ops.notam'] },
    atco: { text: 'Expect LNAV approaches where the NOTAMs report LPV not available.', claims: ['ops.notam'] },
    atsep: { text: 'Nothing to do at the airport.', claims: ['sbas.no-airport-equipment'] },
    provider: { text: 'ESSP publishes a service notice for the outage and proposes NOTAMs where APV-I is predicted unavailable.', claims: ['essp.notam-proposal'] },
  },
  jamming: {
    pilot: { text: 'No GNSS position: report the interference to ATC and navigate with the inertial system, DME or an ILS where one exists.', claims: ['ops.gnss-loss-fallback'] },
    atco: { text: 'Expect reports of lost GNSS from several aircraft; use radar vectors and conventional procedures. PANS-ATM gives the phraseology for GNSS problems (see Sources).', claims: ['ops.gnss-loss-fallback', 'atc.phraseology'] },
    atsep: { text: 'Interference is local and comes from the ground; the conventional aids carry the traffic meanwhile.', claims: ['ops.gnss-loss-fallback'] },
    provider: { text: 'EGNOS keeps broadcasting, but no receiver in the area can use it while the GPS signals are drowned.', claims: ['ops.gnss-loss-fallback'] },
  },
  sbasOff: {
    pilot: { text: 'With GPS alone the approach is flown to LNAV minima; there is no vertical guidance from the satellites.', claims: ['ops.abas-lnav'] },
    atco: { text: 'Nothing changes on the frequency; the crew fly the LNAV approach.', claims: ['ops.abas-lnav'] },
    atsep: { text: 'Nothing to do at the airport.', claims: ['sbas.no-airport-equipment'] },
    provider: { text: 'Nothing for the provider: the receiver chose not to use EGNOS.', claims: ['sbas.abas-fallback'] },
  },
  dfmcPreview: {
    pilot: { text: 'Nothing yet: EGNOS v3 DFMC is planned, not operational.', claims: ['egnos.v3-dfmc'] },
    atco: { text: 'Nothing yet: EGNOS v3 DFMC is planned, not operational.', claims: ['egnos.v3-dfmc'] },
    atsep: { text: 'Nothing yet: EGNOS v3 DFMC is planned, not operational.', claims: ['egnos.v3-dfmc'] },
    provider: { text: 'EGNOS v3 is planned to add a dual-frequency multi-constellation service around 2028.', claims: ['egnos.v3-dfmc'] },
  },
}

/** The situation a set of failures puts the roles in: the most serious failure switched on. */
export function situationOf(on: readonly FailureId[]): Situation {
  const order: Situation[] = ['jamming', 'geoLost', 'storm', 'stationOffline', 'sbasOff', 'clockJump', 'dfmcPreview']
  return order.find((s) => (on as readonly string[]).includes(s)) ?? 'nominal'
}

/** EGNOS service notices, as examples of how changes reach the users (EUSPA; EGNOS Service Notice 33). */
export const SERVICE_NOTICES: readonly { date: string; text: string; claims: readonly string[] }[] = [
  { date: '25 August 2025', text: 'GEO-3, Eutelsat 5 West B (PRN 121, 5°W), moves from test to operational status and broadcasts the operational signal.', claims: ['egnos.geos'] },
  { date: '5 September 2025', text: 'GEO-2, ASTRA 5B (PRN 123), moves from operational to test status. EGNOS broadcasts operationally from GEO-1 (PRN 136) and GEO-3 (PRN 121).', claims: ['egnos.geos'] },
]

/** EGNOS Working Agreements and EGNOS-based procedures (ESSP, March 2024). */
export const EWA_FACTS = {
  asOf: 'March 2024',
  ewas: 85,
  withAnsps: 46,
  procedures: 954,
  claims: ['essp.ewa'] as readonly string[],
}

/**
 * The failures that are known in advance and so belong in a forecast (a storm forecast, a
 * planned RIMS outage, the service in use). Not "SBAS off": that is the receiver's choice,
 * not a change in the service the provider forecasts.
 */
export const FORECASTABLE: readonly FailureId[] = ['storm', 'stationOffline', 'dfmcPreview']
