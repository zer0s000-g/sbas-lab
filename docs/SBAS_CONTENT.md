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

## Systems of the world (Go deeper only)
WAAS, EGNOS, MSAS, GAGAN, SDCM, KASS, BDSBAS, SouthPAN, and others planned.
Name them only with facts from official sources; otherwise add TODO(expert-review).

## Quiz (debrief, 8 questions, friendly explanations)
Topics: why four satellites; which error is largest; what reference stations
do; why a GEO satellite; what a protection level is; what happens when VPL >
VAL; what LPV gives an airport without ILS; what the controller hears when LPV
is lost.
