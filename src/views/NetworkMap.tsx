import { useCallback, useRef } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import { localToGeodetic } from '@/core/geo'
import { GIVEI_NOT_MONITORED } from '@/core/iono'
import { MAG_EQUATOR_LAT_DEG, REGION, STATIONS } from '@/core/region'
import { approachMode, snapshot } from '@/core/sbasWorld'
import { OPERATIONS } from '@/core/operations'
import { withAlpha } from '@/lib/color'
import type { JourneyEngine } from '@/journey/engine'
import { terrainFtAt } from './islands'

const BOX = { lat0: -19, lat1: 14, lon0: 76, lon1: 109 }

/** LPV availability over the region (VPL ≤ VAL), on a coarse grid; slow, so cached per minute of world time. */
function useAvailability(e: JourneyEngine) {
  const cache = useRef<{ key: string; cells: { lat: number; lon: number; ok: boolean }[] } | null>(null)
  return () => {
    const key = `${Math.floor(e.worldS / 60)}|${JSON.stringify(e.state.failures)}|${e.state.times.geoLostS}`
    if (cache.current?.key === key) return cache.current.cells
    const cells: { lat: number; lon: number; ok: boolean }[] = []
    const c = e.conditions()
    for (let lat = BOX.lat0 + 1.5; lat < BOX.lat1; lat += 3)
      for (let lon = BOX.lon0 + 1.5; lon < BOX.lon1; lon += 3) {
        const s = snapshot(e.worldS, { latDeg: lat, lonDeg: lon, hM: 1000 }, c)
        cells.push({ lat, lon, ok: approachMode(s, OPERATIONS.apv1).mode === 'LPV' })
      }
    cache.current = { key, cells }
    return cells
  }
}

/**
 * The region map: SBAS reference stations, the master and uplink stations (made up for
 * this fictional region), the ionospheric grid points with their delays, the magnetic
 * equator, the LPV-availability area and LAB201. Map colours follow the theme.
 */
export function NetworkMap({ engine, label, className }: { engine: JourneyEngine; label: string; className?: string }) {
  const availability = useAvailability(engine)
  const draw = useCallback<DrawFn>(
    (ctx, { width, height, tokens: t }) => {
      const sx = width / (BOX.lon1 - BOX.lon0)
      const sy = height / (BOX.lat1 - BOX.lat0)
      const s = Math.min(sx, sy)
      const ox = (width - s * (BOX.lon1 - BOX.lon0)) / 2
      const oy = (height - s * (BOX.lat1 - BOX.lat0)) / 2
      const X = (lon: number) => ox + (lon - BOX.lon0) * s
      const Y = (lat: number) => oy + (BOX.lat1 - lat) * s
      ctx.fillStyle = t['sim-bg']
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = t['sim-water']
      ctx.fillRect(X(BOX.lon0), Y(BOX.lat1), s * (BOX.lon1 - BOX.lon0), s * (BOX.lat1 - BOX.lat0))
      // LPV availability.
      for (const c of availability()) {
        if (!c.ok) continue
        ctx.fillStyle = withAlpha(t['sim-coverage'], 0.55)
        ctx.fillRect(X(c.lon - 1.5), Y(c.lat + 1.5), 3 * s, 3 * s)
      }
      ctx.strokeStyle = t['sim-grid']
      ctx.lineWidth = 1
      ctx.font = `10px ${t.fontMono}`
      ctx.fillStyle = t['sim-muted']
      for (let lon = 80; lon <= 105; lon += 5) {
        ctx.beginPath()
        ctx.moveTo(X(lon), Y(BOX.lat1))
        ctx.lineTo(X(lon), Y(BOX.lat0))
        ctx.stroke()
        ctx.fillText(`${lon}°E`, X(lon) + 2, Y(BOX.lat0) - 3)
      }
      for (let lat = -15; lat <= 10; lat += 5) {
        ctx.beginPath()
        ctx.moveTo(X(BOX.lon0), Y(lat))
        ctx.lineTo(X(BOX.lon1), Y(lat))
        ctx.stroke()
        ctx.fillText(lat === 0 ? 'EQ' : `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`, X(BOX.lon0) + 2, Y(lat) - 2)
      }
      // Magnetic equator (model).
      ctx.strokeStyle = t['sim-signal-2']
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(X(BOX.lon0), Y(MAG_EQUATOR_LAT_DEG))
      ctx.lineTo(X(BOX.lon1), Y(MAG_EQUATOR_LAT_DEG))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = t['sim-signal-2']
      ctx.fillText('magnetic equator (model)', X(BOX.lon0) + 4, Y(MAG_EQUATOR_LAT_DEG) - 4)
      // The made-up islands.
      ctx.fillStyle = t['sim-land']
      for (let e = -56; e <= 58; e += 1)
        for (let n = -26; n <= 24; n += 1) {
          if (terrainFtAt(e, n) <= 0) continue
          const g = localToGeodetic(REGION, e, n, 0)
          ctx.fillRect(X(g.lonDeg), Y(g.latDeg), Math.max(1.5, s / 60), Math.max(1.5, s / 60))
        }
      const snap = engine.snapshot()
      const phase = engine.state.phase
      // Ionospheric grid points: circle size = vertical delay; a cross when not monitored.
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
        const r = Math.min(s * 1.6, 2 + igp.delayM * 1.1)
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
      // Pierce points measured by the stations (reference phase).
      if (phase === 'reference' || phase === 'master') {
        ctx.fillStyle = t['sim-signal']
        for (const o of snap.ground.ionoObs) ctx.fillRect(X(o.lonDeg) - 1, Y(o.latDeg) - 1, 2, 2)
      }
      const offline = new Set(engine.conditions().offlineStations)
      const master = STATIONS.find((st) => st.kind === 'master')!
      for (const st of STATIONS) {
        const x = X(st.pos.lonDeg)
        const y = Y(st.pos.latDeg)
        ctx.strokeStyle = t['sim-signal-2']
        ctx.fillStyle = t['sim-signal-2']
        ctx.lineWidth = 1.5
        if (phase === 'master' && st.kind === 'reference' && !offline.has(st.id)) {
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(X(master.pos.lonDeg), Y(master.pos.latDeg))
          ctx.stroke()
          ctx.setLineDash([])
        }
        ctx.beginPath()
        if (st.kind === 'reference') {
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x + 6, y + 5)
          ctx.lineTo(x - 6, y + 5)
          ctx.closePath()
        } else if (st.kind === 'master') ctx.rect(x - 5, y - 5, 10, 10)
        else ctx.arc(x, y, 5, Math.PI, 0)
        if (offline.has(st.id)) ctx.stroke()
        else ctx.fill()
        ctx.fillStyle = t['sim-ink']
        ctx.textAlign = 'left'
        if (st.kind !== 'uplink') ctx.fillText(offline.has(st.id) ? `${st.id} offline` : st.id, x + 8, y + 4)
      }
      // LAB201.
      const a = engine.aircraft
      const g = localToGeodetic(REGION, a.eastNm, a.northNm, 0)
      ctx.fillStyle = t['sim-ink']
      ctx.beginPath()
      ctx.arc(X(g.lonDeg), Y(g.latDeg), 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText('LAB201', X(g.lonDeg) + 7, Y(g.latDeg) + 14)
      // Legend (wide maps only; the phone map is too small for it).
      if (width < 520) return
      ctx.font = `10px ${t.fontMono}`
      const lx = X(BOX.lon0) + 8
      let ly = Y(BOX.lat0) - 64
      const legend: [string, string][] = [
        ['sim-signal', '○ grid point: size = vertical delay, m'],
        ['sim-muted', '× grid point not monitored'],
        ['sim-signal-2', '▲ reference  ■ master  ◠ uplink'],
        ['sim-coverage', '▦ LPV available'],
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
