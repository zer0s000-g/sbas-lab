/**
 * The AirNav Indonesia scenario stays as it was. This test recomputes what the page
 * shows in every phase (the route, the journey index, the view model and its text
 * alternatives, the airport layouts, the terrain, the ground segment's solution) and
 * compares it with a golden record made from the code before the scenarios were split
 * (commit c68ba71). Run with GOLDEN_WRITE=<path> to write a new record instead.
 *
 * Changes made on purpose after that commit are listed in GOLDEN_CHANGES and applied to
 * the record before comparing, so every difference is either listed there or a bug.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as region from '@/core/region'
import { ROUTE } from '@/core/flight'
import { GEO_SATS } from '@/core/orbits'
import { groundFor, NOMINAL } from '@/core/sbasWorld'
import { JourneyEngine } from '@/journey/engine'
import { journeyIndex, PHASES } from '@/journey/phases'
import { NARRATION } from '@/journey/narration'
import { FAILURES } from '@/journey/failures'
import { describe as describeView, viewModel } from '@/page/model'
import { AIRPORTS } from '@/views/airports'
import { terrainFtAt } from '@/views/terrain'
import { OPERATIONS } from '@/core/operations'
import { K_H_NPA, K_H_PA, PBIAS } from '@/core/receiver'
import { lateralFullScaleM } from '@/core/approach'
import { formatMetres } from '@/lib/format'

const round = (v: unknown): unknown => {
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toPrecision(12)) : String(v)
  if (Array.isArray(v)) return v.map(round)
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [k, round(x)])
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]))
  return v
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(round(v))).digest('hex')

function record() {
  const idx = journeyIndex()
  const e = new JourneyEngine({ guidedStops: false, running: false })
  const phases: Record<string, unknown> = {}
  for (const p of PHASES) {
    e.jumpTo(p.id)
    const m = viewModel(e)
    phases[p.id] = {
      model: round(m),
      text: (['space', 'flight', 'network'] as const).map((v) => describeView(m, v)),
    }
  }
  const terrain: number[] = []
  for (let e0 = -320; e0 <= 320; e0 += 7.3) for (let n0 = -130; n0 <= 130; n0 += 6.1) terrain.push(terrainFtAt(e0, n0))
  return {
    region: hash([region.REGION, region.DEPARTURE, region.DESTINATION, region.STATIONS, region.START_LOCAL_HOUR, region.HYPOTHETICAL]),
    zone: [0, 3600, 7200, 9000].map((t) => [region.zoneTime(t, 110), region.zoneTime(t, 116)]),
    geos: hash(GEO_SATS),
    route: hash(ROUTE),
    index: { startTick: idx.startTick, touchdownTick: idx.touchdownTick, endTick: idx.endTick, states: hash(idx.states.filter((_, i) => i % 250 === 0)) },
    ground: hash(groundFor(1800, NOMINAL)),
    phases,
    narration: hash(NARRATION),
    failures: hash(FAILURES.map(({ id, label, explain, notice, crewAtc, source }) => ({ id, label, explain, notice, crewAtc, source }))),
    airports: hash(AIRPORTS),
    terrain: hash(terrain),
  }
}

/**
 * Deliberate changes since the golden record, each with its reason. They rewrite the
 * recorded values they affect before the comparison.
 */
type Golden = ReturnType<typeof record> & { phases: Record<string, { model: Record<string, unknown>; text: string[] }> }
// `now` is the fresh record, for a change whose new values are checked by a rule rather than copied.
const GOLDEN_CHANGES: { why: string; apply: (g: Golden, now: Golden) => void }[] = [
  {
    why: 'Departure has its own row in Annex 10 Vol I Table 3.7.2.4-1 (with initial, intermediate and non-precision approach): HAL 0.3 NM, 10 s; the takeoff phase used the terminal row.',
    apply: (g) => {
      const op = OPERATIONS.departure
      g.phases.takeoff.model.op = round({ id: op.id, name: op.name, halM: op.halM, valM: op.valM, ttaS: op.ttaS, source: op.source })
      g.phases.takeoff.text = g.phases.takeoff.text.map((t) => t.replace(/Terminal limits HAL [^,]+,/, `Departure limits HAL ${formatMetres(op.halM)},`))
    },
  },
  {
    why: 'The uplink panel showed the L1 message layout (8-bit preamble, 212 data bits) while the signal was DFMC on L5 (4-bit preamble, 216 data bits, ED-259); the detail now names the signal.',
    apply: (g) => {
      g.phases.uplink.model.detail = { kind: 'uplink', signal: g.phases.uplink.model.signal }
    },
  },
  {
    why: 'The text alternatives repeated the full stop after the view lead ("over Indonesia.. LAB201").',
    apply: (g) => {
      for (const p of Object.values(g.phases)) p.text = p.text.map((t) => t.replaceAll('.. ', '. '))
    },
  },
  {
    why: 'DFMC en route, terminal and LNAV used the precision K factor (K_H,PA 6.0) where the L1 path used K_H,NPA 6.18; the non-precision fix (dfmcNpa, navigated with outside the final approach) now uses K_H,NPA, so its HPL is 3 % larger (checked to 1e-9; the recorded values are rounded).',
    apply: (g, now) => {
      type F = { hplM: number; mode: string } | null
      // The recorded HPL times K_H,NPA/K_H,PA: the fresh value when it agrees, else the scaled one (and the test fails).
      const scaled = (h: number, fresh: number | undefined) => {
        const want = (h * K_H_NPA) / K_H_PA
        return fresh !== undefined && Math.abs(fresh - want) <= 1e-9 * want ? fresh : want
      }
      for (const [id, p] of Object.entries(g.phases)) {
        const m = p.model as { dfmc: F; sbas: F; nav: F; service: string; dfmcNpa?: unknown }
        const n = now.phases[id].model as { dfmcNpa: F; sbas: F; nav: F }
        const before = m.sbas?.hplM
        m.dfmcNpa = m.dfmc ? { ...m.dfmc, hplM: scaled(m.dfmc.hplM, n.dfmcNpa?.hplM) } : null
        if (m.service === 'dfmc' && m.sbas) m.sbas = { ...m.sbas, hplM: scaled(m.sbas.hplM, n.sbas?.hplM) }
        if (id !== 'final' && m.nav?.mode === 'dfmc' && before !== undefined && m.nav.hplM === before) {
          const hpl = scaled(m.nav.hplM, n.nav?.hplM)
          p.text = p.text.map((t) => t.replace(`Using SBAS: HPL ${formatMetres(m.nav!.hplM)},`, `Using SBAS: HPL ${formatMetres(hpl)},`))
          m.nav = { ...m.nav, hplM: hpl }
        }
      }
    },
  },
  {
    why: 'Each correction records the UDREI broadcast before a "Do not use" (udreiBeforeAlarm), so the aircraft keeps a faulty satellite until the alarm reaches it. Without that field the nominal ground solution hashes as before.',
    apply: (g) => void (g.ground = '12c76050344f4f5837d1246403a99f0d42d0ee82f0361034809f9231bda90df5'),
  },
  {
    why: 'The cruise narration said "At FL330" while LAB201 is still climbing ("Climbing to FL330"); the clock-jump notice promised a countdown the page does not show (the message log shows the alarm).',
    apply: (g) => {
      g.narration = '9201b2ec0d97bdb5210cfc93c9d8c4c50d2c4bf6d97d4c590be339030b51f29c'
      g.failures = '49420e08567e952875c0539ef4110792c5e494e7eb72dda5f514e490585cc2a0'
    },
  },
  {
    why: 'Taxiway edge lights restarted their 60 m spacing on every segment of a taxi route (a pair about every 12 m along LAB201\'s tracks); the spacing now runs along the whole route.',
    apply: (g) => void (g.airports = 'ed3f51e99768a995518cb7d9245361095e7e5eed60a188284a509b7bb407df2e'),
  },
  // The AI check of the claims registry (src/content/claims/aiChecks.ts), October 2026.
  {
    why: 'sbas.raim: the RAIM protection-level factors are now √λ for a missed-detection probability of 1e-3 (7.51 … 8.92 for 1–10 degrees of freedom; the old 5.4 … 7.2 gave 0.08–0.16), so the GPS-alone HPL grows by the ratio of the two at its degrees of freedom: +30 % with the 8 satellites LAB201 tracks (8.20/6.3). Rule: recorded HPL × new/old factor (checked to 1e-9).',
    apply: (g, now) => {
      const OLD = [0, 5.4, 5.8, 6.1, 6.3, 6.5, 6.7, 6.8, 7.0, 7.1, 7.2]
      type F = { hplM: number | string; used: string[]; mode: string } | null
      for (const [id, p] of Object.entries(g.phases)) {
        const m = p.model as { abas: F; nav: F }
        const fresh = (now.phases[id].model as { abas: F }).abas?.hplM
        if (!m.abas || typeof m.abas.hplM !== 'number') continue
        const before = m.abas.hplM
        const dof = Math.min(Math.max(m.abas.used.length - 4, 1), OLD.length - 1)
        const want = (before * PBIAS[dof]) / OLD[dof]
        const hpl = typeof fresh === 'number' && Math.abs(fresh - want) <= 1e-9 * want ? fresh : want
        m.abas = { ...m.abas, hplM: hpl }
        if (m.nav?.mode === 'abas' && m.nav.hplM === before) {
          m.nav = { ...m.nav, hplM: hpl }
          p.text = p.text.map((t) => t.replace(`Using GPS alone: HPL ${formatMetres(before)}.`, `Using GPS alone: HPL ${formatMetres(hpl)}.`))
        }
      }
    },
  },
  {
    why: 'sbas.abas-iono-sigma: the broadcast-model ionospheric σ is now Annex 10 App B 3.5.5.6.3.2 (max of T_iono/5 and F_pp·τ_vert, τ_vert by pierce-point latitude). Over Indonesia every pierce point LAB201 uses is within 20° of the equator and the T_iono/5 floor does not bind, so τ_vert stays 9 m and nothing recorded changes (no rewrite).',
    apply: () => {},
  },
  {
    why: 'iono.dip-equator: the magnetic equator is now IGRF-14 (2025.0), 2.5–3.3° further south over Indonesia than the map-read table, so the equatorial bands and every L1 ionospheric delay move. Changed: the GPS-alone and L1 SBAS position errors (by at most about 2 m), the L1 SBAS (PA) protection levels (by at most about 25 %), the ionospheric part of the error breakdown and the ground solution. Rule: those numbers only, each within those bounds, are taken from the fresh record; DFMC (ionosphere-free), the geometry, the GPS-alone HPL, the modes and every text stay as recorded.',
    apply: (g, now) => {
      g.ground = 'e72421082b59e75d78b9dbd15774eebabeb1479d267c1cd2a4184ed5720db7cf'
      type Fix = Record<string, unknown> | null
      const ERR = ['horizontalErrorM', 'verticalErrorM'] as const
      // A fresh number within `ok` of the recorded one replaces it; otherwise the record keeps its value and the test fails.
      const take = (rec: Record<string, unknown>, fresh: Record<string, unknown>, key: string, ok: (a: number, b: number) => boolean) => {
        const a = rec[key]
        const b = fresh[key]
        if (typeof a === 'number' && typeof b === 'number' && ok(a, b)) rec[key] = b
      }
      const metres = (a: number, b: number) => Math.abs(a - b) <= 2.5
      const share = (a: number, b: number) => Math.abs(a - b) <= 0.3 * Math.abs(a)
      const errors = (rec: Fix, fresh: Fix) => {
        if (!rec || !fresh) return
        const e = rec.errorEnu as number[]
        const f = fresh.errorEnu as number[]
        rec.errorEnu = e.map((v, i) => (metres(v, f[i]) ? f[i] : v))
        for (const k of ERR) take(rec, fresh, k, metres)
      }
      for (const [id, p] of Object.entries(g.phases)) {
        const m = p.model as { abas: Fix; nav: Fix; l1Pa: Fix; detail?: { kind: string; parts?: { name: string; m: number }[] } }
        const n = now.phases[id].model as typeof m
        m.abas = m.abas && { ...m.abas }
        errors(m.abas, n.abas)
        if (m.nav?.mode === 'abas') {
          m.nav = { ...m.nav }
          errors(m.nav, n.nav)
        }
        m.l1Pa = m.l1Pa && { ...m.l1Pa }
        errors(m.l1Pa, n.l1Pa)
        if (m.l1Pa && n.l1Pa) for (const k of ['hplM', 'vplM']) take(m.l1Pa, n.l1Pa, k, share)
        if (m.detail?.kind === 'errors' && m.detail.parts && n.detail?.parts) {
          m.detail.parts = m.detail.parts.map((x, i) => (x.name === 'Ionosphere' && metres(x.m, n.detail!.parts![i].m) ? { ...x, m: n.detail!.parts![i].m } : x))
        }
      }
    },
  },
  {
    why: 'sbas.lpv-deviations: the LPV lateral full scale now widens at the constant angle the course width subtends at the azimuth reference point (305 m beyond the far end of the runway), not linearly at tan 2°/2 from the threshold; at 5 NM out on final it is about 1.5 times wider. Rule: recorded cross-track over the new full scale (checked to 1e-9).',
    apply: (g, now) => {
      for (const [id, p] of Object.entries(g.phases)) {
        const d = p.model.dev as { alongTrackM: number; crossTrackM: number; lateralFs: number } | null | undefined
        if (!d) continue
        const want = Math.max(-1, Math.min(1, d.crossTrackM / lateralFullScaleM(105, d.alongTrackM)))
        const fresh = (now.phases[id].model.dev as { lateralFs: number } | null)?.lateralFs
        p.model.dev = { ...d, lateralFs: fresh !== undefined && Math.abs(fresh - want) <= 1e-9 * Math.max(Math.abs(want), 1e-12) ? fresh : want }
      }
    },
  },
  {
    why: 'iono.storm: the storm failure no longer says the ionosphere gets "thicker" (a storm can lower the electron content as well as raise it); it says the delay changes fast and unevenly over a wide area.',
    apply: (g) => void (g.failures = 'c926214afde04f965224225a1dcf30c901c2a7834ee5262f86af2ce52795984f'),
  },
  // The validation of October 2026 (reference documents in docs/SBAS_Reference_Docs).
  {
    why: 'The view model says whether LAB201 is on the ground from the aircraft (onGround), not from altitude above sea level < 100 ft: over the Bali threshold, airborne at about 100 ft, the text said "on the ground". Rule: onGround is the fresh flag; a text that said "on the ground" while the fresh flag is false is taken from the fresh record, and every other text stays as recorded.',
    apply: (g, now) => {
      for (const [id, p] of Object.entries(g.phases)) {
        const fresh = now.phases[id]
        const onGround = fresh.model.onGround as boolean
        p.model.onGround = onGround
        if (!onGround) p.text = p.text.map((t, i) => (t.includes('LAB201 on the ground') ? fresh.text[i] : t))
      }
    },
  },
  {
    why: 'The descent applied the non-precision approach limits (HAL 556 m) from the top of descent at FL330. EGNOS SoL SDD v3.6 Table 7 (Annex 10 Table 3.7.2.4-1) gives that row to the initial and intermediate approach; the descent now goes en route, terminal on the arrival, then the approach row from the IF. Rule: at the start of the descent (top of descent) the operation is continental en route and the texts name its HAL.',
    apply: (g) => {
      const op = OPERATIONS.enroute
      const d = g.phases.descent
      d.model.op = round({ id: op.id, name: op.name, halM: op.halM, valM: op.valM, ttaS: op.ttaS, source: op.source })
      d.text = d.text.map((t) => t.replace(/Non-precision approach \(LNAV\) limits HAL [^,]+,/, `${op.name} limits HAL ${formatMetres(op.halM)},`))
    },
  },
]

describe('the AirNav Indonesia scenario is unchanged', () => {
  it('matches the golden record of the original code, apart from the listed deliberate changes', () => {
    const now = record()
    const out = process.env.GOLDEN_WRITE
    if (out) {
      writeFileSync(out, JSON.stringify(now, null, 1))
      return
    }
    const golden = JSON.parse(readFileSync(join(import.meta.dirname, 'indonesia.golden.json'), 'utf8')) as Golden
    for (const c of GOLDEN_CHANGES) c.apply(golden, JSON.parse(JSON.stringify(now)) as Golden)
    expect(JSON.parse(JSON.stringify(now))).toEqual(golden)
  })
})
