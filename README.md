# SBAS Lab

A one-page interactive sandbox that teaches how a Satellite-Based Augmentation
System (SBAS) works and how air traffic management uses it. Follow flight
LAB201 from gate to gate and watch the whole SBAS chain: GPS satellites and
their errors, reference stations, the master station, the uplink, the GEO
broadcast, the aircraft receiver, protection levels and an LPV approach.

**Live site:** https://zer0s000-g.github.io/sbas-lab/

> For educational use only, not for operational use.

## Views

| URL | What it shows |
| --- | --- |
| `/` | **AirNav Indonesia**: Jakarta (WIII) to Bali (WADD) with a what-if Indonesian SBAS. The service, its ground sites and the procedure are hypothetical and labelled so on screen. |
| `/?scenario=essp` | **ESSP-SAS**: Toulouse (LFBO) to Nice (LFMN) with EGNOS, plus failure injection, service provision, a replayed real EGNOS signal, a real-day service-area map and an assessment with SCORM export. |
| `/?view=systems` | **SBAS worldwide**: every civil-aviation SBAS, its approximate service area and status. |

Both scenarios include a controller's (ATC) view. Add `?instructor` for the
instructor panel and `?seed=N` to fix the exam.

## Stack

React, TypeScript, Vite, Tailwind v4, shadcn/ui, react-three-fiber, Zustand,
MDX and Vitest. It's a static site with no backend.

## Getting started

Requires Node 24.

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (run once per scenario)
npm run build      # typecheck, build, bundle budget
npm run claims     # regenerate docs/EXPERT_REVIEW.md and docs/claims.csv
npm run scorm      # SCORM 1.2 package of the ESSP-SAS scenario
```

## Project layout

- `src/core`: simulation logic as pure, unit-tested TypeScript
- `src/scenarios`: scenario data (airports, ground sites, GEOs, route, narration)
- `src/journey`: the deterministic journey state machine
- `src/content/claims`: every fact shown on the page, with sources and review status
- `src/page`, `src/hud`, `src/stage`: views, UI kit and 3D stage
- `scripts/`: build, data and verification scripts
- `docs/`: teaching content, sources, expert review and third-party notices
- `design.md`: the design system (single source of design truth)

## Accuracy

Technical values follow ICAO Annex 10 Vol I and RTCA DO-229. Each claim
carries its sources and a review status. "ai-checked" means an AI model
checked it, not an expert sign-off. See
[docs/EXPERT_REVIEW.md](docs/EXPERT_REVIEW.md). This project is not
published or endorsed by ESSP, EUSPA or AirNav Indonesia.

## Deployment

Every push to `main` builds the site and deploys it to GitHub Pages
(`.github/workflows/deploy.yml`).

## Third-party notices

See [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md). The EGNOS recording is
licensed under EUPL v1.1, and the IGP tables come from RTKLIB (BSD 2-clause).
