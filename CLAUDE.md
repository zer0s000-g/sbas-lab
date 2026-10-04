# SBAS Lab

One-page educational web sandbox that teaches general learners how a
Satellite-Based Augmentation System (SBAS) works and how air traffic
management uses it. One flight, LAB201, flies gate to gate while the page
shows the whole SBAS chain: GPS satellites, errors, reference stations,
master station, uplink, GEO broadcast, the aircraft receiver, protection
levels, and an LPV approach. Two scenarios, chosen from the tab bar:
- AirNav Indonesia (default, `/`): Jakarta (WIII) to Bali (WADD) with a
  what-if Indonesian SBAS. Kept as it was: tests/golden compares it with the
  original build, and every deliberate change is listed there.
- ESSP-SAS (`/?scenario=essp`): Toulouse-Blagnac (LFBO) to Nice (LFMN) with
  EGNOS, plus its own panels: Break something, Service provision, Real EGNOS
  signal (a replayed 2011 recording) and Assessment (SCORM export).
What to teach: docs/SBAS_CONTENT.md. Prompts: docs/SBAS_Lab_Prompt_Pack.md.
Claims and their review status: src/content/claims (docs/EXPERT_REVIEW.md).

## Stack
React + TypeScript + Vite, Tailwind v4, shadcn/ui (radix), react-three-fiber +
drei + postprocessing, Canvas/SVG, Web Audio, Zustand, MDX, Vitest. No backend.
One route (/). Static site on GitHub Pages.

## Rules
- Simulation logic lives in src/core as pure TypeScript functions, separate
  from rendering, and every function has unit tests (tests/core).
- A scenario is data (src/scenarios/<id>): region, airports, ground sites,
  GEOs, route, approach, failures, narration and page text. It is chosen once
  per page load (src/scenarios/id.ts: `?scenario=`; SBAS_SCENARIO in tests);
  core and views read the active one from src/scenarios/active.ts. Switching
  scenario is a page load, never a change under a running journey. Vitest
  runs the suite once per scenario (projects in vite.config.ts).
- Every fact the page shows is a claim in src/content/claims with its sources
  and status. A claim's value must match the code (tested). Every
  `// TODO(expert-review):` belongs to one "to-confirm" claim. After changing
  a claim run `npm run claims` (docs/EXPERT_REVIEW.md, docs/claims.csv).
- The page is one interactive journey (design.md §4). The journey is a
  deterministic, fixed-tick state machine (src/journey/phases.ts) with tests.
- One world model, one clock, one set of units: metres and seconds for GNSS
  (ECEF, WGS-84), NM / ft / kt / true degrees for the flight. Convert only
  at the edges with src/core/units. Constants (c, WGS-84, GPS L1) are defined once.
- Slow motion freezes the world. When the page shows a signal travelling or
  a message being built, the aircraft does not move.
- Every view is driven by the same engine state: the orbit view, the network
  map, the approach table, the cockpit, and the charts agree.
- Randomness only through a seeded generator passed into the engine.
- Plain language for general learners. Analogy first. Jargon gets tooltips
  (<Term id="...">). Formulas only inside "Go deeper".
- Technical values must match ICAO Annex 10 Vol I (SBAS SARPs) and RTCA
  DO-229. Never invent a specification. If unsure, add
  `// TODO(expert-review): ...` and list it in docs/EXPERT_REVIEW.md.
- The AirNav Indonesia scenario is a what-if Indonesian SBAS. Real: the
  geography (Natural Earth), the airports and runways (AIP Indonesia), the
  Michibiki GEOs QZS-3 (PRN 137) and QZS-6 (PRN 129) and their positions
  (JCAB, gps.gov). Hypothetical, and labelled so on screen: the SBAS service,
  its ground sites (RIMS, master control centres, uplink stations at real
  cities, "illustrative site, not a real facility"), the route's waypoints and
  the LPV procedure. Indonesia has no operational SBAS; MSAS serves Japan. The
  tab names the audience, not an operator.
- The ESSP-SAS scenario shows EGNOS as it is, from official sources: ESSP is
  the EGNOS service provider under contract to EUSPA; the Safety-of-Life GEOs
  (SES-5, PRN 136; Eutelsat 5 West B, PRN 121); the MCCs, NLES and the RIMS
  named in public sources, at city level. Illustrative, and labelled so: the
  route, the RNP RWY 04L LPV procedure at Nice and the NLES-to-GEO pairing.
  EGNOS v3 DFMC is planned, shown only as a preview. The page is not published
  or endorsed by ESSP or EUSPA.
- Never claim that a real SBAS covers a real place unless an official source
  says so, and never name a real organisation as an operator without one.
- When the simulation slows down, scales or simplifies reality, show a label
  on screen (design.md §6).
- The app never shows NaN, never freezes silently and never goes blank
  (design.md §8).
- Footer: "For educational use only, not for operational use."
- Third-party code and data keep their notices (docs/THIRD_PARTY.md): the
  EGNOS recording is EUPL v1.1; the IGP tables come from RTKLIB (BSD 2-clause).

## Design
design.md is the single source of design truth: the "Flight Deck" system
(dark-first graphite, cyan signal and brass accents, HUD chrome, 3D tabletop
dioramas; light and dark themes; 390/768/1440 px). Colours come only from the
CSS variables in src/globals.css. Canvases read them with useThemeTokens(),
three.js with col(t, 'token'). The UI kit lives in src/hud and src/stage.

## Verify before calling anything done
npm test (both scenario projects) · npx tsc -b · npm run build (includes the
bundle budget) · npm run claims leaves the docs unchanged · screenshots at
1440/768/390 in dark and light, both scenarios · axe with zero violations ·
node scripts/verify/gpu-render.mjs on the real GPU for any shader or stage
change (SCENARIO=essp too) · node scripts/verify/page-e2e.mjs (layout, stops,
keyboard, reduced, scenario, essp, scorm).

## Deploy
Push finished work to main; GitHub Actions builds and deploys GitHub Pages.
Do not wait for or check the Pages deployment after pushing.

## Commands
npm run dev | npm run test | npm run build | npm run typecheck |
npm run claims (regenerate the review docs) | npm run scorm (SCORM 1.2 package
of the ESSP-SAS scenario in dist-scorm/)
