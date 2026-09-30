# SBAS Lab

One-page educational web sandbox that teaches general learners how a
Satellite-Based Augmentation System (SBAS) works and how air traffic
management uses it. One flight, LAB201, flies from gate to gate while the page
shows the whole SBAS chain: GPS satellites, errors, reference stations,
master station, uplink, GEO broadcast, the aircraft receiver, protection
levels, and an LPV approach.
What to teach: docs/SBAS_CONTENT.md. Prompts: docs/SBAS_Lab_Prompt_Pack.md.

## Stack
React + TypeScript + Vite, Tailwind v4, shadcn/ui (radix), react-three-fiber +
drei + postprocessing, Canvas/SVG, Web Audio, Zustand, MDX, Vitest. No backend.
One route (/). Static site on GitHub Pages.

## Rules
- Simulation logic lives in src/core as pure TypeScript functions, separate
  from rendering, and every function has unit tests (tests/core).
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
- The region, airports, stations and frequencies are fictional and labelled
  "made up for this fictional region". Never claim that a real SBAS covers a
  real place unless an official source says so.
- When the simulation slows down, scales or simplifies reality, show a label
  on screen (design.md §6).
- The app never shows NaN, never freezes silently and never goes blank
  (design.md §8).
- Footer: "For educational use only, not for operational use."

## Design
design.md is the single source of design truth: the "Flight Deck" system
(dark-first graphite, cyan signal and brass accents, HUD chrome, 3D tabletop
dioramas; light and dark themes; 390/768/1440 px). Colours come only from the
CSS variables in src/globals.css. Canvases read them with useThemeTokens(),
three.js with col(t, 'token'). The UI kit lives in src/hud and src/stage.

## Verify before calling anything done
npm test · npx tsc -b · npm run build (includes the bundle budget) ·
screenshots at 1440/768/390 in dark and light · axe with zero violations ·
node scripts/verify/gpu-render.mjs on the real GPU for any shader or stage
change · node scripts/verify/page-e2e.mjs.

## Deploy
Push finished work to main; GitHub Actions builds and deploys GitHub Pages.
Do not wait for or check the Pages deployment after pushing.

## Commands
npm run dev | npm run test | npm run build | npm run typecheck
