# Sources

Every claim SBAS Lab makes on screen, with the section of its source. The primary
source is **ICAO Doc 9849, *Global Navigation Satellite System (GNSS) Manual*, Fifth
Edition, 2025**. It takes the integrity requirements from ICAO Annex 10, Volume I,
Chapter 3, Table 3.7.2.4-1.

Entries are paraphrased, not quoted. Values that need a specification beyond Doc 9849
(RTCA DO-229, EUROCAE ED-259, Annex 10 Appendix B) are in `docs/EXPERT_REVIEW.md`.

## GNSS and SBAS basics

| Claim | Doc 9849 | Code |
|---|---|---|
| A receiver needs at least four pseudo-ranges: three for position, one for its clock. Geometry matters. | §3.1 | `receiver.ts`, test "an error common to every satellite goes into the receiver clock" |
| GPS nominal constellation: 24 satellites, six planes, about 20 200 km altitude, 55° inclination, orbit in about 12 h | §3.2.2 | `orbits.ts` |
| GPS civil signals: L1 C/A at 1575.42 MHz, L5 at 1176.45 MHz; all satellites share a frequency (CDMA) | §3.2.4 | `units.ts` |
| Core constellations need augmentation (ABAS, SBAS or GBAS) to meet aviation requirements | §1.2.2, §2.2.2 | page narrative |
| Integrity: protection levels are upper bounds on the position error; alert limits are the most an operation allows; PL > AL means alert | §2.2.4.3 | `operations.ts` `withinLimits`, `sbasWorld.ts` `approachMode` |
| Time to alert: the longest allowed time from a fault to the crew's alert | §2.2.4.4 | `messages.ts`, scenario test "clock jump" |
| Alert limits and time to alert per operation | Table 2-1 | `operations.ts` |
| Core constellations do not monitor the integrity of the position solution themselves | §2.2.4.2 | page narrative |

## How SBAS works

| Claim | Doc 9849 | Code |
|---|---|---|
| Reference stations over a large area monitor the satellites and send data to master stations | §4.3.1.1 | `groundSegment.ts` |
| Master stations compute clock and orbit corrections and ionospheric grid delays, and bound what is left | §4.3.1.1, §4.3.1.4.2 | `groundSegment.ts`, `iono.ts` |
| UDRE bounds the residual clock/orbit error per satellite; GIVE bounds the grid's ionospheric error | §4.3.1.4.2 | `groundSegment.ts`, `iono.ts` |
| "Do Not Use" and "Not Monitored" satellites cannot be used with SBAS integrity; LPV also needs UDREI ≠ 13 | §4.3.1.3 | `groundSegment.ts`, `sbasWorld.ts` |
| Uplink stations send the messages to the SBAS GEOs, which rebroadcast them; a GEO stays over the equator at a fixed longitude | §4.3.1.2 | `orbits.ts`, `messages.ts` |
| With status and clock/orbit corrections, SBAS supports departure to NPA; with the ionospheric grid too, up to CAT I | §4.3.1.5 | `sbasWorld.ts` `navStatus` |
| The receiver combines UDRE, GIVE and its own error estimates into HPL and VPL and compares them with HAL and VAL | §4.3.2.4 | `receiver.ts` |
| Avionics annunciate the highest level of service supported (LPV, LNAV/VNAV, LNAV) | §4.3.2.5 | `sbasWorld.ts` `approachMode` |
| The FAS data block defines the LPV final approach, protected by a CRC | §4.3.2.7 | `approach.ts` |
| Crews can select an approach by its SBAS channel number | §4.3.2.9 | `approach.ts` |
| LNAV/VNAV, LP and LPV need the avionics to track two SBAS satellites | §4.3.2.10 | `sbasWorld.ts` (GEOs tracked) |
| SBAS avionics fall back to ABAS outside SBAS service, automatically | §4.3.4.3 | `sbasWorld.ts` `navStatus` |
| Message Type 0 means loss of the safety-of-life service; Types 27/28 (L1) and 32 (DFMC) bound errors away from the network | Appendix G 2.5, §4.3.4.2 | `messages.ts` |
| SBAS approaches need no dedicated equipment at the airport | §4.3.3.1 | landing debrief |
| A 35 m VAL supports a 200 ft decision height (SBAS CAT I); worst observed WAAS vertical error 8.9 m in 1.76 billion samples | §4.3.3.3 | "Go deeper" |

## The equatorial region and DFMC

| Claim | Doc 9849 | Code |
|---|---|---|
| The ionosphere is very active near the equator, which makes L1 SBAS vertical guidance hard to provide with high availability | §4.3.1.4 | `iono.ts` (band margin) |
| Bands of dense ionisation form about 15° either side of the magnetic equator; depletions (bubbles) form after sunset | §5.2.1.5 | `iono.ts` |
| Single-frequency SBAS APV and CAT I are not practical in equatorial regions | §5.2.1.5 | scenario test "L1 only, after sunset" |
| Severe scintillation is common near the equator after sunset and before midnight; it is patchy, affects a few satellites and every frequency | §5.2.1.3–5.2.1.4 | `iono.ts` `scintillationLoss` |
| Ionospheric effects have negligible impact on en route to NPA | §5.2.1.1 | scenario test "L1 still gives en-route and terminal integrity" |
| The GPS broadcast model halves the ionospheric error; SBAS reduces it to a few metres and bounds it | §5.2.1.6 | `iono.ts` `broadcastModelSlantL1` |
| DFMC: the ionosphere-free combination removes the ionospheric delay but amplifies noise by about 2.6 | §4.3.1.4.1, §5.2.1.6 | `errors.ts` `IF_NOISE_FACTOR` |
| Dual-frequency SBAS makes APV possible in equatorial States | §6.8.2 | scenario test "DFMC gives LPV" |
| DFMC services are planned (WAAS about 2026, EGNOS from 2028) | §4.3.4.5 | honesty label (planned) |

## Operations and ATM

| Claim | Doc 9849 | Where |
|---|---|---|
| GNSS gives guidance for every phase of flight and enables PBN, ADS-B and ADS-C | §1.4.1.1 | page narrative |
| SBAS supports RNP APCH to LPV and LP minima | §1.4.2.2 | final phase |
| ADS-B broadcasts the GNSS position; its integrity is linked to GNSS alert limits | §1.4.3, §2.2.4.6 | cruise phase |
| States must verify SBAS performance and issue NOTAMs for degradations, using a service volume model | §4.3.3.4.1 | gate phase |
| On GNSS loss: IRS, DME, VOR/DME, ILS and procedural methods (ATC) | §7.13.2 | jamming failure |
| ICAO space weather advisories cover TEC and scintillation | §7.13.3 | "Go deeper" |
