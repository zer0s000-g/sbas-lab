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
const GOLDEN_CHANGES: { why: string; apply: (g: Golden) => void }[] = [
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
    for (const c of GOLDEN_CHANGES) c.apply(golden)
    expect(JSON.parse(JSON.stringify(now))).toEqual(golden)
  })
})
