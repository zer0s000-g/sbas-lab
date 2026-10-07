/**
 * The two SBAS GEOs of the AirNav Indonesia scenario. They are real: Japan's Michibiki
 * satellites QZS-3 and QZS-6, which broadcast the MSAS SBAS signal (JCAB, EGNOS Workshop
 * 2025; PRNs per the GPS L1 C/A PRN assignment list). In this page they carry a
 * hypothetical Indonesian SBAS service.
 */
import type { SatDef } from '@/core/orbits'

// TODO(expert-review): the L5 (DFMC) broadcast of QZS-3 and QZS-6 (the L5S signal, in R&D) needs confirming. QZS-6
// (PRN 129), launched on 2 Feb 2025, has carried the MSAS SBAS service since October 2025 (JCAB, ITF/8 IP/05, May 2026).
/** The two SBAS GEOs: Michibiki QZS-6 over the Indian Ocean and QZS-3 over Sulawesi's longitude. */
export const GEOS: readonly SatDef[] = [
  { id: 'QZS-3', name: 'QZS-3 Michibiki', prn: 137, kind: 'geo', lonDeg: 127, l5: true },
  { id: 'QZS-6', name: 'QZS-6 Michibiki', prn: 129, kind: 'geo', lonDeg: 90.5, l5: true },
]

/** Rotates the whole GPS constellation so the journey starts with a typical geometry over Indonesia. */
export const GPS_EPOCH_RAAN_DEG = 37
