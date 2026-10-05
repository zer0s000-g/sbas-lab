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
  **The flight view is the exception: it is the real world.** It shows the sea, Java,
  Madura and Bali (real coastline, procedural terrain with the main volcanoes), both
  airports and the sky at the journey's own local time (daylight at the 08:00 WIB
  departure from Jakarta, a lit night airport on the evening flight), the same in both
  themes. A learner must always recognise where LAB201 is: at the gate, on a taxiway,
  over the Java Sea, above Java, on final to runway 09 at Bali.
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

  All numbers use tabular figures. Fonts are woff2, latin plus the Greek letters the
  lessons use (`src/fonts.css`); Inter Tight latin is preloaded.
- **Motion teaches.**
  - The camera moves between shots, and pen-plot edges reveal the space-view miniatures.
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
| World (flight view) | `--world-sky-zenith --world-sky-horizon --world-sky-night-zenith --world-sky-night-horizon --world-sky-dusk --world-sun --world-sea-deep --world-sea-shallow --world-foam --world-sand --world-grass --world-forest --world-rock --world-asphalt --world-concrete --world-marking --world-taxi-line --world-building --world-glazing --world-roof --world-cloud --world-cloud-shade` | The flight view's scenery, the same in both themes. Day and night skies blend with the sun's elevation (`core/sun`). Only for scenery |
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
| `space` | A procedural Earth shader (no textures): day and night side, a 15° graticule, the model magnetic equator in brass. Around it: the GPS constellation and its orbit rings, two GEO satellites, the ionosphere shell and the ground-station dots. Signals go to LAB201: a solid cyan wire from each GPS satellite it tracks, a dashed brass wire from each GEO. | Climb, errors, the uplink and the broadcast |
| `network` | A 2D map of Indonesia (theme-following `--sim-*` colours, Natural Earth 1:50m land): the hypothetical ground segment at illustrative sites (16 RIMS, the primary and backup master control centres, two uplink stations, the links to the master), where QZS-3 and QZS-6 stand above the equator, the route from Jakarta to Bali, the ionospheric grid (IGPs, circle size = vertical delay, × = not monitored), the model magnetic equator and a live LPV-availability area | Reference stations, master station, the storm |
| `flight` | LAB201 at true scale (1 unit = 100 m) in a real-looking world at the journey's local time: sky and sun, the sea with shallows and surf, Java, Madura and Bali (`views/terrain.ts`: real coastline, coastal plain, forest, volcano rock; a coarse corridor along the route and a fine patch at each airport), both airports (`views/airports.ts`: Jakarta with runways 07R and 07L, Bali with runway 09; runways with Annex 14 markings and numbers, taxiways along LAB201's own ground track with yellow centrelines, apron, terminal with piers and jet bridges, parked airliners, tower, hangars; runway, threshold, end, taxiway and approach lights and a working PAPI) and fair-weather cumulus below cruise level. Around the aircraft: its HPL/VPL cylinder and the HAL/VAL wireframe of the current operation (Doc 9849 Table 2-1). Signal rays point the true way to each tracked satellite. Truth is a cross, GPS alone a hollow ring and SBAS a filled dot. **Cameras show the place:** the gate and landing shots look along the apron at the aircraft, the terminal and the runway; the follow shot is a low chase on the ground rising to a high chase over the sea; the zoom shot frames the protection cylinder on final with the runway ahead; Overview in the air backs out to the whole alert-limit ring. | Gate, takeoff, cruise, descent, final, landing |

A **sky-plot inset** sits on every view, top right. It shows satellites by azimuth and
elevation: used = filled, tracked = hollow, lost or excluded = crossed, GEO = diamond.
There is one WebGL canvas: the space and flight scenes swap inside it, and the network map
covers it while the stage pauses. The camera snaps when the scale changes and eases within a view.

**Chrome:**
- **Scenario tabs** under the top bar: "AirNav Indonesia" and "ESSP-SAS", each a link
  (a scenario is a page load of its own), the active one with a cyan underline and
  `aria-current="page"`, and on the right "SBAS worldwide" (§11). 40 px tall; the hint
  ("Toulouse → Nice · EGNOS") shows from 1024 px; at 390 px the bar scrolls sideways inside
  itself rather than truncating a tab.
- **Sources** button in the top bar (both scenarios): a Sheet with every claim the scenario
  makes, its sources and its review status (icon and words, never colour alone): Reviewed
  (green shield, a named person), Checked by AI (cyan bot icon, with the model's verdict and
  reason and the words "not a human sign-off"), Sourced, To confirm (brass).
- **Top bar:** the SBAS LAB wordmark and the phase name, plus a badge. Before the descent the
  badge says what LAB201 navigates with (GPS ALONE / SBAS). From the descent it is the
  approach mode annunciator (LPV ARMED, LPV, LNAV/VNAV, LNAV, NO APPR). Then the journey
  clock, play/pause and the theme toggle.
- **Bottom of the view:** the honesty label and the view choice (Auto, Space, Flight,
  Map). Then the camera buttons (follow, overview, zoom, reset) and the twelve-phase
  `PhaseTimeline` (click to jump; ←/→, Home, End). At 390 px the timeline sits under the
  view in two rows of six, so every tick is a 40 px target.
- **Panels at 1440 and 1024 px:** two glass columns over the view (340 px wide, or 300 px
  below 1440).
  - Left column: the flight card, and "What's happening" (narration for the phase, with its
    Doc 9849 sources). It also shows the phase's detail: the error breakdown, station counts,
    the master-station summary, the message layout, the FAS data block with its CRC, or the
    decision height.
  - Right column:
    - "SBAS in this phase": the operation's HAL/VAL and time to alert, and GPS alone next to
      SBAS (plus L1 only on the descent and final);
    - SBAS status;
    - the cockpit (CDI and ProtectionBars);
    - Signals (message log and Stanford chart);
    - Time (time-lapse, guided stops, fly again);
    - "Break something" (Stage 4).
- **At 768 px:** the panels move below the view in two columns.
- **Controller's view** (both scenarios, left column; its own tab "ATC" at 390 px): an
  approach scope on the dark `--scope-*` tokens (range rings 10/20/30 NM, the final course
  dashed, the runway in foreground). Arrivals by shape: square = SBAS avionics, circle = GPS
  only, diamond = no GNSS approach; data block (callsign, flight level, what it can fly) to
  the right of the track; red only for an aircraft that cannot fly its planned GNSS
  approach. Below: the instruction buttons and the radiotelephony, marked right or not.
  Where a scenario has no Break panel, a Segmented control chooses the outage.
- **At 390 px:** the view is a 56svh sticky strip, and the panels sit below it in tabs
  (Now, Cockpit, Signals, ATC, and EGNOS in the ESSP-SAS scenario).
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
- Reduced motion: the camera snaps, and signal pulses become static wires. The settings
  menu offers "Same as device", "Reduce motion" and "Full motion"; the choice is set on
  `<html data-motion>` so CSS transitions follow it too.
- Audio is not wired in yet (`src/lib/audio.ts`); the sound switches return to the settings
  menu with it.

## 6. Honesty labels

Every view says what is not to scale:
- space: "Earth and orbits to scale · satellites drawn far larger than life · time ×N"
  (or "world frozen");
- flight: "Coast, runways and aircraft to scale · terrain and route simplified · signal
  directions true, distances not · errors ×10";
- network: "Map of Indonesia to scale · ground sites illustrative · hypothetical Indonesian
  SBAS".

Story device: until the first correction arrives (end of the broadcast phase) the page
shows LAB201 navigating with GPS alone, and says that a real SBAS receiver uses SBAS from
the gate. The DFMC service belongs to the hypothetical Indonesian SBAS, and the page says that real DFMC
services are planned, not yet operating (Doc 9849 §4.3.4.5).

Slow-motion moments show "Slowed down so you can see it" and freeze the world. The flight
card and the footer say what is real (airports, Michibiki satellites) and what is
hypothetical (the SBAS service, its ground sites, the route and the LPV procedure;
Indonesia has no operational SBAS today). The Break panel says the
flight keeps its planned path whatever is broken, and the page shows what the crew and the
controller would do.

## 7. Performance and assets

**Lightest asset first.**
- Everything visual is CSS, inline SVG or geometry built in code. The Earth is a shader or
  procedural geometry, not a texture file; its continents are an alpha mask drawn at
  runtime from coastline data. Coastlines are Natural Earth land polygons, clipped,
  simplified and stored as small integer arrays (`src/views/geo/*.data.ts`, built by
  `scripts/geo/build-coast.mjs`; about 16 kB gzip in all).
- There are no image, model or HDR files in the app. The only raster files are the app
  icons and a small social card.
- The space view is lit with light-formers baked once into a prefiltered environment map
  (`StudioLights`; no drei `Environment`, which ships HDR/EXR loaders). The flight view brings its own sun
  (direction from `core/sun`), sky and fog (`Stage scenery="world"`: no studio lights,
  bloom only on lamps and the sun, light grain).
- The flight world is all code: a sky shader, a sea shader reading small height maps of
  the terrain (`DataTexture`s built from `views/terrain`), vertex-coloured terrain,
  instanced trees and cloud puffs, merged airport geometry, lamps as screen-sized
  points. The only textures are tiny canvas runway numbers and alpha masks.
- Ground layers (apron, taxiways, runway, markings, the aircraft's shadow) sit a few
  centimetres above the levelled airfield and are drawn in a fixed order without writing
  depth, so they never fight each other. The flight camera's near plane follows its
  distance to the aircraft (`Shot.nearFrac`). Shader detail (waves, surf) fades out
  before it gets smaller than a pixel, so nothing shimmers. Uses small `CanvasTexture`s only.

**Code splitting.**
- three.js, drei and postprocessing live in their own chunk. `LazyStage` loads it after
  the page has loaded and the browser is idle, and shows a same-size `StagePoster` until
  then.
- Each view scene is lazy (`lazyRetry`, never `React.lazy` directly). The camera shots
  (`views/shots`, which read the terrain and the flight's track) load with the 3D chunk
  through `page/JourneyScene`, and the network map and its coastline load when the page
  is idle.
- Coastline data is the bulk of a scenario: a scenario holds loaders for it
  (`map.land`, `globeDetail`, `terrain.coast`), so only the active scenario's coastlines
  are downloaded, and only with the views that draw them (`views/geo/scenarioCoast`).
  No top-level `await` in app code: it splits the shared code into many small chunks.
- The Stage's Canvas subtree is memoised: the page's 10 Hz readouts never re-render the
  scene. 4× MSAA is used only at a pixel ratio below 1.5.
- Nothing costly runs on the main thread when a view mounts: scenery data is built once
  per session at module scope.

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

## 10. The ESSP-SAS scenario

The same page, journey, views and kit, with EGNOS over southern France
(`?scenario=essp`). What differs:

- **World.** The flight view shows southern France from Toulouse to Nice (Natural Earth
  1:10m coast, an inland plain at about 150 m, a few summits as cones); the network map
  shows Europe (1:50m, east–west scaled by cos 47°, legend over the Atlantic, the GEOs as
  arrows at the southern edge because the equator is off the map); the globe draws Europe in detail.
- **Panels** (one lazy chunk, only in this scenario): left column 08 Break something and
  11 Assessment; right column 09 Service provision and 10 Real EGNOS signal (its recording
  is a chunk of its own); on phones a fourth tab, "EGNOS".
- **Honesty labels.** Network: "Map of Europe · EGNOS sites named in public sources, at
  city level, not all of them · uplink pairing illustrative". Replay: "Recorded EGNOS
  broadcast · PRN 124 · 29 March 2011 …", real data, not the simulated world nor today's
  EGNOS. Proposed NOTAMs: illustrative wording. The footer says the page is not published
  or endorsed by ESSP or EUSPA.
- **Colour.** The forecast chart uses `--success` for available and a hatched
  `--destructive` for not available, with a text legend; nothing new.
- **Service-area map** (12): a scope-dark SVG of Europe (world coastline, east–west scaled by
  cos 47°) with 2° cells: `--success` at two strengths (≥ 99 % / 90–99 % of the day, or
  available now) and a hatched `--destructive` line pattern below that; RIMS as brass
  triangles, EUREF stations as cyan rings (the chosen one filled). Controls: operation and
  "whole day / at a time" Segmenteds, a time Slider (aria-valuetext "hh:mm UTC"), a station
  Select. Honesty label in brass: "Real GPS orbits and EUREF stations · <day> · EGNOS
  corrections modelled" until real messages are loaded.
- **Instructor** (`?instructor`, top of the left column): seed Input, copy-link button,
  file Input for a learner's session, and the debrief (failures with response times, a
  timeline with right calls in `--success` and wrong ones in `--destructive`, with words).
- **Assessment additions:** "Curriculum mapping" (a details block, CSV download) and
  "Export my session" in the Result tab.

## 11. SBAS worldwide (`?view=systems`)

A page of its own on the same site, no 3D stage (light: one lazy chunk), civil aviation only.
- **01 Service areas:** an equirectangular world map on `--sim-water` / `--sim-land`; every
  service area a dashed hairline in `--sim-ink`, the chosen one filled `--signal` at 25 %
  with a 1.6 px outline; its GEOs as brass diamonds on the dashed equator (filled =
  operational, hollow = test or planned). No text on the map: names live in the list beside
  it (≥ 1024 px, buttons with `aria-pressed`) or a Select under it. Label: "Areas
  approximate, drawn from each provider's wording, not official maps".
- **02 System card:** status (icon + words: green square operational, brass diamond in
  development, hollow square test), headline, provider, services with years ("planned
  2028"), GEOs, ground counts ("not published" when no source gives one), DFMC, and its
  Sources.
- **03 How SBAS works, end to end:** seven fixed steps (GPS satellites → reference stations
  → master stations → uplink → GEO → aircraft → approach), a row of seven at ≥ 1024 px and a
  column below. The lit step has the signal outline and glow; a pulse travels the link to
  the next step (cyan for GPS signals, brass dashed for the correction path), 3.2 s a step,
  with Prev / Play-Pause / Next and ←/→. Reduced motion: no autoplay, no pulses, the same
  steps by button. Each step shows the chosen system's figure.
- **04 Side by side:** a Table from 768 px; one card per system below.
- Footer: the systems page's own note (not endorsed by any provider, ICAO or EUROCONTROL).
