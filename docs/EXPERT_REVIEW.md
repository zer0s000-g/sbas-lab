# Expert review list

Every technical value SBAS Lab shows or computes that a qualified GNSS/CNS engineer
should check against ICAO Annex 10 Volume I, RTCA DO-229 and EUROCAE ED-259
(prompt pack §8). Values taken from ICAO Doc 9849 are listed in `docs/SOURCES.md` with
their section. Every `// TODO(expert-review): ...` in the code is listed here with its
file and line, from `grep -rn "TODO(expert-review)" src`.

## Constants (`src/core/units.ts`)

| Value | Source | Status |
|---|---|---|
| c = 299 792 458 m/s | SI definition | exact |
| WGS-84 a = 6 378 137.0 m, f = 1/298.257223563 | NIMA TR8350.2 | to confirm |
| ωe = 7.292115 × 10⁻⁵ rad/s (IS-GPS-200 uses 7.2921151467 × 10⁻⁵) | NIMA TR8350.2 | to confirm which one the orbits use |
| GPS μ = 3.986005 × 10¹⁴ m³/s² | IS-GPS-200 | to confirm |
| GPS L1 1575.42 MHz, L5 1176.45 MHz | Doc 9849 §3.2.4 | sourced |

## Values marked TODO(expert-review) in the code

| Where | What to confirm |
|---|---|
| `src/core/orbits.ts:52` | Real GPS slot phasing is uneven (SPS PS almanac). The model uses an even Walker 24/6/1 pattern. |
| `src/core/orbits.ts:65` | Not every GPS satellite broadcasts L5 today. The model assumes all do. |
| `src/core/region.ts:57` | Runway threshold coordinates, true courses, lengths and elevations of WIII 07R (and the 07L offset) and WADD 09, taken from aviation databases that reproduce AIP Indonesia AD 2. Confirm against the current AIRAC AIP. The departure runway (07R) is a story choice. |
| `src/core/region.ts:156` | Dip-equator latitudes read approximately from IGRF maps every 15° of longitude (about 9–10°N over Indonesia). |
| `src/core/orbits.ts:70` | QZS-6 (PRN 129) service status (under test in late 2025), and whether QZS-3 and QZS-6 broadcast the L5 (DFMC, L5S) signal the model assumes. |
| `src/core/approach.ts:37` | The FAS data block carries a numeric SBAS service provider ID (DO-229); a hypothetical Indonesian provider has none, so a name stands in. |
| `src/journey/narration.ts:20` | The controller hand-off on the route: Jakarta FIR to Ujung Pandang FIR (Makassar), and the unit names. |
| `src/core/iono.ts:23` | 350 km thin-shell height and pierce-point formulas (DO-229 Appendix A). |
| `src/core/iono.ts:153` | 5° × 5° IGP spacing at low and mid latitudes (DO-229 IGP bands). |
| `src/core/iono.ts:171` | GIVEI table: GIVE values in metres; index 15 = not monitored (DO-229). |
| `src/core/iono.ts:183` | σ_GIVE = GIVE / 3.29 (DO-229 tabulates σ²_GIVE per GIVEI). |
| `src/core/iono.ts:231` | Threat-model sizes (daytime band margin and post-sunset threat) are illustrative. They reproduce Doc 9849 §5.2.1.5 qualitatively: L1-only APV unavailable near the equator. |
| `src/core/errors.ts:40` | Illustrative 1σ GPS broadcast clock (1.1 m) and orbit (0.8 m) errors along the line of sight. |
| `src/core/errors.ts:45` | Tropospheric model m(E) = 1.001 / √(0.002001 + sin²E), σ_tvu = 0.12 m (DO-229). |
| `src/core/errors.ts:55` | Airborne multipath σ_mp = 0.13 + 0.53·e^(−θ/10°) m and receiver noise 0.36 m (DO-229, AAD-A-like). |
| `src/core/groundSegment.ts:17` | 5° elevation mask for aircraft and reference receivers. |
| `src/core/groundSegment.ts:20` | UDREI table (DO-229): UDRE in metres; 14 = Not Monitored, 15 = Do Not Use. |
| `src/core/groundSegment.ts:32` | σ_UDRE = UDRE / 3.29 (DO-229 tabulates σ²_UDRE). |
| `src/core/sbasWorld.ts:87` | ABAS single-frequency ionospheric σ: τ_vert = 9 m at low magnetic latitude (DO-229 Klobuchar variance). |
| `src/core/sbasWorld.ts:169` | DFRE modelled with the same bound as UDRE. The DFREI table (ED-259) differs. |
| `src/core/receiver.ts:37` | K factors: K_H,PA = 6.0, K_H,NPA = 6.18, K_V,PA = 5.33 (DO-229 / Annex 10 Appendix B). |
| `src/core/receiver.ts:98` | RAIM/FDE χ² thresholds (Pfa ≈ 10⁻⁵) and pbias values are illustrative. |
| `src/core/messages.ts:25` | Message type numbers and names other than Types 0, 27, 28 (L1) and 32 (DFMC), which Doc 9849 names. |
| `src/core/messages.ts:57` | 250 bit/s, 500 symbols/s after FEC, 8 + 6 + 212 + 24 bit layout. |
| `src/core/messages.ts:86` | Message time-outs (DO-229 Table A-25; ED-259 for DFMC): fast corrections 12 s PA / 18 s NPA, and so on. |
| `src/core/messages.ts:94` | Detection and alarm latencies (2.5 s + 1.2 s) are illustrative. The requirement is the time to alert. |
| `src/core/operations.ts:34` | SBAS LNAV/VNAV alert limits (HAL 556 m, VAL 50 m) follow DO-229, not Doc 9849 Table 2-1. |
| `src/core/approach.ts:32` | FAS data block field set and the 105 m course width at threshold. |
| `src/core/approach.ts:57` | SBAS approach channel number range (40 000–99 999). |
| `src/core/approach.ts:61` | FAS data block CRC: CRC-32Q, polynomial 0x814141AB (DO-229). |
| `src/core/approach.ts:104` | LPV lateral splay and vertical full-scale definitions. |
| `src/core/approach.ts:132` | 250 ft decision height of the illustrative procedure (SBAS CAT I can reach 200 ft, Doc 9849 §4.3.3.3). |

## Open questions for the reviewer

- **The Indonesian scenario.** Check that nothing on the page reads as a claim that MSAS or any real SBAS serves Indonesia, that the 16 RIMS sites and the Jakarta/Makassar MCC and uplink sites are clearly illustrative, and that the Bali LPV approach (RNP RWY 09, channel 54201) is clearly not a published procedure.
- **Bali coastline.** Natural Earth 1:10m puts the Kuta–Tuban isthmus about 3 km east of the real shore by the runway. The terrain fills the airfield as reclaimed land up to that coastline (`views/terrain.ts`); confirm this reads acceptably.

- **Two GEOs for LPV.** Doc 9849 §4.3.2.10 requires the avionics to track two available SBAS satellites for LNAV/VNAV, LP and LPV. The model shows the count of GEOs tracked. It keeps LPV available with one GEO, and loses LPV only when both are lost (after the fast-correction time-out). Confirm that is the right reading.
- **DFMC services.** DFMC SBAS services are planned rather than operational today (Doc 9849 §4.3.4.5: WAAS around 2026, EGNOS from 2028). The hypothetical Indonesian SBAS offers one, and the page says so.
