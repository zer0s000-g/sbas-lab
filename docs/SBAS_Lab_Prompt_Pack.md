# SBAS Lab: Prompt Pack (one-page sandbox, CNS Lab "Flight Deck" design)

**What this is.** A complete prompt pack for building **SBAS Lab** from scratch with Claude Code.
SBAS Lab is a one-page interactive sandbox that teaches how a Satellite-Based Augmentation
System works and how air traffic management uses it. It reuses the look and the engineering
rules of CNS Lab (github.com/zer0s000-g/cns-lab): the **Flight Deck** HUD/FUI design system,
and the gate-to-gate structure of its **Airspace Sandbox** page.

**Why a pack and not one prompt.** CNS Lab was not built from one prompt. It started from a master
prompt, then took about 30 sessions: the Flight Deck redesign, the one-page Sandbox rebuild and
five hardening batches. This pack puts the end state into files and prompts up front, so the new
project starts where CNS Lab finished.

**Disclaimer:** SBAS Lab is for educational use only and must not be used for operational
purposes. A qualified CNS/ATSEP or GNSS engineer should check the technical content against
ICAO Annex 10 Volume I and RTCA DO-229 before publication.

---

## Contents

1. [How to use this pack](#1-how-to-use-this-pack)
2. [File: CLAUDE.md](#2-file-claudemd)
3. [File: design.md (the design system)](#3-file-designmd)
4. [File: src/globals.css (the tokens, verbatim from CNS Lab)](#4-file-srcglobalscss)
5. [File: docs/SBAS_CONTENT.md (what the page teaches)](#5-file-docssbas_contentmd)
6. [Master prompt](#6-master-prompt)
7. [Stage prompts (one per session)](#7-stage-prompts)
8. [Technical review checklist](#8-technical-review-checklist)
9. [Pitfalls CNS Lab already hit](#9-pitfalls-cns-lab-already-hit)

---

## 1. How to use this pack

1. Create a new folder, for example `sbas-lab/`, and run `git init`.
2. Save sections 2 to 5 as files in that folder, at the paths in their headings:
   - `CLAUDE.md`
   - `design.md`
   - `src/globals.css`
   - `docs/SBAS_CONTENT.md`
3. Save this whole pack as `docs/SBAS_Lab_Prompt_Pack.md`.
4. Start Claude Code in the folder and send the **Master prompt** (section 6). It tells Claude
   to build Stage 0 only and stop.
5. Start one session per stage after that, using the short **Stage prompts** in section 7.
   Review the running page after every stage, and commit it.

**Optional shortcut (the same look, faster).** Section 4 has the tokens verbatim, so the look
does not depend on the old repository. You can still copy these CNS Lab files into the new repo
as a starting point and tell Claude to adapt them. They are generic kit code with no CNS Lab
content:
- `src/hud/*`
- `src/stage/Stage.tsx`, `PenPlot.tsx`, `Callout3D.tsx`, `Wire3D.tsx`, `LazyStage.tsx`,
  `StageBoundary.tsx`
- `src/components/ui/*` (the restyled shadcn/ui primitives)
- `src/hooks/useThemeTokens.ts`, `useSampled.ts`, `useSimClock.ts`, `useAnimationFrame.ts`,
  `useMediaQuery.ts`
- `src/lib/format.ts`, `lazyRetry.ts`, `color.ts`, `utils.ts`, `audio.ts`
- `src/core/guard.ts`, `random.ts`, `clock.ts`
- `scripts/budget.mjs`, `scripts/postbuild.mjs`, `scripts/verify/gpu-render.mjs`,
  `scripts/verify/sandbox-e2e.mjs`

If you copy them, add this line to the master prompt:
"The files in src/hud, src/stage, src/components/ui, src/hooks, src/lib and scripts come from CNS
Lab. Keep their behaviour and adapt them."

---

## 2. File: CLAUDE.md

```markdown
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
```

---

## 3. File: design.md

```markdown
# SBAS Lab: Design System ("Flight Deck")

This file is the single source of design truth for SBAS Lab, and every UI change must
follow it. It is the CNS Lab Flight Deck system, applied to one page.

## 1. Design language

The site should feel like an instrument console in a dark studio. The page opens on a
**lit miniature**: the Earth and its satellites, a terrain table, or an approach to a
runway, framed by **HUD chrome** (hairlines, corner brackets, mono labels, telemetry). The
simulation is the hero. The chrome is precise and quiet around it.

- **Dark first.** The default theme is dark (graphite). The light theme is fully supported.
  Stages, scopes and cockpit instruments stay night-scene in both themes.
- **One accent pair.**
  - Cyan `--signal` means live signal, focus and the primary action. In SBAS Lab, cyan is
    the GPS ranging signal and the protection level.
  - Brass `--brass` means hardware, the analogy and a second signal. In SBAS Lab, brass is
    the SBAS correction path (reference stations, master station, uplink, GEO broadcast)
    and the alert limit.
  - Red `--destructive` is only for alarms and failures (an integrity alert, "Do not use",
    LPV lost). Green `--success` is only for OK or completed. Neither is used for decoration.
  - No new hues. The ionosphere is `--stage-glass` at low opacity. A storm raises its opacity
    and adds a label, and never turns it red.
- **Hairlines, not boxes.** Surfaces are separated by 1px `--hud-line` rules and `hud-panel`
  glass: a translucent `--hud-panel` fill with a backdrop blur. Radius is small: 4–6px on
  panels and 3–4px on controls. There are no drop shadows. A glow
  (`shadow-[0_0_Npx_var(--signal)]`) marks only live or active things.
- **Type.**

  | Role | Font | Where |
  |---|---|---|
  | Display | Michroma, `.hud-title` (uppercase, wide) | Titles, panel names, phase heads |
  | Reading | Inter Tight | Prose, 15–18px |
  | Data | JetBrains Mono, `.hud-label` / `.hud-value` | Labels (uppercase, tracked, 10–11px) and numbers |

  All numbers use tabular figures.
- **Motion teaches.**
  - The camera moves between shots, and pen-plot edges reveal the miniatures.
  - Signals travel along wires, messages scroll into the log, and protection-level
    cylinders grow and shrink, so the learner sees what the physics does.
  - Everything respects reduced motion: the camera snaps and decorative motion stops.
- **Never:**
  - hex or rgb literals in components;
  - Tailwind palette classes (`bg-blue-500`);
  - emoji;
  - decoration that contradicts the physics.

## 2. Tokens (`src/globals.css`)

Every colour is a CSS variable, and Tailwind classes reference the variables.
- Canvas code reads `tokens[...]` via `useThemeTokens()`.
- three.js code uses `col(t, 'token')` from `@/stage/Stage`.

| Group | Tokens | Notes |
|---|---|---|
| Core | `--background --foreground --card --popover --primary --secondary --muted --muted-foreground --accent --border --input --ring` | shadcn theming. In dark, `--primary` is the signal cyan. |
| Flight Deck | `--signal --brass --hud-line --hud-panel` | Accent pair, hairline, glass |
| Semantic | `--destructive --success --warning` | Meaning only |
| Stage (3D) | `--stage-bg --stage-floor --stage-fog --stage-line --stage-metal --stage-metal-dark --stage-paint --stage-terrain --stage-terrain-high --stage-water --stage-signal --stage-brass --stage-alert --stage-glass` | Night scene in both themes |
| Airfield lamps | `--lamp-red --lamp-green --lamp-white --lamp-blue --lamp-amber` | Real runway, approach, PAPI and aircraft light colours, the same in both themes. Only for lamps |
| Maps | `--sim-*` | Follow the theme |
| Scopes and charts on instrument screens | `--scope-*` | Dark in both themes |
| Cockpit instruments | `--instrument-*` | Dark in both themes |
| Data series | `--chart-1..5` | Signal, brass, then quieter hues |

Stage chrome sits inside a `dark` class scope, so HUD text on a night stage stays legible in
the light theme too. Text inside that scope uses `text-foreground` explicitly.

**SBAS meanings (always with a label or a shape, never colour alone).**

| Thing | Token | Shape or label |
|---|---|---|
| GPS satellite and ranging signal | `--stage-signal` / `--sim-signal` | Satellite glyph, solid wire |
| GEO satellite, SBAS broadcast, corrections | `--stage-brass` / `--sim-signal-2` | Diamond glyph, dashed wire |
| Reference station, master station, uplink | `--stage-brass` | Triangle, square and dish glyphs with mono labels |
| Protection level (HPL, VPL) | `--signal` | Filled glass cylinder, labelled "HPL" / "VPL" |
| Alert limit (HAL, VAL) | `--brass` | Wireframe cylinder, labelled "HAL" / "VAL" |
| True position | `--foreground` / `--stage-paint` | Small cross, "truth" |
| GPS-only position | `--muted-foreground` | Hollow circle, "GPS only" |
| Integrity alert, "Do not use", unavailable | `--destructive` / `--stage-alert` | Text flag, blinking only if motion is allowed |
| Ionosphere | `--stage-glass` at low alpha | A labelled shell |

## 3. Components

- **HUD kit** (`src/hud`):
  - `HudFrame`: `CornerBrackets`, `TitleBlock` (a kicker with a brass square, a wide display
    title and a mono sub-line), and `HudPanel` (glass, an indexed header such as
    `01 · FLIGHT`, and a body).
  - `Telemetry`: `TelemetryRow`, `BarMeter` (vertical or horizontal), `NeedleGauge`.
  - `Controls`: `Dial`, `LeverSwitch`, `Segmented`, `HudButton`.
  - `PhaseTimeline`: a hairline track with a tick per phase. The active tick glows and the
    progress line is signal cyan. Click a tick, or use ←/→ when it has focus.
  - `MissionClock`: the journey clock and the time-lapse factor.
  - Every control is keyboard operable and labelled. `Dial` is a `role="slider"` with
    arrow, Page and Home/End keys.
- **Stage** (`src/stage`):
  - `Stage`: the WebGL check, performance tiers, bloom, vignette and grain, and a
    reduced-motion snap.
  - `CameraRig` (eased shots), `StudioLights` (Lightformers only), `StudioFloor`,
    `PenPlot` (edge-draw reveal).
  - `Callout3D`: a world-anchored DOM label.
  - `Wire3D`: a glowing line between two moving points, bent in the shader. Uses: satellite
    to receiver, satellite to reference station, station to master, uplink to GEO, GEO to
    aircraft.
  - Drag to look around: the camera orbits the current shot and double-click resets it. On
    touch only sideways drags turn the camera, so the page still scrolls. There is no wheel
    zoom.
- **shadcn/ui** primitives (`src/components/ui`) are restyled to this file: mono uppercase
  buttons, hairline outlines, a brass slider thumb. Use them for anything the HUD kit does
  not cover (Select, Popover, Tooltip, Sheet, Tabs and so on).
- **Instruments** (`src/instruments`), each built once:
  - `CDI`: an HSI with lateral and vertical deviation, the approach mode annunciator
    (LPV / LNAV/VNAV / LNAV) and flags;
  - `ProtectionBars`: HPL against HAL and VPL against VAL as paired bar meters;
  - `SkyPlot`: satellites by azimuth and elevation, with "used" and "excluded" shapes;
  - `StanfordChart`: position error against protection level, with the four labelled
    regions;
  - `MessageLog`: SBAS messages as mono rows.

## 4. Layout: the one page

The page follows **LAB201** from gate to gate. The view shows whatever explains the current
phase, and a short fade covers each switch.

**Views (world views):**

| View | What it shows | Used for |
|---|---|---|
| `orbit` | A procedural Earth (no textures) with the GPS constellation, two GEO satellites, the ionosphere shell and the ground segment dots | Satellites, errors, the uplink and the broadcast |
| `network` | A 2D region map (theme-following `--sim-*` colours): reference stations, master station, uplink station, the ionospheric grid (IGPs), the service area and a live LPV-availability contour | Reference stations, master station, the storm |
| `approach` | A 3D terrain table with the runway, the final approach segment, and the aircraft inside its HPL/VPL cylinder and the HAL/VAL wireframe | En route, the approach, landing |

**Chrome:**
- **Top bar:** the SBAS LAB wordmark, the phase name, the approach mode annunciator, the
  journey clock, play/pause, the theme toggle and a panels toggle.
- **Bottom:** a twelve-phase `PhaseTimeline` (click to jump) and the camera buttons: follow,
  overview, zoom and reset.
- **Panels at 1440 and 1024 px:** two glass columns over the view (340 px wide, or 300 px
  below 1440).
  - Left column: the flight card, "What's happening" (narration for the phase) and the
    message log.
  - Right column: the SBAS status panel (satellites used, DOP, HPL/VPL/HAL/VAL, mode), the
    cockpit (CDI and ProtectionBars), the Stanford chart, time-lapse and view controls,
    and "Break something".
- **At 768 px:** the panels move below the view in two columns.
- **At 390 px:** the view is a 56svh sticky strip, and the panels sit below it in tabs
  (Now, Cockpit, Signals, Break it).
- **Scrims:** HUD text on the view sits over top and bottom scrims.
- **No sideways scroll** at any width. Touch targets are at least 40px.

**Time.**
- The auto time-lapse runs slowly on the runway and on final, and fast in cruise
  (speeds 1, 2, 4, 8, 16, 30, 60).
- Signal-chain moments play in slow motion with the world frozen.
- **Guided stops** pause the journey at four moments:
  1. first GPS-only fix;
  2. the first correction arrives;
  3. LPV engaged on final;
  4. touchdown.
- A **debrief** with the quiz follows the landing.

**Glossary:** there is no second route. Terms show a tooltip, and a "Glossary" button opens a
Sheet with every term.

**Footer on the page:** "For educational use only, not for operational use."

## 5. Accessibility

- Contrast is at least 4.5:1 for body text in both themes. Stage text sits on a scrim or in
  `hud-panel`s.
- Every control has a visible label, and focus rings are visible (`--ring`).
- Colour never carries meaning alone.
- Stages and canvases have `role="img"` with a text description that updates with the
  state (for example "LAB201 on final, 4.2 NM from the runway, VPL 18 m within VAL 35 m,
  LPV available").
- Every 3D label is also in a keyboard-reachable list.
- Audio (an alert chime, a captioned radio call) always has a caption.
- Reduced motion: the camera snaps, and signal pulses become static wires.

## 6. Honesty labels

Every view says what is not to scale:
- orbit: "Earth to scale · satellites drawn 400× larger · orbits to scale · time ×N";
- approach: "Table 20 NM across · heights ×3 · protection cylinders to scale with the
  runway";
- network: "Region map · fictional stations · to scale".

Slow-motion moments show "Slowed down so you can see it" and freeze the world. Stations,
airports and frequencies are "made up for this fictional region". The Break panel says the
flight keeps its planned path whatever is broken, and the page shows what the crew and the
controller would do.

## 7. Performance and assets

**Lightest asset first.**
- Everything visual is CSS, inline SVG or geometry built in code. The Earth is a shader or
  procedural geometry, not a texture file.
- There are no image, model or HDR files in the app. The only raster files are the app
  icons and a small social card.
- 3D is lit with drei `Lightformer`s and uses small `CanvasTexture`s only.

**Code splitting.**
- three.js, drei and postprocessing live in their own chunk. `LazyStage` loads it after
  the page has loaded and the browser is idle, and shows a same-size `StagePoster` until
  then.
- Each view scene is lazy (`lazyRetry`, never `React.lazy` directly).

**Budget.** `scripts/budget.mjs` runs after every build and in CI. It fails the build if the
page's first-load JS goes over 250 kB gzip (scripts plus modulepreload hints) or its CSS over
50 kB.

**Measured targets** (390 px, slow 4G, 4× CPU):

| Metric | Target |
|---|---|
| LCP | < 2.5 s |
| CLS | < 0.1 |

**Runtime.**
- Device pixel ratio is between 1 and 2, with `PerformanceMonitor` quality tiers. Never
  raise the DPR dynamically.
- The stage stops rendering while it is off screen.
- Frame loops mutate refs and never set React state per frame. Text readouts are sampled at
  about 10 Hz.

**Offline.** `public/sw.js` fetches the page network-first and serves hashed assets
cache-first, cached on use.

## 8. Failure handling

- A route error screen covers crashes, a stale chunk after a deploy (with a reload button)
  and offline.
- `StageBoundary` keeps the page, its panels and the 2D map working when WebGL fails.
- Core functions return a "no answer" result for NaN or Infinity, for example "no fix",
  "PL unavailable" or "Do not use". Readouts use `@/lib/format`, which shows "—" and never
  "NaN".
- Saved state (theme, stops on or off, quiz answers) uses `safeStorage` with a version and
  a validating `merge`.

## 9. Verification

Before calling any UI change done:
- Take screenshots at 1440, 768 and 390 px, in dark and light, for every phase.
- Run `npm test`, `npx tsc -b` and `npm run build` (which includes the budget).
- Run the axe audit (zero violations), and measure LCP and CLS on a throttled mobile profile.
- Run `scripts/verify/page-e2e.mjs`. It covers every phase at every width and theme, no
  sideways scroll, axe, guided stops, the debrief, keyboard reach, focus rings, reduced
  motion, and a GPU-memory check over view switches.
- **For any shader or stage change, render on a real GPU**, not only the software renderer:
  `scripts/verify/gpu-render.mjs` visits every phase with headless Chrome on the machine's
  GPU (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist` on a Mac) and flags black
  frames or flicker. Shader rules:
  - use `max(fwidth(x), 1e-4)` for edge widths;
  - use `pow(max(b, 0.0), k)`;
  - never divide by a value that can reach zero.
```

---

## 4. File: src/globals.css

These are the CNS Lab design tokens and utilities, verbatim. Colour values live only in
this file.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/inter-tight";
@import "@fontsource-variable/jetbrains-mono";
@import "@fontsource/michroma";

/*
 * CNS Lab design tokens — the single place where colour values live.
 * Components and canvases read these variables; never hardcode a colour.
 * See design.md for the rules behind each token.
 */

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Inter Tight Variable", ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
  /* Wide display face for titles, chapter names and HUD headings (always uppercase). */
  --font-display: "Michroma", "Inter Tight Variable", ui-sans-serif, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, "SFMono-Regular", monospace;

  /* 13px UI text, 12px meta, 15px reading prose */
  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.25rem;
  --text-xs: 0.75rem;
  --text-xs--line-height: 1rem;
  --text-prose: 0.9375rem;
  --text-prose--line-height: 1.6rem;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* Simulation surfaces (usable as bg-sim-bg, text-scope-text, ...) */
  --color-sim-bg: var(--sim-bg);
  --color-sim-grid: var(--sim-grid);
  --color-sim-ink: var(--sim-ink);
  --color-sim-muted: var(--sim-muted);
  --color-sim-signal: var(--sim-signal);
  --color-sim-signal-2: var(--sim-signal-2);
  --color-sim-neutral: var(--sim-neutral);
  --color-sim-grid-strong: var(--sim-grid-strong);
  --color-sim-terrain: var(--sim-terrain);
  --color-sim-terrain-high: var(--sim-terrain-high);
  --color-sim-coverage: var(--sim-coverage);
  --color-sim-sky: var(--sim-sky);
  --color-sim-fog: var(--sim-fog);
  --color-sim-land: var(--sim-land);
  --color-sim-water: var(--sim-water);
  --color-sim-warning: var(--sim-warning);
  --color-sim-alert: var(--sim-alert);
  --color-sim-ok: var(--sim-ok);
  --color-scope-bg: var(--scope-bg);
  --color-scope-text: var(--scope-text);
  --color-scope-dim: var(--scope-dim);
  --color-scope-trace: var(--scope-trace);
  --color-scope-trace-2: var(--scope-trace-2);
  --color-scope-blip: var(--scope-blip);
  --color-scope-warning: var(--scope-warning);
  --color-scope-alert: var(--scope-alert);
  --color-scope-grid: var(--scope-grid);
  --color-instrument-face: var(--instrument-face);
  --color-instrument-bezel: var(--instrument-bezel);
  --color-instrument-marking: var(--instrument-marking);
  --color-instrument-dim: var(--instrument-dim);
  --color-instrument-accent: var(--instrument-accent);
  --color-instrument-flag: var(--instrument-flag);
  --color-brass: var(--brass);
  --color-signal: var(--signal);
  --color-hud-line: var(--hud-line);
  --color-hud-panel: var(--hud-panel);
  --color-stage-bg: var(--stage-bg);
  --color-lobe-90: var(--lobe-90);
  --color-lobe-150: var(--lobe-150);
  --color-marker-outer: var(--marker-outer);
  --color-marker-middle: var(--marker-middle);
  --color-marker-inner: var(--marker-inner);

  --radius-sm: calc(var(--radius) * 0.5);
  --radius-md: calc(var(--radius) * 0.75);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.5);
}

:root {
  --radius: 0.375rem; /* 6px panels; md ≈ 4.5px controls: crisp, instrument-like */

  /* Flight Deck core (light) */
  --background: hsl(0 0% 100%);
  --foreground: hsl(222 47% 11%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222 47% 11%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222 47% 11%);
  --primary: hsl(192 90% 31%); /* signal cyan, darkened for 5:1 with white text */
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(210 40% 96%);
  --secondary-foreground: hsl(222 47% 11%);
  --muted: hsl(210 40% 96%);
  --muted-foreground: hsl(215 16% 42%); /* ≥ 5.1:1 on white and the tinted surfaces */
  --accent: hsl(190 60% 95%);
  --accent-foreground: hsl(192 90% 24%);
  --destructive: hsl(0 72% 51%);
  --success: hsl(142 72% 29%);
  --warning: hsl(32 95% 33%); /* 5:1 on white */
  --border: hsl(214 32% 91%);
  --input: hsl(214 32% 84%);
  --ring: hsl(192 90% 31%);

  /* Data series: signal, brass, then quieter hues */
  --chart-1: hsl(192 90% 31%);
  --chart-2: hsl(32 75% 38%);
  --chart-3: hsl(205 70% 40%);
  --chart-4: hsl(170 60% 30%);
  --chart-5: hsl(214 12% 45%);

  /* Maps and diagrams (follow the theme) */
  --sim-bg: hsl(210 40% 98%);
  --sim-land: hsl(210 25% 95%);
  --sim-water: hsl(208 85% 90%);
  --sim-terrain: hsl(215 14% 62%);
  --sim-terrain-high: hsl(215 19% 40%);
  --sim-grid: hsl(214 32% 86%);
  --sim-grid-strong: hsl(215 20% 72%);
  --sim-ink: hsl(222 47% 11%);
  --sim-muted: hsl(215 16% 42%);
  --sim-signal: hsl(192 90% 31%);
  --sim-signal-2: hsl(32 75% 38%);
  --sim-neutral: hsl(215 20% 55%);
  --sim-coverage: hsl(192 90% 31% / 0.12);
  --sim-shadow-zone: hsl(222 47% 11% / 0.08);
  --sim-warning: hsl(32 95% 44%);
  --sim-alert: hsl(0 72% 51%);
  --sim-ok: hsl(142 72% 29%);
  --sim-sky: hsl(210 60% 96%);
  --sim-fog: hsl(210 20% 92%);

  /* Instrument screens and radar scopes are dark in both themes, like the real thing */
  --scope-bg: hsl(220 30% 3.5%);
  --scope-grid: hsl(188 60% 80% / 0.12);
  --scope-grid-strong: hsl(188 60% 80% / 0.26);
  --scope-trace: hsl(188 95% 60%);
  --scope-trace-2: hsl(36 80% 62%);
  --scope-blip: hsl(186 100% 76%);
  --scope-text: hsl(190 30% 92%);
  --scope-dim: hsl(200 14% 58%);
  --scope-clutter: hsl(200 12% 52%);
  --scope-warning: hsl(38 92% 60%);
  --scope-alert: hsl(356 90% 64%);
  --instrument-face: hsl(220 18% 5%);
  --instrument-bezel: hsl(218 10% 17%);
  --instrument-marking: hsl(40 20% 94%);
  --instrument-dim: hsl(214 10% 58%);
  --instrument-needle: hsl(40 30% 96%);
  --instrument-accent: hsl(188 95% 60%);
  --instrument-flag: hsl(356 88% 60%);

  /* ILS lobes: always paired with a label and a hatch pattern */
  --lobe-90: hsl(192 90% 31%);
  --lobe-150: hsl(32 75% 38%);

  /* Marker beacon lamps (real cockpit colours), always labelled O / M / I */
  --marker-outer: hsl(217 91% 60%);
  --marker-middle: hsl(38 92% 50%);
  --marker-inner: hsl(0 0% 100%);

  /* Flight Deck accents (light variant) */
  --brass: hsl(32 75% 35%); /* 5.2:1 on white */
  --signal: hsl(192 90% 31%); /* 5.0:1 on white */
  --hud-line: hsl(215 25% 20% / 0.22);
  --hud-panel: hsl(0 0% 100% / 0.82);
  /* The 3D stage is a night scene in both themes, like a lit studio. */
  --stage-bg: hsl(220 22% 5%);
  --stage-floor: hsl(218 16% 9%);
  --stage-fog: hsl(220 20% 6%);
  --stage-line: hsl(205 30% 88% / 0.75);
  --stage-metal: hsl(215 10% 34%);
  --stage-metal-dark: hsl(220 10% 14%);
  --stage-paint: hsl(210 8% 78%);
  --stage-terrain: hsl(212 9% 36%);
  --stage-terrain-high: hsl(36 14% 76%);
  --stage-water: hsl(206 42% 15%);
  --stage-signal: hsl(188 95% 60%);
  --stage-brass: hsl(36 80% 56%);
  --stage-alert: hsl(356 90% 60%);
  --stage-glass: hsl(195 60% 80%);
  /* Airfield lights on the night stage: the real lamp colours (the same in both
     themes). Only for runway, taxiway, stop-bar, PAPI and aircraft lights; they
     are not the semantic alarm and OK colours. */
  --lamp-red: hsl(0 100% 60%);
  --lamp-green: hsl(140 85% 55%);
  --lamp-white: hsl(45 70% 94%);
  --lamp-blue: hsl(218 95% 66%);
  --lamp-amber: hsl(38 100% 60%);
}

/*
 * Flight Deck: the primary, dark-first palette. Graphite stage, hairline
 * HUD lines, electric cyan for radio energy and live data, warm brass for
 * hardware, one red for alarms only.
 */
.dark {
  --background: hsl(220 22% 5%);
  --foreground: hsl(210 22% 92%);
  --card: hsl(220 18% 8%);
  --card-foreground: hsl(210 22% 92%);
  --popover: hsl(220 18% 9%);
  --popover-foreground: hsl(210 22% 92%);
  --primary: hsl(188 92% 58%);
  --primary-foreground: hsl(220 30% 6%);
  --secondary: hsl(218 14% 13%);
  --secondary-foreground: hsl(210 22% 92%);
  --muted: hsl(218 14% 11%);
  --muted-foreground: hsl(214 12% 62%);
  --accent: hsl(190 55% 14%);
  --accent-foreground: hsl(188 92% 72%);
  --destructive: hsl(356 88% 62%);
  --success: hsl(152 58% 52%);
  --warning: hsl(38 92% 58%);
  --border: hsl(210 20% 100% / 0.1);
  --input: hsl(210 20% 100% / 0.16);
  --ring: hsl(188 92% 58%);

  --chart-1: hsl(188 92% 58%);
  --chart-2: hsl(36 80% 58%);
  --chart-3: hsl(205 80% 66%);
  --chart-4: hsl(170 60% 52%);
  --chart-5: hsl(214 12% 50%);

  --sim-bg: hsl(220 22% 6%);
  --sim-land: hsl(218 16% 10%);
  --sim-water: hsl(208 40% 11%);
  --sim-terrain: hsl(212 10% 24%);
  --sim-terrain-high: hsl(206 10% 46%);
  --sim-grid: hsl(210 20% 100% / 0.07);
  --sim-grid-strong: hsl(210 20% 100% / 0.18);
  --sim-ink: hsl(210 22% 92%);
  --sim-muted: hsl(214 12% 62%);
  --sim-signal: hsl(188 92% 58%);
  --sim-signal-2: hsl(36 80% 58%);
  --sim-neutral: hsl(214 10% 56%);
  --sim-coverage: hsl(188 92% 58% / 0.1);
  --sim-shadow-zone: hsl(0 0% 0% / 0.35);
  --sim-warning: hsl(38 92% 58%);
  --sim-alert: hsl(356 88% 62%);
  --sim-ok: hsl(152 58% 52%);
  --sim-sky: hsl(220 20% 8%);
  --sim-fog: hsl(214 12% 30%);

  --scope-bg: hsl(220 30% 3.5%);
  --scope-grid: hsl(188 60% 80% / 0.12);
  --scope-grid-strong: hsl(188 60% 80% / 0.26);
  --scope-trace: hsl(188 95% 60%);
  --scope-trace-2: hsl(36 80% 62%);
  --scope-blip: hsl(186 100% 76%);
  --scope-text: hsl(190 30% 92%);
  --scope-dim: hsl(200 14% 58%);
  --scope-clutter: hsl(200 12% 52%);
  --scope-warning: hsl(38 92% 60%);
  --scope-alert: hsl(356 90% 64%);
  --instrument-face: hsl(220 18% 5%);
  --instrument-bezel: hsl(218 10% 17%);
  --instrument-marking: hsl(40 20% 94%);
  --instrument-dim: hsl(214 10% 58%);
  --instrument-needle: hsl(40 30% 96%);
  --instrument-accent: hsl(188 95% 60%);
  --instrument-flag: hsl(356 88% 60%);

  --lobe-90: hsl(188 92% 58%);
  --lobe-150: hsl(36 80% 58%);

  --brass: hsl(36 80% 58%);
  --signal: hsl(188 92% 58%);
  --hud-line: hsl(205 30% 90% / 0.22);
  --hud-panel: hsl(220 22% 6% / 0.72);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-background text-foreground text-sm antialiased;
    font-feature-settings: "cv11", "ss01";
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  canvas:focus-visible {
    outline-offset: -2px;
  }
}

@layer utilities {
  /* HUD typography */
  .hud-title {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .hud-label {
    font-family: var(--font-mono);
    font-size: 10.5px;
    line-height: 14px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .hud-value {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }
  .hud-panel {
    background: var(--hud-panel);
    border: 1px solid var(--hud-line);
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
  }
  /* Film grain over the whole page (an SVG noise filter, no colour values). */
  .grain::after {
    content: "";
    position: fixed;
    inset: -50%;
    pointer-events: none;
    z-index: 60;
    opacity: 0.05;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    mix-blend-mode: overlay;
  }
  .prose-lab {
    font-size: var(--text-prose);
    line-height: var(--text-prose--line-height);
    color: var(--foreground);
    max-width: 68ch;
  }
  .prose-lab p + p {
    margin-top: 0.75rem;
  }
  .prose-lab ul {
    list-style: disc;
    padding-left: 1.25rem;
    margin-top: 0.5rem;
  }
  .prose-lab ol {
    list-style: decimal;
    padding-left: 1.25rem;
    margin-top: 0.5rem;
  }
  .prose-lab li + li {
    margin-top: 0.25rem;
  }
  .prose-lab h3 {
    font-weight: 600;
    font-size: 0.9375rem;
    margin-top: 1.25rem;
    margin-bottom: 0.25rem;
  }
  .prose-lab h4 {
    font-weight: 600;
    margin-top: 1rem;
  }
  .prose-lab code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--muted);
    border-radius: var(--radius-sm);
    padding: 0.05rem 0.3rem;
  }
  .prose-lab table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.75rem;
    font-size: var(--text-sm);
  }
  .prose-lab th,
  .prose-lab td {
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0.5rem;
    text-align: left;
    vertical-align: top;
  }
  .prose-lab th {
    font-weight: 600;
    color: var(--muted-foreground);
  }
  .prose-lab strong {
    color: var(--foreground);
    font-weight: 600;
  }
  .prose-lab a {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .formula {
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--foreground);
    background: color-mix(in oklab, var(--signal) 4%, transparent);
    border-left: 2px solid var(--brass);
    padding: 0.6rem 0.9rem;
    margin: 0.75rem 0;
    overflow-x: auto;
    white-space: pre;
  }
  .spec-sheet h3 {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 12px;
    font-weight: 400;
    color: var(--signal);
    margin-top: 1.75rem;
    margin-bottom: 0.4rem;
  }
  .spec-sheet h3:first-child {
    margin-top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`shadcn` settings for `components.json`: style `radix-nova`, base colour `neutral`, CSS
variables on, icon library `lucide`, CSS file `src/globals.css`, and aliases `@/components`,
`@/lib`, `@/hooks`, `@/components/ui`.

The fonts are npm packages (no Google Fonts request): `@fontsource-variable/inter-tight`,
`@fontsource-variable/jetbrains-mono` and `@fontsource/michroma`.

---

## 5. File: docs/SBAS_CONTENT.md

```markdown
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
```

---

## 6. Master prompt

Send this first, in a new Claude Code session in the `sbas-lab/` folder.

```
ROLE
You are a senior front-end engineer, a GNSS/SBAS simulation engineer and an
educational designer. Read CLAUDE.md, design.md, docs/SBAS_CONTENT.md and
docs/SBAS_Lab_Prompt_Pack.md first. design.md and src/globals.css are the
design system: follow them exactly and do not invent another look.

PRODUCT
"SBAS Lab": a ONE-PAGE interactive sandbox (route "/") that teaches general
learners how a Satellite-Based Augmentation System works and how air traffic
management uses it. It follows one flight, LAB201, gate to gate, between two
fictional airports in a fictional equatorial archipelago. The destination
has no ILS, so the flight lands with an RNP approach to LPV minima. Along the
way the page reveals the whole SBAS chain at the moment it matters, using
three world views (orbit, network, approach) under Flight Deck HUD chrome,
with glass panels, a twelve-phase timeline, guided stops, a "Break
something" panel and a debrief quiz. It looks and behaves like the Airspace
Sandbox of CNS Lab.

TECH STACK
React 19 + TypeScript + Vite, Tailwind v4 (@tailwindcss/vite), shadcn/ui
(radix, restyled per design.md), lucide-react icons, react-three-fiber +
drei + @react-three/postprocessing, Canvas/SVG, Web Audio, Zustand, MDX
(+ remark-gfm) for "Go deeper" drawers, Vitest (+ jsdom, Testing Library),
oxlint. Fonts from @fontsource. No backend. Static build for GitHub Pages
(base path from BASE_PATH).

ARCHITECTURE
src/
  core/        pure TS, unit tested, no DOM:
    units.ts       c, WGS-84, GPS L1/L5 frequencies, NM/ft/kt/m conversions
    geo.ts         geodetic <-> ECEF <-> local ENU, azimuth/elevation
    orbits.ts      simplified GPS constellation (6 planes, circular MEO,
                   ~55 deg inclination, ~11 h 58 min period) and GEO satellites
                   at fixed longitudes; positions as a function of time
    errors.ts      per-satellite error model: clock, ephemeris, ionosphere
                   (vertical delay x obliquity at a thin shell), troposphere,
                   multipath and noise; seeded
    iono.ts        ionospheric pierce points, the 5x5 deg IGP grid,
                   interpolation of vertical delay and GIVE, storm and
                   scintillation modifiers, equatorial anomaly shape
    groundSegment.ts reference stations measure, the master station estimates
                   fast/long-term corrections, UDRE, GIVE and "Do not use"
    messages.ts    SBAS message scheduler: 250-bit messages, one per second,
                   types MT0/1/2-5/6/7/9/10/12/17/18/24/25/26/63 with plain
                   names; time-outs; the time-to-alert path
    receiver.ts    pseudoranges, corrections, weighted least squares (ECEF +
                   clock), DOP, HPL/VPL from the weighted covariance with the
                   K factors, mode selection (LPV / LNAV/VNAV / LNAV / none),
                   FDE with GPS only
    approach.ts    FAS data block for the fictional runway, lateral and
                   vertical deviations, decision altitude, alert limits per
                   operation
    flight.ts      aircraft model (turn <= 3 deg/s, climb/descent limits);
                   the aircraft moves only through step functions
    guard.ts, random.ts (seeded), clock.ts
  journey/     phases.ts (fixed-tick state machine, TICK_S = 0.1 s, precomputed
               journey index for the timeline, jumps and stops), director.ts
               (view per phase, auto time-lapse speed, camera intents), drive.ts,
               narration.tsx, failures.ts, engine.ts (owns one world, one clock)
  hud/         HudFrame (CornerBrackets, TitleBlock, HudPanel), Telemetry
               (TelemetryRow, BarMeter, NeedleGauge), Controls (Dial,
               LeverSwitch, Segmented, HudButton), PhaseTimeline, MissionClock
  stage/       Stage, LazyStage, StagePoster, StageBoundary, CameraRig,
               StudioLights, StudioFloor, PenPlot, Callout3D, Wire3D, col()
  views/       OrbitView (3D), NetworkMap (2D canvas), ApproachView (3D)
  instruments/ CDI, ProtectionBars, SkyPlot, StanfordChart, MessageLog
  components/  SiteHeader, SiteFooter, ThemeToggle, Term, GlossarySheet,
               GoDeeper, Quiz, Debrief, RouteError, ui/ (shadcn)
  content/     glossary/*.json (lazy-loaded definitions), deeper/*.mdx
  hooks/       useThemeTokens, useSampled (~10 Hz), useSimClock,
               useSimulationLoop, useMediaQuery, useReducedMotion
  lib/         format.ts ("—" for NaN), lazyRetry.ts, color.ts, audio.ts
               (never throws; every sound posts a caption), utils.ts
  stores/      safeStorage + versioned, validated persisted store
tests/  core/*, journey/*, ui/*, fuzz.test.ts
scripts/ postbuild.mjs, budget.mjs, verify/page-e2e.mjs, verify/gpu-render.mjs

THE TWELVE PHASES (each: a view, a camera shot, narration, what the panels
show, and which SBAS idea it teaches)
 1 GATE        network view. Pre-flight LPV availability prediction and
               NOTAM check for the destination. Guided idea: "SBAS is a
               service you plan on."
 2 TAXI/TAKEOFF approach view at the departure airport. The receiver has a
               GPS-only fix; show truth versus GPS-only; errors in metres.
               STOP 1: first GPS-only fix.
 3 CLIMB       orbit view. Why four satellites; SkyPlot and DOP.
 4 ERRORS      orbit view, slow motion, world frozen. Break the range error
               of one satellite into clock, orbit, ionosphere, troposphere,
               multipath and noise as a stacked bar.
 5 REFERENCE   network view. Reference stations at known spots measure the
               same satellites; show one station's residuals.
 6 MASTER      network view. The master station computes corrections, the
               IGP grid lights up with vertical delays, and UDRE/GIVE appear.
 7 UPLINK      orbit view. Uplink station to GEO (dashed brass wire), with
               a labelled delay.
 8 BROADCAST   orbit view, slow motion. GEO to aircraft on L1; the message
               log fills (one message per second, type and plain meaning).
               STOP 2: the first correction arrives; the error dot jumps
               toward truth and the PL cylinder appears.
 9 CRUISE      approach/terrain view zoomed out, fast time-lapse. En route
               RNP with integrity; ADS-B NIC/NACp improve (a small panel shows
               what the controller's screen gains).
10 DESCENT     approach view. Loading the approach: FAS data block, the
               approach mode annunciator arms "LPV".
11 FINAL       approach view, slow time. HPL/VPL cylinder inside the HAL/VAL
               wireframe, CDI with vertical deviation, the Stanford chart
               collecting points. STOP 3: LPV engaged. Decision altitude.
12 LANDING     approach view. Touchdown, then STOP 4 and the DEBRIEF: what
               SBAS did on this flight (numbers from the engine), then the
               quiz.

BREAK SOMETHING (toggles, bound to the same store the engine reads; each has
a plain explanation, "what you should notice", and "what the crew and the
controller do")
- Satellite clock jump: the master station detects it and sends "Do not use"
  within the time to alert; show the countdown against the limit.
- GEO signal lost: corrections time out, PL grows, and the mode downgrades to
  LNAV; phraseology example for reporting loss of LPV.
- Ionospheric storm: GIVE grows, VPL > VAL, LPV unavailable over part of the
  map; the availability contour shrinks.
- Equatorial scintillation: satellites drop out, DOP grows.
- Reference station offline: the coverage edge moves.
- GPS jamming: no GNSS at all; fall back to conventional aids and radar
  vectors; ATC receives interference reports.
- SBAS off (GPS + FDE only): compare the protection levels.
The flight keeps its planned path whatever is broken; the page states this.

CONTROLS AND READOUTS
Play/pause, time-lapse speeds (1, 2, 4, 8, 16, 30, 60; auto by default),
guided stops on/off, view choice (auto/orbit/network/approach), camera
(follow, overview, zoom, reset), phase jump via the timeline, and approach
minima (LPV-200, LPV, LNAV/VNAV, LNAV). Readouts: satellites
tracked/used, HDOP/VDOP, horizontal and vertical error (the sim knows the
truth), HPL/VPL, HAL/VAL, mode, last message and age, GEO status.

QUALITY BARS
- Physics self-consistent: one world, one clock, fixed ticks; slow motion
  freezes the world; every view agrees with the engine.
- Every core function unit tested, including NaN/Infinity -> "no answer",
  sign conventions, and the claims the page makes (for example "VPL > VAL
  makes LPV unavailable", "a bad satellite is flagged within the time to
  alert", "SBAS reduces horizontal error in this scenario"). A fuzz test
  drives every control across its real range and fails on any NaN.
- Never invent a specification: every number has a source or
  TODO(expert-review); list them in docs/EXPERT_REVIEW.md.
- design.md followed exactly: tokens only, both themes, 390/768/1440 px,
  no sideways scroll, 40px touch targets, contrast >= 4.5:1, keyboard
  access to everything, role="img" + live text for every canvas/stage,
  reduced motion respected, honesty labels on every view.
- Performance budget from design.md §7 enforced by scripts/budget.mjs.

HOW TO WORK
Build in stages (section 7 of docs/SBAS_Lab_Prompt_Pack.md). In this session
build STAGE 0 ONLY, run every check in CLAUDE.md "Verify", fix what fails,
show screenshots, summarise, and stop.
```

---

## 7. Stage prompts

Send one per session. Each begins: *"Read CLAUDE.md, design.md and docs/SBAS_Lab_Prompt_Pack.md
(master prompt, section 6). Build Stage N, run every check in CLAUDE.md "Verify", fix what
fails, show screenshots at 1440/768/390 in dark and light, summarise, and stop."*

**Stage 0: Foundation and design kit.**
- Scaffold with Vite, Tailwind v4 and shadcn, with `src/globals.css` exactly as given.
- Restyle the shadcn/ui primitives, build the HUD kit, and build the Stage kit
  (`Stage` with bloom, noise and vignette, Lightformers, fog, DPR 1–2 and a
  PerformanceMonitor; `LazyStage` with `StagePoster`; `StageBoundary`; `CameraRig`;
  `PenPlot`; `Callout3D`; `Wire3D`).
- Add the header, the footer, the theme toggle (dark default, stored with `safeStorage`),
  `format.ts`, `lazyRetry`, `guard.ts`, the seeded random, the clock and
  `useSimulationLoop`.
- Add `postbuild.mjs`, `budget.mjs`, the GitHub Pages workflow and the service worker.
- Make a kit preview section on `/` that shows every HUD component and a demo stage with a
  pen-plotted terrain table. It is removed in Stage 3.
- Done when: tests pass, the budget passes, and the screenshots match design.md.

**Stage 1: SBAS core physics.**
- Build everything in `src/core` from the master prompt, with tests.
- Include a deterministic scenario test: a full LAB201 flight with and without SBAS.
  It must show a smaller error with SBAS, PL ≥ error on every tick (no misleading
  information in the nominal case), and LPV available on final in nominal conditions.
- Every failure mode must produce its documented effect.
- No UI in this stage.

**Stage 2: Journey engine.**
- Build `src/journey`: the phases, the fixed-tick state machine, the journey index, jumps,
  guided stops, the auto time-lapse, the director (view and camera per phase), narration
  text per phase, and failures bound to the store.
- Tests: jumping to phase N and playing to phase N give the same state; stops fire once;
  slow motion freezes the aircraft; resetting clears the timers.

**Stage 3: The page.**
- Build the chrome and panel layout at every breakpoint (design.md §4), and the three views:
  - OrbitView: procedural Earth shader, constellation, GEO, ionosphere shell, wires;
  - NetworkMap: 2D canvas with the IGP grid and the availability contour;
  - ApproachView: terrain table, runway lamps, final approach path, PL cylinders and AL
    wireframes.
- Build the instruments (CDI, ProtectionBars, SkyPlot, StanfordChart, MessageLog), the
  honesty labels and the scrims.
- Run gpu-render on every phase in both themes and look at every flagged PNG.

**Stage 4: Break something, stops and debrief.**
- Build the Break panel: every toggle with its explanation, what to notice and what the
  crew and the controller do.
- Add the guided-stop cards, then the debrief (this flight's numbers from the engine) and
  the 8-question quiz, with answers kept in `safeStorage`.
- Add the "Go deeper" MDX drawers (message types, error budget, PL equations, alert
  limits, time to alert, DFMC, systems of the world), the glossary JSON and the Glossary
  Sheet.

**Stage 5: Hardening and review.**
- Write `page-e2e.mjs`: every phase × width × theme, no sideways scroll, axe, keyboard
  reach, focus rings, reduced motion, and GPU memory over 20 view switches.
- Measure LCP and CLS on throttled mobile.
- Extend the fuzz test, and add recovery for a chunk failure (a Reload button) and for
  WebGL loss.
- Write `docs/EXPERT_REVIEW.md` from every TODO(expert-review), and a README.
- Push to main (do not watch the deploy).

---

## 8. Technical review checklist

Give this checklist and `docs/EXPERT_REVIEW.md` to a qualified GNSS/CNS engineer. The values
below are the ones the build must source. Claude must quote them from ICAO Annex 10 Vol I and
RTCA DO-229, or mark them for review.

| Topic | Verify |
|---|---|
| Signal | GPS L1 1575.42 MHz; SBAS GEO on L1 (and L5 1176.45 MHz for DFMC); 250 bit/s data, 500 symbols/s after FEC; a 250-bit message each second (preamble, 6-bit type, 212-bit data, 24-bit CRC) |
| Message types | MT0, 1, 2–5, 6, 7, 9, 10, 12, 17, 18, 24, 25, 26, 27/28, 63: their contents and time-outs |
| Ionosphere | Thin-shell height (350 km), the 5°×5° IGP grid at low and mid latitudes, interpolation, GIVE/GIVEI |
| Protection levels | HPL = K_H·d_major and VPL = K_V·d_V; K_H = 6.0 (PA) or 6.18 (NPA); K_V = 5.33; the σ terms (flt, UIRE, air, tropo) |
| Alert limits | LPV-200 (HAL 40 m, VAL 35 m); LPV / APV-I (HAL 40 m, VAL 50 m); LNAV/VNAV; LNAV; terminal; en route |
| Time to alert | Per operation, from Annex 10 Vol I Table 3.7.2.4-1 |
| Integrity risk | Per operation (for example 2×10⁻⁷ per approach for APV/Cat I) |
| Operations | RNP APCH with LPV, LP, LNAV/VNAV and LNAV minima; the FAS data block; SBAS CAT I status; PinS |
| ATM | ADS-B NIC/NACp with SBAS; NOTAM and prediction services; phraseology for loss of LPV and GNSS interference; fallbacks |
| Low latitude | How the equatorial anomaly, plasma bubbles and scintillation are described; the DFMC benefits and limits |
| Systems | Names and service areas of WAAS, EGNOS, MSAS, GAGAN, SDCM, KASS, BDSBAS and SouthPAN, from official sources only |

---

## 9. Pitfalls CNS Lab already hit

Paste these into the master prompt if you like. Each one cost a session in CNS Lab.

- **Real-GPU rendering.** Swiftshader screenshots looked fine while the stages were black
  on Apple GPUs. The cause was shader NaN: `smoothstep(0, fwidth(h), …)` when
  `fwidth == 0`, and `pow()` of a negative base.
  - Guard both, and run gpu-render on the real GPU.
  - Never change the DPR at runtime (a canvas resize flashes).
- **Tailwind v4.** Responsive variants of custom utilities (`md:hud-panel`) do not work.
  Write media-query-specific classes instead.
- **drei `Html` labels** need a stable `portal` element that mounts before the Canvas.
  Otherwise they remount and React warns.
- **Dark scopes in the light theme.** Text inside a `dark` class scope needs
  `text-foreground` set explicitly.
- **Metre-scale scenes.** drei `infiniteGrid` with a large `fadeDistance` loses float
  precision. Keep scene units sensible: scale the Earth view separately from the approach
  view.
- **Stale chunks.** Chromium caches a failed dynamic import until the page reloads. The
  recovery is a Reload button, not a retry loop.
- **Leaks.** Dispose every `useMemo` texture, geometry and material when it is replaced.
  Stop the previous looping sound before starting a new one. Clear the timers on reset.
- **Layout the user disliked.** Seven separate chapters that "jump between topics". Keep one
  continuous journey where the view changes because the story moves on.
