import { useCallback, useRef } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import { localToGeodetic } from '@/core/geo'
import { GIVEI_NOT_MONITORED } from '@/core/iono'
import { GEO_SATS, geoLabel } from '@/core/orbits'
import { AIRPORT_LIST, dipEquatorLatDeg, MASTER, REGION, STATIONS } from '@/core/region'
import { ROUTE } from '@/core/flight'
import { approachMode, groundFor, snapshot } from '@/core/sbasWorld'
import { OPERATIONS } from '@/core/operations'
import { withAlpha } from '@/lib/color'
import type { JourneyEngine } from '@/journey/engine'
import { SCENARIO } from '@/scenarios/active'
import { decodeRings } from './geo/coast'

const MAP = SCENARIO.map
/**
 * The map box: the Indonesian archipelago and the magnetic equator north of it
 * (92–144°E, 16°S–12°N), or Europe from the Azores to Finland (28°W–36°E, 26–68°N).
 */
const BOX = MAP.box
/** A degree of longitude against one of latitude on the map (1 near the equator). */
const K = MAP.lonScale
/** Land outlines (Natural Earth 1:50m), decoded once. */
const LAND = decodeRings(MAP.land)
/** The LPV operation the tint shows: the one the scenario's approach is flown to. */
const LPV_OP = OPERATIONS[SCENARIO.approach.op]
const lonText = (lon: number) => (lon < 0 ? `${-lon}°W` : `${lon}°E`)
/** The route LAB201 flies, as latitude/longitude. */
const ROUTE_LL = ROUTE.map((w) => localToGeodetic(REGION, w.eastNm, w.northNm, 0))

/** LPV availability over the region (VPL ≤ VAL), on a coarse grid; slow, so cached per minute of world time. */
function useAvailability(e: JourneyEngine) {
  const cache = useRef<{ key: string; cells: { lat: number; lon: number; ok: boolean }[] } | null>(null)
  return () => {
    const key = `${Math.floor(e.worldS / 60)}|${JSON.stringify(e.state.failures)}|${e.state.times.geoLostS}`
    if (cache.current?.key === key) return cache.current.cells
    const cells: { lat: number; lon: number; ok: boolean }[] = []
    const c = e.conditions()
    // One ground solution serves every cell: the network sends the same messages to everyone.
    const ground = groundFor(e.worldS, c)
    const step = MAP.availabilityCellDeg
    for (let lat = BOX.lat0 + step / 2; lat < BOX.lat1; lat += step)
      for (let lon = BOX.lon0 + step / 2; lon < BOX.lon1; lon += step) {
        const s = snapshot(e.worldS, { latDeg: lat, lonDeg: lon, hM: 1000 }, c, ground)
        cells.push({ lat, lon, ok: approachMode(s, LPV_OP).mode === 'LPV' })
      }
    cache.current = { key, cells }
    return cells
  }
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
  const availability = useAvailability(engine)
  const draw = useCallback<DrawFn>(
    (ctx, { width, height, tokens: t }) => {
      const sx = width / ((BOX.lon1 - BOX.lon0) * K)
      const sy = height / (BOX.lat1 - BOX.lat0)
      const s = Math.min(sx, sy)
      const ox = (width - s * K * (BOX.lon1 - BOX.lon0)) / 2
      const oy = (height - s * (BOX.lat1 - BOX.lat0)) / 2
      const X = (lon: number) => ox + (lon - BOX.lon0) * s * K
      const Y = (lat: number) => oy + (BOX.lat1 - lat) * s
      const wide = width >= 520
      ctx.fillStyle = t['sim-bg']
      ctx.fillRect(0, 0, width, height)
      ctx.save()
      ctx.beginPath()
      ctx.rect(X(BOX.lon0), Y(BOX.lat1), s * K * (BOX.lon1 - BOX.lon0), s * (BOX.lat1 - BOX.lat0))
      ctx.clip()
      ctx.fillStyle = t['sim-water']
      ctx.fillRect(X(BOX.lon0), Y(BOX.lat1), s * K * (BOX.lon1 - BOX.lon0), s * (BOX.lat1 - BOX.lat0))
      // LPV availability, under the land so the coastline stays readable where it is available everywhere.
      ctx.fillStyle = withAlpha(t['sim-coverage'], 0.4)
      const half = MAP.availabilityCellDeg / 2
      for (const c of availability()) if (c.ok) ctx.fillRect(X(c.lon - half), Y(c.lat + half), 2 * half * s * K, 2 * half * s)
      // Land, with its coastline.
      ctx.beginPath()
      for (const r of LAND) {
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
      const snap = engine.snapshot()
      const phase = engine.state.phase
      // Ionospheric grid points: circle size = vertical delay; a cross when not monitored.
      ctx.lineWidth = 1
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
        ctx.fillStyle = withAlpha(t['sim-signal'], 0.25)
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
          // At the bottom edge, pointing south to the equator; labelled to the side of the arrow.
          const yb = Y(BOX.lat0) - 16
          ctx.fillStyle = t['sim-signal-2']
          ctx.beginPath()
          ctx.moveTo(x, yb + 7)
          ctx.lineTo(x + 5, yb)
          ctx.lineTo(x - 5, yb)
          ctx.closePath()
          ctx.fill()
          const west = lon < 0
          ctx.textAlign = west ? 'right' : 'left'
          ctx.fillText(`${geoLabel(g)} · ${lonText(lon)}`, west ? x - 8 : x + 8, yb + 6)
          ctx.textAlign = 'left'
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
    [engine, availability],
  )
  return <Canvas2D draw={draw} label={label} className={className} />
}
