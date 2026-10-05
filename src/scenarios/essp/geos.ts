/**
 * The EGNOS GEOs the receiver tracks in the ESSP-SAS scenario: the two that broadcast the
 * EGNOS Safety-of-Life signal.
 *
 * - GEO-1, SES-5 at 5°E, PRN 136: operational.
 * - GEO-3, Eutelsat 5 West B at 5°W, PRN 121: operational since 25 August 2025 (EUSPA,
 *   "EGNOS system release: GEO-3 satellite enters operational status"; EGNOS Service
 *   Notice 33).
 * - GEO-2, ASTRA 5B at 23.5°E, PRN 123 (EGNOS SoL SDD v3.6 Table 2; Service Notice 33):
 *   moved to the test platform on 5 September 2025 (same sources), so a Safety-of-Life
 *   receiver does not use it; it is not drawn.
 * EGNOS v2 broadcasts on L1 only; dual-frequency (DFMC, L1/L5) is planned for EGNOS v3
 * (EUSPA's 2026 roadmap: DFMC service in the early 2030s), so the GEOs are marked L1-only here.
 */
import type { SatDef } from '@/core/orbits'

// TODO(expert-review): EGNOS GEO status changes by service notice; confirm against the EGNOS user support
// "Realtime" page and the latest service notice (status as of the September 2025 notices, Service Notices 33 and 34;
// still so on the Realtime page on 5 October 2026).
export const GEOS: readonly SatDef[] = [
  { id: 'SES-5', name: 'SES-5 · EGNOS GEO-1', prn: 136, kind: 'geo', lonDeg: 5, l5: false },
  { id: 'E5WB', name: 'Eutelsat 5 West B · EGNOS GEO-3', prn: 121, kind: 'geo', lonDeg: -5, l5: false },
]

/**
 * Rotates the GPS constellation so the journey starts with a typical geometry over southern France.
 * Chosen by sweeping the whole circle against what the scenario shows on the approach into Nice:
 * with GPS alone, RAIM supports LNAV (as it does on almost every real approach, Doc 9849 §4.3.4.3),
 * and with EGNOS, LPV-200, which LNAV replaces under a storm or with RIMS offline, while a
 * dual-frequency service keeps LPV in the storm. Recomputed after the AI review (RAIM factors for
 * a missed-detection probability of 1e-3, the Annex 10 broadcast-model ionospheric σ, the nine
 * RIMS of the current network): 294 of 360 values do all of that, GPS alone giving LNAV at 315;
 * 172° lies well inside the band 75°–229° where all pass (RAIM HPL about 34 m on final, against
 * HAL 556 m). The 37° this scenario first copied from AirNav Indonesia lies in a band where GPS
 * alone gives no approach.
 */
export const GPS_EPOCH_RAAN_DEG = 172
