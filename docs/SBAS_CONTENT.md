# What SBAS Lab teaches

Audience: general learners, plus ATC and ATSEP trainees who want the "why".
No aviation or engineering background is assumed on the main page. Every
exact value lives in "Go deeper" drawers and carries a source or a
TODO(expert-review).

## The one idea
GPS alone is good enough to know roughly where you are, but not good enough,
or trustworthy enough, to guide an aircraft down to 200 ft above a runway.
SBAS watches the GPS satellites from the ground, works out how wrong they are
right now, and broadcasts corrections plus a warning service from a
geostationary satellite. Every aircraft in the region can use them.

## Analogy
A group of hikers each estimates their position from distant church bells
(the satellites). A team of surveyors standing at known spots (reference
stations) hears the same bells, notices "the north bell is 3 seconds late
today", and a lookout on a tall tower (the GEO satellite) shouts that
correction to everyone, plus "don't trust the east bell" when one is broken.

## The chain (each is one phase or one stop on the page)
1. GPS satellites broadcast their position and time on L1.
2. Errors: satellite clock, orbit (ephemeris), ionosphere (the largest), troposphere,
   multipath and receiver noise. SBAS corrects the first three for the region. The
   receiver models the troposphere. Multipath and noise stay.
3. Reference stations at surveyed positions measure every satellite.
4. The master station computes:
   - fast corrections (clock);
   - long-term corrections (orbit and slow clock);
   - ionospheric vertical delays on a grid of points (IGPs), with an uncertainty for each
     (GIVE);
   - an uncertainty per satellite (UDRE);
   - integrity flags ("Do not use").
5. Uplink stations send the messages to the GEO satellites.
6. The GEO satellite rebroadcasts them on the GPS L1 frequency, at 250 bits per second, one
   250-bit message per second. It also acts as an extra ranging source.
7. The aircraft receiver:
   - applies the corrections;
   - weights each satellite by its uncertainty;
   - computes a position;
   - computes the protection levels HPL and VPL (a bound on the error at a very small
     probability);
   - compares them with the alert limits HAL and VAL of the operation.
8. If a PL is larger than its AL, the operation is unavailable: the receiver downgrades
   (LPV → LNAV) or flags. If SBAS learns that a satellite is bad, it must warn within the
   time to alert.

## ATM applications (the page shows each in context)
- PBN approaches with vertical guidance to runways without ILS: RNP APCH to
  LPV minima (and LP, LNAV/VNAV with SBAS vertical guidance). SBAS CAT I
  (LPV-200) where approved.
- The final approach segment is defined by a FAS data block (with a CRC) in the
  aircraft database. The ground has no ILS antennas to maintain or flight-check.
- En route and terminal RNAV/RNP navigation with integrity.
- ADS-B: SBAS-corrected positions give better NIC/NACp quality indicators, so
  surveillance can be trusted more.
- Service provision: LPV availability prediction and NOTAMs for SBAS outages.
  ATC phraseology when an aircraft reports loss of LPV or GNSS interference.
  Fallback to LNAV minima, conventional aids or radar vectors.
- Planning: SBAS lets an ANSP rationalise conventional aids while keeping a
  minimum operational network.

## Low-latitude reality (important for an equatorial region)
- Near the geomagnetic equator the ionosphere is stronger and patchier: the equatorial
  anomaly, plasma bubbles and scintillation.
- Single-frequency SBAS has a harder time bounding it, so VPL grows and LPV availability
  drops.
- The page must show this honestly: a "storm" and a "scintillation" failure, and a
  dual-frequency multi-constellation (DFMC, L1/L5) toggle in "Go deeper" that removes
  most of the ionospheric delay but not scintillation.
- Do not state the performance or coverage of any real system over a real country.
  Point to official sources instead.

## The scenario: a what-if Indonesian SBAS
- **The flight.** LAB201 from Jakarta Soekarno-Hatta (WIII, runway 07R) to Bali I Gusti
  Ngurah Rai (WADD, runway 09), about 530 NM: climb over the Java Sea, FL330 along the
  north coast of Java, descent across East Java, straight-in final over the sea. Departs
  08:00 WIB, arrives about 10:40 WITA. SBAS is used in every phase.
- **Real.** Geography (Natural Earth), airports and runways (AIP Indonesia AD 2), the
  Michibiki GEOs QZS-3 (127°E, PRN 137) and QZS-6 (90.5°E, PRN 129) that broadcast MSAS
  (JCAB, EGNOS Workshop 2025). Japan's QZS-7 (175°W, PRN 139) is too far east for western
  Indonesia and is not used.
- **Hypothetical.** Indonesia has no operational SBAS, and MSAS serves Japan (Fukuoka FIR).
  The page imagines an Indonesian service and says so: the service, its ground sites, the
  route's waypoints and the LPV procedure (an illustrative RNP RWY 09, not a published one).
- **The ground segment (illustrative sites at real cities, not real facilities).**
  - 16 RIMS (Ranging and Integrity Monitoring Stations; WAAS calls them WRS, MSAS GMS):
    Banda Aceh, Medan, Padang, Palembang, Pontianak, Jakarta, Surabaya, Denpasar, Kupang,
    Balikpapan, Makassar, Manado, Ambon, Sorong, Jayapura, Merauke.
  - Two master control centres: Jakarta (primary), Makassar (backup), as MSAS has two MCS.
  - Two ground uplink stations, one per GEO, so each PRN has its own uplink (as MSAS does).
  - The terrestrial network linking them, and a service performance and NOTAM function at
    the MCC that issues the availability prediction the crew checks at the gate.
  - Go deeper: Michibiki is uplinked from Japan today (Hitachi-ota, Tanegashima,
    Miyakojima); a real Indonesian service would need an agreement on how its messages
    reach the satellite.
- **The ionosphere.** The magnetic equator runs north of Indonesia, so Java and Bali lie
  under the southern dense band of the equatorial anomaly, and bubbles form after sunset.
- **Words that get tooltips (Stage 4 glossary).** RIMS, MCC, GUS, GEO, PRN, QZSS /
  Michibiki, MSAS, DFMC, EIA (equatorial ionisation anomaly), plasma bubble, FIR, NOTAM,
  LPV, FAS data block.

## L1 SBAS and DFMC SBAS in this region (Doc 9849)
- Over Indonesia, near the magnetic equator, **L1 SBAS** gives integrity for departure, en
  route, terminal and non-precision approach (§4.3.1.5). Ionospheric effects barely
  touch those operations (§5.2.1.1).
- L1 SBAS vertical guidance (LPV) is not practical near the equator (§5.2.1.5). The grid
  cannot follow the steep daytime gradients and the post-sunset bubbles, so GIVE grows
  and VPL > VAL.
- The hypothetical Indonesian SBAS also offers a **DFMC (L1/L5)** service. The ionosphere-free
  combination removes the delay itself (§4.3.1.4.1), so LPV is available (§6.8.2). The
  cost is noise amplified about 2.6× (§5.2.1.6).
- Scintillation is not removed by two frequencies. It knocks out a few satellites at a
  time (§5.2.1.3).
- Honesty: DFMC services are planned, not operational yet (§4.3.4.5). The page says the
  DFMC service is part of the hypothetical Indonesian SBAS.

## What SBAS gives in each phase (the "SBAS benefit" card)
Each phase shows:
- the operation, its HAL/VAL and its time to alert (Doc 9849 Table 2-1);
- GPS alone versus SBAS, on the same satellites.

| Phase | Operation (Table 2-1) | What the learner sees |
|---|---|---|
| Gate | none | SBAS availability prediction and NOTAM check (§4.3.3.4.1) |
| Taxi/Takeoff | departure | The GPS-only fix and the SBAS fix, next to the truth |
| Climb | terminal: HAL 1.85 km, TTA 15 s | Four satellites, DOP, integrity |
| Errors → Broadcast | none (slow motion) | The SBAS chain, satellite by satellite |
| Cruise | continental en route: HAL 3.7 km, TTA 5 min | The PL far inside HAL; a trustworthy ADS-B position (§1.4.3) |
| Descent | NPA: HAL 556 m, TTA 10 s | FAS data block and CRC, channel, two GEOs, "LPV" arms |
| Final | APV-I: HAL 40 m, VAL 50 m, TTA 10 s | HPL/VPL inside HAL/VAL; L1-only would fall back to LNAV |
| Landing | none | No ILS or airport ground equipment needed (§4.3.3.1) |

The claim-by-claim references are in `docs/SOURCES.md`.

## Systems of the world (Go deeper only)
WAAS, EGNOS, MSAS, GAGAN, SDCM, KASS, BDSBAS, SouthPAN, and others planned.
Name them only with facts from official sources; otherwise add TODO(expert-review).

## Quiz (debrief, 8 questions, friendly explanations)
Topics: why four satellites; which error is largest; what reference stations
do; why a GEO satellite; what a protection level is; what happens when VPL >
VAL; what LPV gives an airport without ILS; what the controller hears when LPV
is lost.
