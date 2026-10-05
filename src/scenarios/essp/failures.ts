/**
 * "Break something" in the ESSP-SAS scenario: each failure, what it does to the EGNOS
 * world, what the learner should notice, and what the crew, the controller and the
 * service provider do. The flight keeps its planned path whatever is broken
 * (design.md §6). Equatorial scintillation and the evening flight belong to the AirNav
 * Indonesia scenario; over southern France they are not the issue.
 */
import type { FailureDef } from '@/journey/failures'

export const FAILURES: readonly FailureDef[] = [
  {
    id: 'clockJump',
    label: 'Satellite clock jump',
    explain: 'One GPS satellite clock suddenly jumps, so its range is wrong by tens of metres.',
    notice: 'The EGNOS mission control centre sees it and sends "Do not use". The message log shows the alarm reaching LAB201 inside the time to alert.',
    crewAtc: 'Nothing to do: the receiver drops the satellite by itself and the approach continues.',
    source: 'Doc 9849 §2.2.4.4, §4.3.1.3',
    claims: ['ops.time-to-alert', 'sbas.do-not-use'],
  },
  {
    id: 'geoLost',
    label: 'EGNOS GEO signals lost',
    explain: 'LAB201 stops receiving both EGNOS satellites, SES-5 and Eutelsat 5 West B.',
    notice: 'The last message gets older. After the time-out LPV is lost and the receiver falls back to GPS alone with LNAV minima.',
    crewAtc: 'The crew report the loss of LPV to ATC and continue to LNAV minima or ask for another approach.',
    source: 'Doc 9849 §4.3.2.10, §4.3.4.3',
    claims: ['sbas.two-geos', 'sbas.abas-fallback'],
  },
  {
    id: 'storm',
    label: 'Ionospheric storm',
    explain: 'A severe solar storm makes the ionospheric delay over Europe change fast and unevenly.',
    notice: 'GIVE grows. With the L1 service, VPL goes above VAL and LPV-200 becomes unavailable; LNAV stays. A dual-frequency service removes most of the delay (EGNOS v3, planned).',
    crewAtc: 'Space weather advisories and NOTAMs warn of reduced LPV availability. Crews plan LNAV or another approach.',
    source: 'Doc 9849 §5.2.1.2, §5.2.1.6, §7.13.3',
    claims: ['iono.storm', 'iono.dfmc-removes-delay', 'ops.space-weather'],
  },
  {
    id: 'stationOffline',
    label: 'RIMS offline',
    explain: 'The RIMS in Toulouse, Paris, Lisbon and Madeira stop sending data to the mission control centres.',
    notice: 'Fewer stations see each satellite and the ionospheric grid near the route loses its monitoring, so LPV is no longer available at Nice; LNAV stays. This page models only the 9 RIMS it shows, so the effect is far larger than the real network of 38 would see.',
    crewAtc: 'ESSP publishes a service notice and proposes NOTAMs for any predicted loss of LPV. Crews check them before the flight.',
    source: 'Doc 9849 §4.3.1.3, §4.3.3.4.1',
    claims: ['sbas.do-not-use', 'ops.notam', 'essp.notam-proposal'],
  },
  {
    id: 'jamming',
    label: 'GNSS interference',
    explain: 'Radio interference drowns every satellite signal.',
    notice: 'No satellites, no position, no GNSS approach. EGNOS cannot help, because it needs the GPS signals too.',
    crewAtc: 'The crew report the interference. ATC gives radar vectors, and the aircraft uses its inertial system, DME or an ILS where one exists.',
    source: 'Doc 9849 §7.13.2',
    claims: ['ops.gnss-loss-fallback', 'atc.phraseology'],
  },
  {
    id: 'sbasOff',
    label: 'EGNOS off (GPS alone)',
    explain: 'The receiver ignores EGNOS and uses GPS with its own integrity check (RAIM/FDE).',
    notice: 'The protection level grows many times over, there is no vertical protection level, and the best approach is LNAV.',
    crewAtc: 'The approach is flown to LNAV minima, which are higher, so more flights may divert in bad weather.',
    source: 'Doc 9849 §1.4.2.2, §4.2',
    claims: ['ops.abas-lnav'],
  },
  {
    id: 'dfmcPreview',
    label: 'EGNOS v3 preview (DFMC)',
    explain: 'The receiver uses a dual-frequency (L1/L5) service like the one planned for EGNOS v3. EGNOS v2, in service today, is single-frequency.',
    notice: 'The ionospheric delay is removed instead of estimated from the grid, so a storm hardly matters; noise grows about 2.6 times.',
    crewAtc: 'Nothing yet: EGNOS v3 DFMC is planned, not operational. This switch is a preview.',
    source: 'Doc 9849 §4.3.1.4.1, §4.3.4.5, §5.2.1.6; EUSPA',
    claims: ['iono.dfmc-removes-delay', 'egnos.v3-dfmc'],
  },
]

/** RIMS taken offline by the "RIMS offline" failure: the western European sites nearest the route. */
export const OFFLINE_SET = ['RIMS-TLS', 'RIMS-PAR', 'RIMS-LIS', 'RIMS-MAD'] as const
/** How big the clock jump is, m. */
export const CLOCK_JUMP_M = 40
/** Not used in this scenario (no evening flight), kept for the shared failure state. */
export const EVENING_START_HOUR = 19.5
