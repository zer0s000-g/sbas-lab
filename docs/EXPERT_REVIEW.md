# Expert review list

<!-- Generated from src/content/claims by `npm run claims`. Do not edit by hand: change the registry. -->

Every fact SBAS Lab shows or computes is a claim in `src/content/claims`, with its sources and
review status. A qualified GNSS/CNS engineer should check them against ICAO Annex 10 Volume I,
ICAO Doc 9849, RTCA DO-229, EUROCAE ED-259 and, for the ESSP-SAS scenario, the EGNOS Safety of
Life Service Definition Document and service notices. The same list, for a spreadsheet, is
`docs/claims.csv`.

Tests keep the registry honest: a claim's value must match the code; every
`TODO(expert-review)` in the code belongs to a claim marked "to confirm"; every claim the
narration cites exists; and this file must be regenerated when the registry changes.

## Summary

| Status | Claims | Meaning |
|---|---|---|
| Reviewed | 0 | Confirmed by a named reviewer against the primary source |
| Sourced, awaiting review | 52 | Source and section identified; not yet signed off |
| To confirm | 41 | Not yet traced to a primary source, or an illustrative value the page labels as such |

## To confirm

| Claim | Scenario | What the page says | Value | Source | Code |
|---|---|---|---|---|---|
| `gnss.slot-phasing` | both | The model spaces the 24 satellites evenly (a Walker 24/6/1 pattern); the real slots are not evenly spaced. *A simplification the page keeps; it changes the geometry, not the principles.* |  | US Space Force IS-GPS-200 | `src/core/orbits.ts` |
| `gnss.l5-everywhere` | both | The model lets every GPS satellite broadcast L5; not every GPS satellite does today. |  | ICAO Doc 9849 §3.2.4 | `src/core/orbits.ts` |
| `gnss.earth-rotation` | both | The Earth rotates at 7.292115 × 10⁻⁵ rad/s (WGS-84; IS-GPS-200 uses 7.2921151467 × 10⁻⁵ rad/s). The model uses the WGS-84 value; which the orbits should use is to confirm. | 0.00007292115 rad/s | NIMA (now NGA) TR8350.2; US Space Force IS-GPS-200 | `src/core/units.ts` |
| `gnss.error-sizes` | both | Illustrative 1σ sizes of the GPS broadcast clock (1.1 m) and orbit (0.8 m) errors along the line of sight. | 1.1, 0.8 m | US Space Force IS-GPS-200 | `src/core/errors.ts` |
| `gnss.troposphere-model` | both | The receiver’s tropospheric model: mapping m(E) = 1.001 / √(0.002001 + sin²E), residual σ of 0.12 m at the zenith. | 0.12 m | RTCA DO-229 Appendix A | `src/core/errors.ts` |
| `gnss.airborne-multipath` | both | Airborne multipath σ = 0.13 + 0.53·e^(−θ/10°) m and receiver noise σ = 0.36 m (an AAD-A-like receiver). | 0.36 m | RTCA DO-229 | `src/core/errors.ts` |
| `sbas.udre-table` | both | The UDREI table: UDRE 0.75, 1.0, 1.25, 1.75, 2.25, 3.0, 3.75, 4.5, 5.25, 6.0, 7.5, 15, 50 and 150 m for UDREI 0–13; 14 is Not Monitored and 15 Do Not Use. | 0.75, 1, 1.25, 1.75, 2.25, 3, 3.75, 4.5, 5.25, 6, 7.5, 15, 50, 150 m | RTCA DO-229 Table A-6; ICAO Annex 10 Appendix B | `src/core/groundSegment.ts` |
| `sbas.sigma-udre` | both | σ_UDRE is taken as UDRE / 3.29 (UDRE bounds 99.9 %); DO-229 tabulates σ²_UDRE for each UDREI, and the two agree to the table’s rounding (UDREI 0: 0.0520 m²). | 0.052 m² (σ² at UDREI 0) | RTCA DO-229 Table A-6 | `src/core/groundSegment.ts` |
| `sbas.give-table` | both | The GIVEI table: GIVE 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.6, 4.5, 6.0, 15 and 45 m for GIVEI 0–14; 15 is Not Monitored. | 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.6, 4.5, 6, 15, 45, 15 m | RTCA DO-229 Table A-17 | `src/core/iono.ts` |
| `sbas.sigma-give` | both | σ_GIVE is taken as GIVE / 3.29; DO-229 tabulates σ²_GIVE for each GIVEI (GIVEI 0: 0.0084 m²). | 0.0084 m² (σ² at GIVEI 0) | RTCA DO-229 Table A-17 | `src/core/iono.ts` |
| `sbas.igp-grid` | both | Ionospheric grid points are 5° apart in latitude and longitude between 55°S and 55°N. | 5 degrees | RTCA DO-229 IGP bands | `src/core/iono.ts` |
| `sbas.iono-shell` | both | The ionosphere is modelled as a thin shell 350 km above the Earth; pierce points and the obliquity factor follow from it. | 350000 m | RTCA DO-229 Appendix A | `src/core/iono.ts` |
| `sbas.message-rate` | both | An SBAS GEO broadcasts one 250-bit message every second (250 bit/s, 500 symbols/s after forward error correction). On L1 a message is an 8-bit preamble, a 6-bit type, 212 data bits and a 24-bit CRC. *The recorded EGNOS messages (src/replay) confirm the L1 layout: every one passes the 24-bit CRC over this layout and starts with an 8-bit preamble.* | 250, 1, 8, 6, 212, 24 bits, s, bits | ICAO Annex 10 Appendix B; RTCA DO-229 | `src/core/messages.ts` |
| `sbas.dfmc-layout` | both | A DFMC message on L5 is also 250 bits a second, but with a 4-bit preamble: 4 + 6 + 216 + 24 bits. *The 4-bit preamble is confirmed by public summaries of the DFMC SARPs; 216 data bits follow from the 250-bit total.* | 250, 4, 6, 216, 24 | EUROCAE ED-259; ICAO Annex 10 DFMC SBAS SARPs | `src/core/messages.ts` |
| `sbas.message-types` | both | The message type numbers and names (L1: 1 PRN mask, 2–5 fast corrections, 6 integrity, 7 fast-correction degradation, 9 GEO navigation, 10 degradation, 12 network time, 17 GEO almanac, 18 IGP mask, 24 mixed, 25 long-term, 26 ionospheric delays, 27/28, 63 null; DFMC: 31, 32, 34, 37, 39, 47). *Doc 9849 names Types 0, 27, 28 and 32. The L1 types the replay decodes (1, 2–5, 6, 7, 9, 10, 12, 17, 18, 24, 25, 26, 27, 63) appear in the recorded EGNOS broadcast with those numbers.* |  | RTCA DO-229; EUROCAE ED-259; ICAO Doc 9849 §4.3.4.2; ICAO Doc 9849 Appendix G 2.5 | `src/core/messages.ts` |
| `sbas.timeouts` | both | How long received data may be used: fast corrections 12 s for approaches with vertical guidance and 18 s otherwise, long-term corrections 240 s / 360 s, the ionospheric grid 600 s. *12 s / 18 s are the time-outs of the integrity (UDREI) data; the fast-correction time-out itself follows from the MT7 degradation parameters. Check which the GEO-loss behaviour should use.* | 12, 18, 240, 360, 600 s | RTCA DO-229 Table A-25; EUROCAE ED-259 | `src/core/messages.ts` |
| `sbas.alarm-latency` | both | The page’s detection (2.5 s) and uplink (1.2 s) latencies are illustrative; the requirement is the time to alert. |  | ICAO Doc 9849 Table 2-1 | `src/core/messages.ts` |
| `sbas.k-factors` | both | HPL = K_H·d_major and VPL = K_V·d_V, with K_H = 6.0 for approaches with vertical guidance and 6.18 otherwise, and K_V = 5.33. | 6, 6.18, 5.33 | RTCA DO-229 Appendix J; ICAO Annex 10 Appendix B | `src/core/receiver.ts` |
| `sbas.raim` | both | GPS alone uses RAIM/FDE; its detection thresholds and protection-level factors are illustrative values (false-alarm probability about 10⁻⁵). |  | ICAO Doc 9849 §4.2 | `src/core/receiver.ts` |
| `sbas.mask-angle` | both | Satellites below 5° elevation are not tracked, by the aircraft or by the reference stations. | 5 degrees | RTCA DO-229 | `src/core/groundSegment.ts` |
| `sbas.abas-iono-sigma` | both | GPS alone: the σ of the broadcast-model ionospheric residual is taken as 9 m vertically at low magnetic latitudes, times the obliquity. |  | RTCA DO-229 | `src/core/sbasWorld.ts` |
| `sbas.dfre` | both | The DFMC service’s correction bound (DFRE) is modelled with the same bound as UDRE; the DFREI table of ED-259 differs. |  | EUROCAE ED-259 | `src/core/sbasWorld.ts` |
| `sbas.fas-fields` | both | The FAS data block’s fields (operation type, provider, airport, runway, performance designator, reference path, threshold, glide path, threshold crossing height, course width, HAL, VAL), with a typical 105 m course width at the threshold. |  | RTCA DO-229; ICAO Annex 10 Appendix B | `src/core/approach.ts` |
| `sbas.fas-crc32q` | both | The FAS data block CRC is a 32-bit CRC (CRC-32Q, polynomial 0x814141AB). *The CRC of the single byte 0x01 is the polynomial itself, which is how the binding reads it.* | 0x814141AB | RTCA DO-229 | `src/core/approach.ts` |
| `sbas.channel-range` | both | SBAS approach channels run from 40 000 to 99 999. | 1 | RTCA DO-229 | `src/core/approach.ts` |
| `sbas.lpv-deviations` | both | LPV deviations: lateral full scale is the course width at the threshold, splaying out (capped at 2°); vertical full scale is a quarter of the glide path angle. |  | RTCA DO-229 | `src/core/approach.ts` |
| `sbas.decision-height` | both | The decision height of each scenario’s LPV procedure is illustrative: 250 ft at Bali, 200 ft for the LPV-200 at Nice. |  | ICAO Doc 9849 §4.3.3.3 | `src/core/approach.ts` |
| `ops.lnavvnav` | both | SBAS LNAV/VNAV alert limits: HAL 556 m, VAL 50 m. | 555.6, 50 m | RTCA DO-229 | `src/core/operations.ts` |
| `atc.phraseology` | ESSP-SAS | Radiotelephony for GNSS problems, as PANS-ATM gives it: a controller warns "GNSS REPORTED UNRELIABLE" (or "GNSS MAY NOT BE AVAILABLE [DUE TO INTERFERENCE]"); a crew that cannot fly an RNP procedure reports "UNABLE RNP". *Quoted from memory of PANS-ATM, not from the document: the build could not reach it. Check the exact words and their section in the current edition before use.* |  | ICAO Doc 4444 Chapter 12 |  |
| `iono.threat-model` | both | The sizes of the ionospheric threat terms (the daytime band margin, the post-sunset threat, the storm) are illustrative, chosen to reproduce Doc 9849’s conclusions qualitatively. |  | ICAO Doc 9849 §5.2.1.5 | `src/core/iono.ts` |
| `iono.dip-equator` | both | The magnetic (dip) equator is read approximately from IGRF maps every 15° of longitude (about 9–10°N over Indonesia). |  | ICAO Doc 9849 §5.2.1.5 | `src/core/region.ts` |
| `egnos.geo-status-current` | ESSP-SAS | Which EGNOS GEO is operational changes by service notice; the status shown is that of the September 2025 notices, still current in early 2026. |  | EGNOS user support EGNOS user support, Realtime (GEO status) | `src/scenarios/essp/geos.ts` |
| `egnos.ground-sites` | ESSP-SAS | The ground sites shown: RIMS at Toulouse, Paris, Lisbon, Madeira, the Azores, La Palma, Athens, Alexandria, Virolahti, Kuusamo and Kourou; NLES at Aussaguel, Betzdorf, Burum, Cagliari, Fucino, Rambouillet and Redu. Only the sites named in the public sources this build could read are shown, at city level. *Kuusamo is new in SoL SDD v3.6. The NLES list comes from the 2017 decision and may have changed. Which NLES feeds which GEO is not stated in these sources; the page draws an example pairing and says so.* |  | European Commission 2017/1406; EUSPA SoL SDD; ESA ESA pages on EGNOS (How does EGNOS work; EGNOS ground seg… | `src/scenarios/essp/region.ts` |
| `essp.notam-format` | ESSP-SAS | The proposed NOTAM the page writes uses the ICAO NOTAM items A (location), B and C (validity, UTC) and E (text); the wording of item E is illustrative, the Q line is left out, and the flight has no calendar date. |  | ESSP EGNOS Service Provision Yearly Report | `src/core/service.ts` |
| `scenario.essp-airports` | ESSP-SAS | Toulouse-Blagnac runway 14L (threshold 43.6374°N 1.3576°E, 490 ft, true course 143.1°, 3000 m) and Nice Côte d’Azur runway 04L (landing threshold displaced 93 m, 11 ft, true course 45.0°, 2570 m). | 43.637402, 1.35762, 143.11, 45 | OurAirports (public domain) OurAirports runway data (runways.csv); SIA France AIP France, AD 2 (LFBO, LFMN) AD 2 LFBO, LFMN | `src/scenarios/essp/region.ts` |
| `scenario.essp-procedure` | ESSP-SAS | The RNP RWY 04L approach at Nice shown here (channel, FAS data, LPV-200 minima with a 200 ft decision height) is an illustrative example, not the published procedure. |  | SIA France AIP France, AD 2 (LFBO, LFMN) AD 2 LFMN | `src/scenarios/essp/index.ts` |
| `scenario.essp-terrain` | ESSP-SAS | The summits drawn between Toulouse and Nice (Mont Ventoux, Mont Aigoual and others) stand at approximate positions and heights; the terrain is illustrative scenery. |  | Natural Earth (public domain) Natural Earth land polygons, 1:10m, 1:50m and 1:110m | `src/scenarios/essp/terrain.ts` |
| `scenario.indonesia-airports` | AirNav Indonesia | Jakarta Soekarno-Hatta runway 07R and Bali I Gusti Ngurah Rai runway 09: threshold positions, true courses, lengths and elevations from aviation databases that reproduce AIP Indonesia AD 2. |  | Indonesia AIS AIP Indonesia, AD 2 (WIII, WADD) AD 2 WIII, WADD; OurAirports (public domain) OurAirports runway data (runways.csv) | `src/scenarios/indonesia/region.ts` |
| `scenario.indonesia-fir` | AirNav Indonesia | The controller hand-off on the route (Jakarta FIR to Ujung Pandang FIR, Makassar) is described in general terms. |  | Indonesia AIS AIP Indonesia, AD 2 (WIII, WADD) ENR | `src/scenarios/indonesia/narration.ts` |
| `scenario.qzs6-status` | AirNav Indonesia | QZS-6 (PRN 129), launched on 2 February 2025, was under test in late 2025; its SBAS service date and the L5 (DFMC) broadcast of QZS-3 and QZS-6 are to confirm. |  | JCAB MSAS (Michibiki Satellite-based Augmentation Service), JC… | `src/scenarios/indonesia/geos.ts` |
| `scenario.indonesia-provider-id` | AirNav Indonesia | The hypothetical Indonesian SBAS has no SBAS service provider ID, so its FAS data block carries a name instead of the number a real block would. |  | RTCA DO-229; EUROCONTROL SBAS FAS Data Block Tool, source reference documentation | `src/core/approach.ts` |

## Sourced, awaiting review

| Claim | Scenario | What the page says | Value | Source | Code |
|---|---|---|---|---|---|
| `gnss.four-satellites` | both | A receiver needs at least four pseudo-ranges: three for its position and one for its clock. The geometry of the satellites (the DOP) sets how range errors grow into position errors. |  | ICAO Doc 9849 §3.1 | `src/core/receiver.ts` |
| `gnss.constellation` | both | The GPS nominal constellation: 24 satellites in six orbital planes, about 20 200 km high, inclined 55°, one orbit in about 12 hours. | 24, 6, 20200, 55 satellites, planes, km, degrees | ICAO Doc 9849 §3.2.2 | `src/core/orbits.ts` |
| `gnss.frequencies` | both | GPS civil signals: L1 at 1575.42 MHz and L5 at 1176.45 MHz; all GPS satellites share each frequency (CDMA). | 1575420000, 1176450000 Hz | ICAO Doc 9849 §3.2.4 | `src/core/units.ts` |
| `gnss.speed-of-light` | both | The speed of light is 299 792 458 m/s (exact, by definition of the metre). | 299792458 m/s | US Space Force IS-GPS-200 | `src/core/units.ts` |
| `gnss.wgs84` | both | WGS-84: semi-major axis 6 378 137.0 m, flattening 1/298.257223563. | 6378137, 298.257223563 | NIMA (now NGA) TR8350.2 | `src/core/units.ts` |
| `gnss.mu` | both | The Earth’s gravitational constant used for GPS orbits: 3.986005 × 10¹⁴ m³/s². | 398600500000000 m³/s² | US Space Force IS-GPS-200 | `src/core/units.ts` |
| `gnss.errors` | both | A range is wrong because of the satellite clock, the orbit, the ionosphere (usually the largest), the troposphere, multipath and receiver noise. SBAS corrects the first three for its region; the receiver models the troposphere; multipath and noise stay. |  | ICAO Doc 9849 §4.3.1.1; ICAO Doc 9849 §5.2.1 | `src/core/errors.ts` |
| `sbas.reference-stations` | both | Reference stations at surveyed positions over a large area monitor the satellites and send their data to master stations. |  | ICAO Doc 9849 §4.3.1.1 | `src/core/groundSegment.ts` |
| `sbas.master-corrections` | both | Master stations compute clock and orbit corrections for each satellite and ionospheric delays on a grid, and bound what is left. |  | ICAO Doc 9849 §4.3.1.1; ICAO Doc 9849 §4.3.1.4.2 | `src/core/groundSegment.ts` |
| `sbas.udre-give` | both | UDRE bounds the residual clock and orbit error of each satellite; GIVE bounds the error of each grid point’s ionospheric delay. |  | ICAO Doc 9849 §4.3.1.4.2 | `src/core/groundSegment.ts` |
| `sbas.do-not-use` | both | "Do Not Use" and "Not Monitored" satellites cannot be used with SBAS integrity; LP and LPV also need UDREI other than 13. | 13, 14, 15 UDREI (not for LPV, Not Monitored, Do Not Use) | ICAO Doc 9849 §4.3.1.3 | `src/core/groundSegment.ts` |
| `sbas.geo-broadcast` | both | Uplink stations send the messages to the SBAS GEO satellites, which rebroadcast them; a GEO stays over the equator at a fixed longitude. |  | ICAO Doc 9849 §4.3.1.2 | `src/core/orbits.ts` |
| `sbas.mt0` | both | Message Type 0 means "do not use this SBAS for safety-of-life"; Types 27 and 28 (L1) and 32 (DFMC) bound the errors away from the network. |  | ICAO Doc 9849 Appendix G 2.5; ICAO Doc 9849 §4.3.4.2 | `src/core/messages.ts` |
| `sbas.operations-supported` | both | With satellite status and clock and orbit corrections, SBAS supports departure to non-precision approach; with the ionospheric grid too, approaches with vertical guidance up to Category I. |  | ICAO Doc 9849 §4.3.1.5 | `src/core/sbasWorld.ts` |
| `sbas.protection-levels` | both | The receiver combines UDRE, GIVE and its own error models into protection levels (HPL, VPL) and compares them with the alert limits (HAL, VAL). |  | ICAO Doc 9849 §4.3.2.4; ICAO Doc 9849 §2.2.4.3 | `src/core/receiver.ts` |
| `sbas.mode-annunciation` | both | The avionics annunciate the highest level of service the signal supports: LPV, LNAV/VNAV or LNAV. |  | ICAO Doc 9849 §4.3.2.5 | `src/core/sbasWorld.ts approachMode` |
| `sbas.fas-crc` | both | The final approach segment (FAS) data block defines the LPV final approach, and a CRC protects it. |  | ICAO Doc 9849 §4.3.2.7 | `src/core/approach.ts` |
| `sbas.channel` | both | Crews can select an SBAS approach by its five-digit channel number. |  | ICAO Doc 9849 §4.3.2.9 | `src/core/approach.ts` |
| `sbas.two-geos` | both | LNAV/VNAV, LP and LPV need the avionics to track two SBAS satellites. *The model keeps LPV with one GEO and loses it when both are lost (after the time-out). Confirm that reading.* |  | ICAO Doc 9849 §4.3.2.10 | `src/core/sbasWorld.ts` |
| `sbas.abas-fallback` | both | Outside SBAS service, SBAS avionics fall back to ABAS (GPS alone with RAIM) automatically. |  | ICAO Doc 9849 §4.3.4.3 | `src/core/sbasWorld.ts navStatus` |
| `sbas.no-airport-equipment` | both | SBAS approaches need no dedicated equipment at the airport. |  | ICAO Doc 9849 §4.3.3.1 |  |
| `sbas.cat1-200ft` | both | A 35 m VAL supports a 200 ft decision height (SBAS Category I, LPV-200); WAAS’s worst observed vertical error was 8.9 m in 1.76 billion samples. |  | ICAO Doc 9849 §4.3.3.3 |  |
| `ops.alert-limits` | both | Alert limits and time to alert per operation: oceanic en route HAL 7.4 km, continental en route 3.7 km (5 min); terminal 1.85 km (15 s); NPA 556 m (10 s); APV-I HAL 40 m, VAL 50 m (10 s); APV-II 40 m / 20 m (6 s); Category I 40 m / 35–10 m (6 s; SBAS uses 35 m). | 7408, 3704, 1852, 555.6, 40, 50, 40, 20, 40, 35, 300, 15, 10, 10, 6, 6 m, s | ICAO Doc 9849 Table 2-1; ICAO Annex 10 Table 3.7.2.4-1 | `src/core/operations.ts` |
| `ops.departure-row` | both | Departure shares the row of initial, intermediate and non-precision approach: HAL 0.3 NM (556 m), 10 s to alert. *Corrected in this build: the takeoff phase used the terminal limits (1.85 km, 15 s) before.* | 555.6, 10 m, s | ICAO Annex 10 Table 3.7.2.4-1 | `src/core/operations.ts` |
| `ops.time-to-alert` | both | The time to alert is the longest time allowed from a fault to the alert in the cockpit. |  | ICAO Doc 9849 §2.2.4.4 | `src/core/messages.ts` |
| `ops.adsb` | both | ADS-B broadcasts the GNSS position; its integrity, linked to the GNSS alert limits, lets the controller trust the position on the screen. |  | ICAO Doc 9849 §1.4.3; ICAO Doc 9849 §2.2.4.6 |  |
| `ops.notam` | both | States verify SBAS performance and issue NOTAMs for degradations, using a service volume model. |  | ICAO Doc 9849 §4.3.3.4.1 |  |
| `ops.gnss-loss-fallback` | both | On loss of GNSS: inertial systems, DME, VOR/DME, ILS and procedural control by ATC. |  | ICAO Doc 9849 §7.13.2 |  |
| `ops.space-weather` | both | ICAO space weather advisories cover the ionosphere (total electron content and scintillation). |  | ICAO Doc 9849 §7.13.3 |  |
| `ops.abas-lnav` | both | With GPS alone (ABAS) approaches go down to LNAV minima; there is no vertical protection level. |  | ICAO Doc 9849 §1.4.2.2; ICAO Doc 9849 §4.2 |  |
| `iono.storm` | both | The ionospheric delay follows the sun; storms make the ionosphere thicker and less even. |  | ICAO Doc 9849 §5.2.1.1; ICAO Doc 9849 §5.2.1.2 | `src/core/iono.ts` |
| `iono.equatorial-l1` | both | Near the magnetic equator, dense bands about 15° either side and post-sunset bubbles make single-frequency SBAS vertical guidance (APV, Category I) impractical. |  | ICAO Doc 9849 §5.2.1.5; ICAO Doc 9849 §4.3.1.4 | `src/core/iono.ts` |
| `iono.scintillation` | AirNav Indonesia | Severe scintillation is common near the equator after sunset; it is patchy, takes out a few satellites at a time and affects every frequency. |  | ICAO Doc 9849 §5.2.1.3; ICAO Doc 9849 §5.2.1.4 | `src/core/iono.ts` |
| `iono.dfmc-removes-delay` | both | The dual-frequency ionosphere-free combination removes the (first-order) ionospheric delay but amplifies noise and multipath by about 2.6. | 2.6 | ICAO Doc 9849 §4.3.1.4.1; ICAO Doc 9849 §5.2.1.6 | `src/core/errors.ts` |
| `iono.broadcast-model` | both | The GPS broadcast ionospheric model removes about half of the delay; SBAS reduces the error to a few metres and bounds it. |  | ICAO Doc 9849 §5.2.1.6 | `src/core/iono.ts` |
| `dfmc.planned` | both | Dual-frequency multi-constellation (DFMC) SBAS services are planned, not yet operational (WAAS about 2026, EGNOS from 2028). |  | ICAO Doc 9849 §4.3.4.5 |  |
| `dfmc.equatorial-apv` | AirNav Indonesia | Dual-frequency SBAS makes approaches with vertical guidance possible in equatorial States. |  | ICAO Doc 9849 §6.8.2 |  |
| `essp.provider` | ESSP-SAS | ESSP (European Satellite Services Provider) is the EGNOS service provider for the Open Service and the Safety-of-Life service, under a ten-year contract with EUSPA signed in July 2022; EUSPA took over the EGNOS Data Access Service (EDAS). |  | EUSPA EUSPA taps ESSP for EGNOS service provider role |  |
| `egnos.geos` | ESSP-SAS | EGNOS broadcasts its Safety-of-Life signal from GEO-1, SES-5 at 5°E (PRN 136), and GEO-3, Eutelsat 5 West B at 5°W (PRN 121, operational since 25 August 2025). GEO-2, ASTRA 5B at 31.5°E (PRN 123), moved to test on 5 September 2025. | 136, 5, 121, -5 PRN, degrees east | EUSPA EGNOS system release: GEO-3 satellite enters operational …; ESSP / EGNOS user support EGNOS Service Notice 33; EGNOS user support EGNOS user support, Realtime (GEO status); gps.gov GPS L1 C/A PRN code assignments | `src/scenarios/essp/geos.ts` |
| `egnos.ground-segment` | ESSP-SAS | The EGNOS ground segment: about 40 Ranging and Integrity Monitoring Stations (RIMS), two Mission Control Centres (MCC), Navigation Land Earth Stations (NLES) that uplink to the GEOs, and the EGNOS Wide Area Network (EWAN). |  | EUSPA SoL SDD; ESA ESA pages on EGNOS (How does EGNOS work; EGNOS ground seg… |  |
| `egnos.mcc-sites` | ESSP-SAS | The two EGNOS mission control centres are at Torrejón (Spain) and Ciampino (Italy). | Ciampino,Torrejón | European Commission 2017/1406; ESA ESA pages on EGNOS (How does EGNOS work; EGNOS ground seg… | `src/scenarios/essp/region.ts` |
| `egnos.rims-sites` | ESSP-SAS | EGNOS RIMS span Europe and beyond, from the Canary Islands, Madeira and the Azores to Finland, Egypt and French Guiana. |  | European Commission 2017/1406; ESA ESA pages on EGNOS (How does EGNOS work; EGNOS ground seg…; EUSPA SoL SDD |  |
| `egnos.nles-sites` | ESSP-SAS | Navigation land earth stations (NLES) uplink the EGNOS messages to the GEOs; each GEO has a primary and a backup uplink. |  | ESA ESA pages on EGNOS (How does EGNOS work; EGNOS ground seg…; European Commission 2017/1406 |  |
| `egnos.lpv200` | ESSP-SAS | The EGNOS Safety-of-Life service supports approaches with vertical guidance down to LPV-200 minima. |  | EUSPA SoL SDD |  |
| `egnos.sol-free` | ESSP-SAS | The EGNOS Safety-of-Life service is open and free of direct charge to users. |  | EUSPA SoL SDD |  |
| `egnos.v3-dfmc` | ESSP-SAS | EGNOS v2, in service, is single-frequency (GPS L1). EGNOS v3 is planned to bring a dual-frequency multi-constellation (DFMC) service around 2028, after GPS L5 is declared operational. |  | EUSPA EGNOS (programme overview, EGNOS v3 timeline); ICAO Doc 9849 §4.3.4.5 |  |
| `egnos.fas-provider-id` | ESSP-SAS | In the FAS data block, SBAS service provider 1 is EGNOS (0 WAAS, 2 MSAS, 3 GAGAN, 4 SDCM, 5 BDSBAS, 6 KASS, 7 A-SBAS; 15 any SBAS). | 1 | EUROCONTROL SBAS FAS Data Block Tool, source reference documentation; ICAO Annex 10 Appendix B, SBAS provider IDs | `src/scenarios/essp/index.ts` |
| `essp.notam-proposal` | ESSP-SAS | ESSP’s NOTAM proposal service predicts periods when the EGNOS APV-I service will be unavailable at airports with EGNOS procedures, formats them as proposed NOTAMs and sends them to the NOTAM offices concerned (by AFTN). |  | ESSP EGNOS Service Provision Yearly Report |  |
| `essp.forecast-model` | ESSP-SAS | The page forecasts LPV availability by running its own SBAS model forward at the airport with the conditions known in advance (a storm forecast, a planned RIMS outage); sudden failures such as a lost GEO are not in a forecast. *A real prediction uses the almanac, planned outages and the service volume model.* |  | ICAO Doc 9849 §4.3.3.4.1; ESSP EGNOS Service Provision Yearly Report | `src/core/service.ts` |
| `essp.ewa` | ESSP-SAS | An air navigation service provider’s first step to publish EGNOS-based (LPV) procedures is an EGNOS Working Agreement (EWA) with ESSP. In March 2024, 85 EWAs were in force (46 with ANSPs), and 954 EGNOS-based procedures were published. | 85, 46, 954 EWAs, of them with ANSPs, procedures (March 2024) | ESSP EWA for SoL aviation users (ESSP presentation) |  |
| `scenario.msas` | AirNav Indonesia | MSAS v3: GEOs QZS-3 at 127°E (PRN 137) and QZS-6 at 90.5°E (PRN 129); two MCS (Hitachi-ota, Kobe); uplinks at Hitachi-ota, Tanegashima and Miyakojima; each PRN has its own uplink. | 137, 127, 129, 90.5 | JCAB MSAS (Michibiki Satellite-based Augmentation Service), JC… slides 3–6; ICAO APAC ICAO APAC CNS SG/24 IP15 (Japan); gps.gov GPS L1 C/A PRN code assignments | `src/scenarios/indonesia/geos.ts` |
| `data.coastlines` | both | Coastlines come from Natural Earth land polygons (1:10m for the flight view, 1:50m for the maps, 1:110m for the globe), clipped and simplified. |  | Natural Earth (public domain) Natural Earth land polygons, 1:10m, 1:50m and 1:110m | `scripts/geo/build-coast.mjs` |

## Reviewed

None yet.

## Sources

| Document | Edition | Publisher | Used | Note |
|---|---|---|---|---|
| Global Navigation Satellite System (GNSS) Manual, Doc 9849 | Fifth Edition, 2025 | ICAO | read | The primary source of the original build (docs/SOURCES.md). |
| Annex 10, Aeronautical Telecommunications, Volume I, Radio Navigation Aids (Chapter 3 §3.7; Appendix B) | edition and amendment to confirm | ICAO | via-doc9849 | Used through Doc 9849 Table 2-1, which reproduces Table 3.7.2.4-1, and public summaries of it. |
| Procedures for Air Navigation Services, Air Traffic Management (PANS-ATM), Doc 4444 | Sixteenth Edition, as amended (to confirm) | ICAO | not-reached |  |
| DO-229, Minimum Operational Performance Standards for GPS/SBAS Airborne Equipment | edition to confirm | RTCA | not-reached | Sold by RTCA; values marked "to confirm" wait for a reviewer with the document. |
| ED-259, MOPS for Galileo/GPS/SBAS L1/L5 (DFMC) airborne equipment | February 2019 (or later revision; to confirm) | EUROCAE | not-reached |  |
| Department of Defense World Geodetic System 1984, TR8350.2 | Third Edition, amended | NIMA (now NGA) | not-reached |  |
| Interface Specification IS-GPS-200, NAVSTAR GPS Space Segment/Navigation User Interfaces | current revision (to confirm) | US Space Force | not-reached |  |
| GPS L1 C/A PRN code assignments | January 2026 edition | gps.gov | via-search |  |
| EGNOS Safety of Life (SoL) Service Definition Document | v3.6 (in force at the time of writing) | EUSPA | via-search | The EGNOS user support site was not reachable from the build environment; facts were taken from search results quoting it. To be read in full by the reviewer. |
| EGNOS system release: GEO-3 satellite enters operational status | August/September 2025 | EUSPA | via-search |  |
| EGNOS Service Notice 33 | 2025 | ESSP / EGNOS user support | via-search |  |
| EGNOS user support, Realtime (GEO status) | consulted through search, 2026 | EGNOS user support | via-search |  |
| EUSPA taps ESSP for EGNOS service provider role | September 2022 | EUSPA | via-search |  |
| EGNOS (programme overview, EGNOS v3 timeline) | EUSPA document 02_EGNOS | EUSPA | via-search |  |
| EWA for SoL aviation users (ESSP presentation) | March 2024 | ESSP | via-search |  |
| EGNOS Service Provision Yearly Report | 2021–2022 | ESSP | via-search |  |
| Commission Implementing Decision (EU) 2017/1406 on the location of the ground-based infrastructure of EGNOS | 31 July 2017 | European Commission | via-search | Later decisions may amend the list; to confirm. |
| ESA pages on EGNOS (How does EGNOS work; EGNOS ground segment) | various | ESA | via-search |  |
| SBAS FAS Data Block Tool, source reference documentation | online tool | EUROCONTROL | via-search |  |
| OurAirports runway data (runways.csv) | downloaded 3 October 2026 | OurAirports (public domain) | read | A community database; it reproduces AIP data but is not an official source. |
| Natural Earth land polygons, 1:10m, 1:50m and 1:110m | version 5.x | Natural Earth (public domain) | read |  |
| AIP Indonesia, AD 2 (WIII, WADD) | current AIRAC (to confirm) | Indonesia AIS | not-reached |  |
| AIP France, AD 2 (LFBO, LFMN) | current AIRAC (to confirm) | SIA France | not-reached |  |
| MSAS (Michibiki Satellite-based Augmentation Service), JCAB / JRANSA | EGNOS Workshop 2025, Berlin | JCAB | read |  |
| ICAO APAC CNS SG/24 IP15 (Japan) | 2020 | ICAO APAC | read |  |
| EGNOS Toolkit (libegnos) 0.5.1, with its example EMS file 20110325h15.ems | 0.5.1 (2012), EUPL v1.1 | EGNOS Toolkit authors (SourceForge) | read | An hour of EGNOS messages recorded by ESA’s EGNOS Message Server (EMS). |
| RTKLIB, src/sbas.c | 2.4.x | T. Takasu (BSD 2-clause) | read | An independent SBAS message decoder, used to cross-check SBAS Lab’s. |
| EGNOS Message Server (EMS) User Interface Document | Issue 2.0 | ESA | via-search |  |

## Open questions for the reviewer

- **The Indonesian scenario.** Check that nothing on the page reads as a claim that MSAS or any real SBAS serves Indonesia, that the 16 RIMS sites and the Jakarta/Makassar MCC and uplink sites are clearly illustrative, and that the Bali LPV approach (RNP RWY 09, channel 54201) is clearly not a published procedure. The scenario tab is named "AirNav Indonesia" for its audience; check it does not read as naming an SBAS operator.
- **Bali coastline.** Natural Earth 1:10m puts the Kuta–Tuban isthmus about 3 km east of the real shore by the runway. The terrain fills the airfield as reclaimed land up to that coastline (`views/terrain.ts`); confirm this reads acceptably.
- **Two GEOs for LPV.** Doc 9849 §4.3.2.10 requires the avionics to track two available SBAS satellites for LNAV/VNAV, LP and LPV. The model shows the count of GEOs tracked, keeps LPV with one GEO and loses it only when both are lost (after the time-out). Confirm that is the right reading.
- **DFMC services.** DFMC SBAS services are planned rather than operational (Doc 9849 §4.3.4.5: WAAS around 2026, EGNOS from 2028). The hypothetical Indonesian SBAS offers one; the ESSP-SAS scenario shows EGNOS v3 DFMC only as a labelled preview.
- **The ESSP-SAS scenario.** Check the EGNOS facts against the current EGNOS SoL SDD and service notices: the operational GEOs, the RIMS, MCC and NLES sites shown, ESSP’s role, the NOTAM proposal service and the EWA figures. The build could not reach the EGNOS user support site and used search results quoting it.
- **RIMS in the model.** The ESSP-SAS ground segment computes its corrections from the 11 RIMS it shows, not EGNOS’s full network, so the "RIMS offline" failure has a far larger effect than it would in reality; the page says so. Check the wording.
- **Nice LPV-200 at 200 ft.** The illustrative RNP RWY 04L approach is flown to LPV-200 minima with a 200 ft decision height over the Baie des Anges; the published procedure, its minima and its FAS data block are not used.

## Signing a claim off

Set the claim's `status` to `'reviewed'` and its `review` to `{ by: '<name, role>', on: '<date>' }`
in `src/content/claims`, correct the text, value or source if needed (the code must follow a
corrected value, or its test fails), remove the matching `TODO(expert-review)` from the code,
and run `npm run claims` to regenerate this file.
