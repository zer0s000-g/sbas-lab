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
import { K_H_NPA, K_H_PA } from '@/core/receiver'
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
