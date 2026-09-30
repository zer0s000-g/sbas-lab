# Expert review list

Every technical value SBAS Lab shows or computes, with its source, for a qualified
GNSS/CNS engineer to check against ICAO Annex 10 Volume I and RTCA DO-229
(prompt pack §8). Each `// TODO(expert-review): ...` in the code is listed here too.
Stage 5 regenerates this file from the code.

## Stage 0 (foundation)

| Value | Where | Source | Status |
|---|---|---|---|
| c = 299 792 458 m/s | `src/core/units.ts` | SI definition of the metre | exact |
| WGS-84 a = 6 378 137.0 m, f = 1/298.257223563 | `src/core/units.ts` | NIMA TR8350.2 | to confirm |
| WGS-84 ωe = 7.292115 × 10⁻⁵ rad/s (IS-GPS-200 uses 7.2921151467 × 10⁻⁵ for orbits) | `src/core/units.ts` | NIMA TR8350.2, IS-GPS-200 | to confirm which one Stage 1 uses |
| GPS μ = 3.986005 × 10¹⁴ m³/s² | `src/core/units.ts` | IS-GPS-200 | to confirm |
| GPS L1 1575.42 MHz, L5 1176.45 MHz | `src/core/units.ts` | IS-GPS-200, IS-GPS-705 | to confirm |
| LPV (APV-I): HAL 40 m, VAL 50 m; LPV-200: HAL 40 m, VAL 35 m | kit preview demo (`src/preview`) | ICAO Annex 10 Vol I, Table 3.7.2.4-1 | to confirm |
| Time-lapse steps 1, 2, 4, 8, 16, 30, 60 | `src/core/clock.ts` | design choice (master prompt) | not a specification |

No `TODO(expert-review)` markers yet.
