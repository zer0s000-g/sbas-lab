/**
 * The EGNOS GEOs the receiver tracks in the ESSP-SAS scenario: the two that broadcast the
 * EGNOS Safety-of-Life signal.
 *
 * - GEO-1, SES-5 at 5°E, PRN 136: operational.
 * - GEO-3, Eutelsat 5 West B at 5°W, PRN 121: operational since 25 August 2025 (EUSPA,
 *   "EGNOS system release: GEO-3 satellite enters operational status"; EGNOS Service
 *   Notice 33).
 * - GEO-2, ASTRA 5B at 31.5°E, PRN 123: moved to the test platform on 5 September 2025
 *   (same sources), so a Safety-of-Life receiver does not use it; it is not drawn.
 * EGNOS v2 broadcasts on L1 only; dual-frequency (DFMC, L1/L5) is planned for EGNOS v3
 * (EUSPA: DFMC service around 2028), so the GEOs are marked L1-only here.
 */
import type { SatDef } from '@/core/orbits'

// TODO(expert-review): EGNOS GEO status changes by service notice; confirm against the EGNOS user support
// "Realtime" page and the latest service notice (status as of the September 2025 notices; still so in early 2026).
export const GEOS: readonly SatDef[] = [
  { id: 'SES-5', name: 'SES-5 · EGNOS GEO-1', prn: 136, kind: 'geo', lonDeg: 5, l5: false },
  { id: 'E5WB', name: 'Eutelsat 5 West B · EGNOS GEO-3', prn: 121, kind: 'geo', lonDeg: -5, l5: false },
]

/** Rotates the GPS constellation so the journey starts with a typical geometry over southern France. */
export const GPS_EPOCH_RAAN_DEG = 37
