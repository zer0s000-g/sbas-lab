# Third-party code and data

| What | Where | Licence | Notes |
|---|---|---|---|
| Natural Earth land polygons (1:10m, 1:50m, 1:110m) | `src/views/geo/*.data.ts` (built by `scripts/geo/build-coast.mjs`) | Public domain | naturalearthdata.com |
| OurAirports runway data | runway thresholds in `src/scenarios/*/region.ts` | Public domain | ourairports.com; reproduces AIP data; to confirm against the AIRAC AIP |
| EGNOS messages, PRN 124, 29 March 2011 15:00–15:15 | `src/replay/data/egnos-prn124-20110329-1500.ems` | EUPL v1.1 (`src/replay/data/LICENSE-EUPL-1.1.txt`) | First 900 lines of `examples/20110325h15.ems` from the EGNOS Toolkit 0.5.1 (sourceforge.net/projects/libegnos); see `src/replay/data/NOTICE.md` |
| SBAS IGP band tables (DO-229 Appendix A) | `src/core/sbasDecode.ts` | BSD 2-clause | Ported from RTKLIB `src/sbas.c`, Copyright (c) 2007-2013, T. Takasu, All rights reserved. Redistribution and use in source and binary forms, with or without modification, are permitted provided that the copyright notice, the list of conditions and the disclaimer of the BSD 2-clause licence are retained. |
| RTKLIB, as the reference decoder | `scripts/egnos/rtklib-reference.c` (links against an RTKLIB checkout, not vendored) | BSD 2-clause | Its output is kept in `tests/fixtures/rtklib-egnos-prn124-20110329-1500.json` |
| GPS broadcast ephemeris (IGS BRDC00IGS) and IGS rapid orbits, 30 September 2026 | reduced into `src/data/servicemap/2026-09-30.json`; excerpts in `tests/fixtures/rinex/` | IGS data policy (open; cite the IGS) | Fetched from the BKG GNSS Data Center (igs.bkg.bund.de) by `scripts/data/fetch-bkg.mjs`; raw files are not committed |
| EUREF Permanent Network observations of 15 stations, 30 September 2026 | reduced into `src/data/servicemap/2026-09-30.json`; three epochs of TLMF in `tests/fixtures/rinex/` | CC BY 4.0 | EUREF Permanent GNSS Network, via the BKG GNSS Data Center; credited on the service-area panel |
| Kp index, 30 September 2026 (to choose a quiet day) | not stored | CC BY 4.0 | GFZ German Research Centre for Geosciences, kp.gfz.de |

THE RTKLIB-DERIVED TABLES ARE PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
