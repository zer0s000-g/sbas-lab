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
