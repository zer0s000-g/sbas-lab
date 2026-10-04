import { use, useCallback, useRef } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { localToGeodetic } from '@/core/geo'
import type { GroundSnapshot } from '@/core/groundSegment'
import { GIVEI_NOT_MONITORED } from '@/core/iono'
import { GEO_SATS, geoLabel } from '@/core/orbits'
import { AIRPORT_LIST, dipEquatorLatDeg, MASTER, REGION, STATIONS } from '@/core/region'
import { ROUTE } from '@/core/flight'
import { approachMode, groundFor, snapshot, type Conditions } from '@/core/sbasWorld'
import { OPERATIONS } from '@/core/operations'
import { withAlpha } from '@/lib/color'
import type { JourneyEngine } from '@/journey/engine'
import { SCENARIO } from '@/scenarios/active'
import { decodeRings, type Ring } from './geo/coast'
import { mapLand } from './geo/scenarioCoast'

const MAP = SCENARIO.map
/**
 * The map box: the Indonesian archipelago and the magnetic equator north of it
 * (92–144°E, 16°S–12°N), or Europe from the Azores to Finland (28°W–36°E, 26–68°N).
 */
const BOX = MAP.box
/** A degree of longitude against one of latitude on the map (1 near the equator). */
const K = MAP.lonScale
/** Land outlines (Natural Earth 1:50m), loaded with the map and decoded once (read with `use`). */
let landRings: Promise<Ring[]> | null = null
const loadLand = () => (landRings ??= mapLand().then(decodeRings, (error: unknown) => {
  landRings = null // the map's error boundary offers a retry
  throw error
}))
/** The LPV operation the tint shows: the one the scenario's approach is flown to. */
const LPV_OP = OPERATIONS[SCENARIO.approach.op]
const lonText = (lon: number) => (lon < 0 ? `${-lon}°W` : `${lon}°E`)
/** The route LAB201 flies, as latitude/longitude. */
const ROUTE_LL = ROUTE.map((w) => localToGeodetic(REGION, w.eastNm, w.northNm, 0))

/** The coarse availability grid: one cell every `availabilityCellDeg` (the scenario's), south-west first. */
const CELL_DEG = MAP.availabilityCellDeg
export const AVAILABILITY_CELLS: readonly { lat: number; lon: number }[] = (() => {
  const cells: { lat: number; lon: number }[] = []
  for (let lat = BOX.lat0 + CELL_DEG / 2; lat < BOX.lat1; lat += CELL_DEG) for (let lon = BOX.lon0 + CELL_DEG / 2; lon < BOX.lon1; lon += CELL_DEG) cells.push({ lat, lon })
  return cells
})()

/** The grid is worked out for one minute of world time at a time. */
const AVAILABILITY_STEP_S = 60

/**
 * LPV availability over the region (VPL ≤ VAL) on the coarse grid. A whole grid is a few
 * hundred receiver solutions, too slow for one frame on a phone, so it is worked out a
 * few cells per frame, within a time budget, while the map keeps showing the last
 * complete grid. A new grid starts each minute of world time and whenever a failure
 * changes. The result depends only on its key (the minute and the failures with their
 * times), never on how the work was split.
 */
export class AvailabilityGrid {
  /** LPV available in each cell of AVAILABILITY_CELLS, from the last complete grid (null until the first). */
  ok: readonly boolean[] | null = null
  /** Goes up each time `ok` is replaced. */
  version = 0
  /** The key of `ok`. */
  key = ''
  private job: { key: string; failuresKey: string; tS: number; c: Conditions; ground: GroundSnapshot | null; ok: boolean[] } | null = null
  private seenState: unknown = null
  private failuresKey = ''

  /** Work on the grid for the engine's current minute for about `budgetMs`. */
  step(e: JourneyEngine, budgetMs = 4, clock: () => number = () => performance.now()) {
    const t0 = clock()
    const st = e.state
    if (st !== this.seenState) {
      this.seenState = st
      // Every failure time (the clock jump's start and satellite too), not just the GEO loss.
      this.failuresKey = `${JSON.stringify(st.failures)}|${JSON.stringify(st.times)}`
    }
    const minute = Math.floor(e.worldS / AVAILABILITY_STEP_S)
    const key = `${minute}|${this.failuresKey}`
    // A grid for an earlier minute is finished (so the map keeps up at any time-lapse);
    // a grid for failures that no longer apply is dropped.
    if (!this.job || this.job.failuresKey !== this.failuresKey) {
      if (!this.job && key === this.key) return
      this.job = { key, failuresKey: this.failuresKey, tS: gridTime(minute, st.times), c: e.conditions(), ground: null, ok: [] }
    }
    const job = this.job
    if (!job.ground) {
      // One ground solution serves every cell: the network sends the same messages to everyone.
      job.ground = groundFor(job.tS, job.c)
      if (clock() - t0 >= budgetMs) return
    }
    while (job.ok.length < AVAILABILITY_CELLS.length) {
      const cell = AVAILABILITY_CELLS[job.ok.length]
      const snap = snapshot(job.tS, { latDeg: cell.lat, lonDeg: cell.lon, hM: 1000 }, job.c, job.ground)
      job.ok.push(approachMode(snap, LPV_OP).mode === 'LPV')
      if (clock() - t0 >= budgetMs) break
    }
    if (job.ok.length < AVAILABILITY_CELLS.length) return
    this.ok = job.ok
    this.key = job.key
    this.version++
    this.job = null
  }
}

/**
 * The world time a grid is worked out for: the start of its minute, or a failure that
 * started during that minute (so a clock jump or a GEO loss shows at once). A function
 * of the grid's key only.
 */
function gridTime(minute: number, times: object): number {
  const start = minute * AVAILABILITY_STEP_S
  let t = start
  for (const v of Object.values(times)) if (typeof v === 'number' && v >= start && v < start + AVAILABILITY_STEP_S) t = Math.max(t, v)
  return t
}

/** One grid per journey, kept while the map is closed so that reopening it shows one at once. */
const grids = new WeakMap<JourneyEngine, AvailabilityGrid>()
function gridFor(e: JourneyEngine): AvailabilityGrid {
  let g = grids.get(e)
  if (!g) grids.set(e, (g = new AvailabilityGrid()))
  return g
}

/** Map geometry for a canvas size: the box, scaled to fit and centred (a degree of longitude is K of latitude's). */
function mapFrame(width: number, height: number) {
  const s = Math.min(width / ((BOX.lon1 - BOX.lon0) * K), height / (BOX.lat1 - BOX.lat0))
  const ox = (width - s * K * (BOX.lon1 - BOX.lon0)) / 2
  const oy = (height - s * (BOX.lat1 - BOX.lat0)) / 2
  return { s, X: (lon: number) => ox + (lon - BOX.lon0) * s * K, Y: (lat: number) => oy + (BOX.lat1 - lat) * s }
}

/** Clip to the map box. */
function clipBox(ctx: CanvasRenderingContext2D, { s, X, Y }: ReturnType<typeof mapFrame>) {
  ctx.beginPath()
  ctx.rect(X(BOX.lon0), Y(BOX.lat1), s * K * (BOX.lon1 - BOX.lon0), s * (BOX.lat1 - BOX.lat0))
  ctx.clip()
}

/**
 * The parts of the map that never move: land with its coastline, the graticule and the
 * magnetic equator. Drawn inside the box clip, on a transparent layer that goes over
 * the availability tint.
 */
function drawStatic(ctx: CanvasRenderingContext2D, f: ReturnType<typeof mapFrame>, t: ThemeTokens, land: readonly Ring[]) {
  const { X, Y } = f
  clipBox(ctx, f)
  // Land, with its coastline.
  ctx.beginPath()
  for (const r of land) {
    for (let i = 0; i < r.length; i += 2) {
      if (i === 0) ctx.moveTo(X(r[i]), Y(r[i + 1]))
      else ctx.lineTo(X(r[i]), Y(r[i + 1]))
    }
    ctx.closePath()
  }
  ctx.fillStyle = withAlpha(t['sim-terrain'], 0.55)
  ctx.fill('evenodd')
  ctx.strokeStyle = t['sim-grid-strong']
  ctx.lineWidth = 1
  ctx.stroke()
  // Graticule (every 10° of longitude and 5° of latitude over Indonesia), from the box.
  ctx.strokeStyle = t['sim-grid']
  ctx.font = `10px ${t.fontMono}`
  ctx.fillStyle = t['sim-muted']
  for (let lon = Math.ceil(BOX.lon0 / MAP.lonStep) * MAP.lonStep; lon <= BOX.lon1; lon += MAP.lonStep) {
    ctx.beginPath()
    ctx.moveTo(X(lon), Y(BOX.lat1))
    ctx.lineTo(X(lon), Y(BOX.lat0))
    ctx.stroke()
    ctx.fillText(lonText(lon), X(lon) + 2, Y(BOX.lat0) - 3)
  }
  for (let lat = Math.ceil(BOX.lat0 / MAP.latStep) * MAP.latStep; lat <= BOX.lat1; lat += MAP.latStep) {
    ctx.beginPath()
    ctx.moveTo(X(BOX.lon0), Y(lat))
    ctx.lineTo(X(BOX.lon1), Y(lat))
    ctx.stroke()
    ctx.fillText(lat === 0 ? 'EQ' : `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`, X(BOX.lon0) + 2, Y(lat) - 2)
  }
  // Magnetic equator (model).
  ctx.strokeStyle = t['sim-signal-2']
  ctx.lineWidth = 1.2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  for (let lon = BOX.lon0; lon <= BOX.lon1; lon += 1) {
    if (lon === BOX.lon0) ctx.moveTo(X(lon), Y(dipEquatorLatDeg(lon)))
    else ctx.lineTo(X(lon), Y(dipEquatorLatDeg(lon)))
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = t['sim-signal-2']
  ctx.fillText('magnetic equator (model)', X(BOX.lon0) + 4, Y(dipEquatorLatDeg(BOX.lon0)) - 5)
}

/**
 * The network map of the scenario's region: the SBAS ground segment (RIMS reference
 * stations, the primary and backup master control centres, the uplink stations and the
 * links between them; hypothetical, at illustrative sites, in Indonesia; the EGNOS sites
 * named in public sources, in Europe), where the GEOs stand above the equator, the
 * ionospheric grid points with their delays, the magnetic equator, the LPV-availability
 * area, LAB201's route and LAB201. Map colours follow the theme.
 */
export function NetworkMap({ engine, label, className }: { engine: JourneyEngine; label: string; className?: string }) {
  const land = use(loadLand())
  const grid = gridFor(engine)
  /** The never-moving layer, kept until the size, the pixel ratio, the theme or the fonts change. */
  const layer = useRef<{ key: unknown[]; canvas: HTMLCanvasElement } | null>(null)
  // The map changes with the world tick, the journey state (phase, failures) and a newly
  // finished availability grid: it redraws then, not every frame.
  const frameKey = useCallback(() => {
    grid.step(engine)
    return [engine.tick, engine.state, grid.version]
  }, [engine, grid])
  const draw = useCallback<DrawFn>(
    (ctx, { width, height, dpr, tokens: t, fontEpoch }) => {
      const f = mapFrame(width, height)
      const { s, X, Y } = f
      const wide = width >= 520
      ctx.fillStyle = t['sim-bg']
      ctx.fillRect(0, 0, width, height)
      ctx.save()
      clipBox(ctx, f)
      ctx.fillStyle = t['sim-water']
      ctx.fillRect(X(BOX.lon0), Y(BOX.lat1), s * K * (BOX.lon1 - BOX.lon0), s * (BOX.lat1 - BOX.lat0))
      // LPV availability, under the land so the coastline stays readable where it is available everywhere.
      ctx.fillStyle = withAlpha(t['sim-coverage'], 0.4)
      if (grid.ok)
        grid.ok.forEach((ok, i) => {
          const c = AVAILABILITY_CELLS[i]
          if (ok) ctx.fillRect(X(c.lon - CELL_DEG / 2), Y(c.lat + CELL_DEG / 2), CELL_DEG * s * K, CELL_DEG * s)
        })
      // Land, graticule and magnetic equator from their layer, pixel for pixel.
      const cw = ctx.canvas.width
      const ch = ctx.canvas.height
      const key = [width, height, cw, ch, dpr, t, fontEpoch]
      if (!layer.current || layer.current.key.some((v, i) => !Object.is(v, key[i]))) {
        const canvas = layer.current?.canvas ?? document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const lc = canvas.getContext('2d')
        if (lc) {
          lc.setTransform(dpr, 0, 0, dpr, 0, 0)
          drawStatic(lc, f, t, land)
        }
        layer.current = { key, canvas }
      }
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(layer.current.canvas, 0, 0)
      ctx.restore()
      ctx.font = `10px ${t.fontMono}`
      const snap = engine.snapshot()
      const phase = engine.state.phase
      // Ionospheric grid points: circle size = vertical delay; a cross when not monitored.
      ctx.lineWidth = 1
      const igpFill = withAlpha(t['sim-signal'], 0.25)
      for (const igp of snap.ground.gridList) {
        const x = X(igp.lonDeg)
        const y = Y(igp.latDeg)
        if (igp.givei >= GIVEI_NOT_MONITORED) {
          ctx.strokeStyle = t['sim-muted']
          ctx.beginPath()
          ctx.moveTo(x - 3, y - 3)
          ctx.lineTo(x + 3, y + 3)
          ctx.moveTo(x + 3, y - 3)
          ctx.lineTo(x - 3, y + 3)
          ctx.stroke()
          continue
        }
        const r = Math.min(s * 1.6, 2 + igp.delayM * 0.6)
        ctx.fillStyle = igpFill
        ctx.strokeStyle = t['sim-signal']
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        if (phase === 'master' && s > 14) {
          ctx.fillStyle = t['sim-ink']
          ctx.textAlign = 'center'
          ctx.fillText(`${igp.delayM.toFixed(1)}`, x, y - r - 3)
          ctx.textAlign = 'left'
        }
      }
      // Pierce points measured by the RIMS (reference phase).
      if (phase === 'reference' || phase === 'master') {
        ctx.fillStyle = t['sim-signal']
        for (const o of snap.ground.ionoObs) ctx.fillRect(X(o.lonDeg) - 1, Y(o.latDeg) - 1, 2, 2)
      }
      // LAB201's route.
      ctx.strokeStyle = t['sim-ink']
      ctx.lineWidth = 1.2
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ROUTE_LL.forEach((g, i) => (i === 0 ? ctx.moveTo(X(g.lonDeg), Y(g.latDeg)) : ctx.lineTo(X(g.lonDeg), Y(g.latDeg))))
      ctx.stroke()
      ctx.setLineDash([])
      for (const ap of AIRPORT_LIST) {
        ctx.fillStyle = t['sim-ink']
        ctx.fillRect(X(ap.threshold.lonDeg) - 2, Y(ap.threshold.latDeg) - 2, 4, 4)
        if (wide) {
          ctx.textAlign = 'right'
          ctx.fillText(ap.id, X(ap.threshold.lonDeg) - 6, Y(ap.threshold.latDeg) + 14)
          ctx.textAlign = 'left'
        }
      }
      // The terrestrial network: every RIMS reports to the master control centre, which
      // shares its work with the backup and sends the messages to the uplink stations.
      const offline = new Set(engine.conditions().offlineStations)
      const links = phase === 'reference' || phase === 'master'
      ctx.strokeStyle = withAlpha(t['sim-signal-2'], links ? 0.9 : 0.35)
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (const st of STATIONS) {
        if (st.id === MASTER.id || (st.kind === 'rims' && offline.has(st.id))) continue
        ctx.moveTo(X(st.pos.lonDeg), Y(st.pos.latDeg))
        ctx.lineTo(X(MASTER.pos.lonDeg), Y(MASTER.pos.latDeg))
      }
      ctx.stroke()
      ctx.setLineDash([])
      // Where the GEOs stand: above the equator at their longitude (an arrow when off the map;
      // at the bottom edge, pointing south, when the equator is south of the map).
      ctx.font = `10px ${t.fontMono}`
      const equatorShown = BOX.lat0 < 0 && BOX.lat1 > 0
      for (const g of GEO_SATS) {
        const lon = g.lonDeg ?? 0
        const inside = lon >= BOX.lon0 && lon <= BOX.lon1
        const x = X(Math.min(Math.max(lon, BOX.lon0 + 0.6), BOX.lon1 - 0.6))
        if (!equatorShown && inside) {
          // At the bottom edge, pointing south to the equator, above the longitude labels;
          // labelled to the side of the arrow, on a plate so it reads over the grid. A narrow
          // map shows only the PRN (the arrow stands at the longitude), kept inside the map.
          const yb = Y(BOX.lat0) - 20
          ctx.fillStyle = t['sim-signal-2']
          ctx.beginPath()
          ctx.moveTo(x, yb + 7)
          ctx.lineTo(x + 5, yb)
          ctx.lineTo(x - 5, yb)
          ctx.closePath()
          ctx.fill()
          const text = wide || !g.prn ? `${geoLabel(g)} · ${lonText(lon)}` : `PRN ${g.prn}`
          const w = ctx.measureText(text).width
          const left = X(BOX.lon0) + 2
          const right = X(BOX.lon1) - 2
          // West of the arrow for a western GEO, east for an eastern one, unless that runs off the map.
          let tx = lon < 0 ? x - 8 - w : x + 8
          if (tx < left) tx = x + 8
          if (tx + w > right) tx = Math.max(left, x - 8 - w)
          ctx.fillStyle = withAlpha(t['sim-bg'], 0.8)
          ctx.fillRect(tx - 2, yb - 4, w + 4, 13)
          ctx.fillStyle = t['sim-signal-2']
          ctx.fillText(text, tx, yb + 6)
          continue
        }
        const y = Y(0)
        ctx.fillStyle = t['sim-signal-2']
        ctx.beginPath()
        if (inside) {
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x + 5, y)
          ctx.lineTo(x, y + 6)
          ctx.lineTo(x - 5, y)
        } else {
          const d = lon < BOX.lon0 ? -1 : 1
          ctx.moveTo(x + d * 6, y)
          ctx.lineTo(x - d * 2, y - 5)
          ctx.lineTo(x - d * 2, y + 5)
        }
        ctx.closePath()
        ctx.fill()
        // Labelled clear of the station labels: below the diamond, or above the arrow at the map edge.
        const text = `${geoLabel(g)}${inside ? '' : ` (${lonText(lon)})`}`
        ctx.textAlign = !inside && lon < BOX.lon0 ? 'left' : 'center'
        ctx.fillText(text, !inside && lon < BOX.lon0 ? x + 8 : x, inside ? y + 18 : y - 10)
        ctx.textAlign = 'left'
      }
      // Ground sites.
      for (const st of STATIONS) {
        const x = X(st.pos.lonDeg)
        const y = Y(st.pos.latDeg)
        const off = offline.has(st.id)
        ctx.strokeStyle = t['sim-signal-2']
        ctx.fillStyle = t['sim-signal-2']
        ctx.lineWidth = 1.5
        ctx.beginPath()
        if (st.kind === 'rims') {
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x + 6, y + 5)
          ctx.lineTo(x - 6, y + 5)
          ctx.closePath()
        } else if (st.kind === 'mcc') ctx.rect(x - 5, y - 5, 10, 10)
        else ctx.arc(x, y + 3, 6, Math.PI, 0)
        if (off || (st.kind === 'mcc' && st.role === 'backup')) ctx.stroke()
        else ctx.fill()
        ctx.fillStyle = t['sim-ink']
        if (st.kind === 'rims' && (wide || off)) ctx.fillText(off ? `${st.code} offline` : st.code, x + 8, y + 4)
        if (st.kind === 'mcc' && wide) {
          // To the left, clear of the RIMS label at the same city (or to the right where the left is busy).
          const right = st.labelSide === 'right'
          ctx.textAlign = right ? 'left' : 'right'
          ctx.fillText(st.role === 'backup' ? 'MCC (backup)' : 'MCC', right ? x + 8 : x - 8, y - 6)
          ctx.textAlign = 'left'
        }
      }
      // LAB201.
      const a = engine.aircraft
      const g = localToGeodetic(REGION, a.eastNm, a.northNm, 0)
      ctx.fillStyle = t['sim-ink']
      ctx.beginPath()
      ctx.arc(X(g.lonDeg), Y(g.latDeg), 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText('LAB201', X(g.lonDeg) + 7, Y(g.latDeg) - 10)
      ctx.restore()
      // Legend (wide maps only; the phone map is too small for it).
      if (!wide) return
      ctx.font = `10px ${t.fontMono}`
      const lx = X(BOX.lon0) + 40
      let ly = MAP.legendCorner === 'top-left' ? Y(BOX.lat1) + 18 : Y(BOX.lat0) - 77
      const legend: [string, string][] = [
        ['sim-signal', '○ grid point: size = vertical delay'],
        ['sim-muted', '× grid point not monitored'],
        ['sim-signal-2', SCENARIO.texts.stationsLegend],
        ['sim-signal-2', equatorShown ? '◆ GEO above the equator' : '▼ GEO, far south above the equator'],
        ['sim-signal', SCENARIO.texts.availabilityLegend],
        ['sim-ink', SCENARIO.texts.routeLegend],
      ]
      for (const [tok, text] of legend) {
        ctx.fillStyle = t[tok as 'sim-signal']
        ctx.fillText(text, lx, ly)
        ly += 13
      }
    },
    [engine, grid, land],
  )
  return <Canvas2D draw={draw} frameKey={frameKey} label={label} className={className} />
}
