import { useEffect, useMemo, useState } from 'react'
import { HudPanel } from '@/hud/HudFrame'
import { Segmented, HudButton } from '@/hud/Controls'
import { TelemetryRow } from '@/hud/Telemetry'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { decodeRings } from '@/views/geo/coast'
import { world } from '@/views/geo/world.data'
import { unpackLevel } from '@/core/serviceMap'
import { OPERATIONS } from '@/core/operations'
import { formatMetres } from '@/lib/format'
import { useSources } from '../sources/store'
import { availabilityAt, availableAt, loadServiceMap, SERVICE_MAP_OPS, utcLabel, type MapOp, type ServiceMap } from './serviceMapData'

/** The drawing: the map's box, east–west scaled by cos 47° as on the network map. */
const W = 300
const PAD = 4
const K = Math.cos((47 * Math.PI) / 180)

function frame(map: ServiceMap) {
  const { lat0, lat1, lon0, lon1, stepDeg } = map.spec
  const half = stepDeg / 2
  const box = { lon0: lon0 - half, lon1: lon1 + half, lat0: lat0 - half, lat1: lat1 + half }
  const sx = (W - 2 * PAD) / ((box.lon1 - box.lon0) * K)
  const H = Math.round(2 * PAD + (box.lat1 - box.lat0) * sx)
  const X = (lon: number) => PAD + (lon - box.lon0) * K * sx
  const Y = (lat: number) => PAD + (box.lat1 - lat) * sx
  // The world coastline: its rings are not clipped to a regional box, so no false edges cross the map.
  const outline = decodeRings(world)
    .map((r) => {
      let d = ''
      for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(r[i + 1]).toFixed(1)}`
      return `${d}Z`
    })
    .join('')
  return { H, X, Y, outline, cellW: stepDeg * K * sx, cellH: stepDeg * sx, half }
}

type View = 'day' | 'now'

/** Centimetres as metres with one decimal, without a "−0.0". */
const cm = (v: number) => {
  const m = Math.round(v / 10) / 10
  return (m === 0 ? 0 : m).toFixed(1)
}

/** A cell's class: the share of the day available (day view) or available now. */
function cellClass(share: number): string | null {
  if (share >= 0.99) return 'fill-success/55'
  if (share >= 0.9) return 'fill-success/25'
  return null
}

/**
 * The service-area map of a real day (30 September 2026): GPS orbits from the real
 * broadcast ephemeris and real EUREF stations, with EGNOS corrections from the page's
 * model on that real geometry until real EGNOS messages of the day are loaded
 * (scripts/data). Availability per operation over the day or at a chosen time, and the
 * real GPS-alone error at the stations.
 */
export function ServiceMapPanel({ index = '12' }: { index?: string }) {
  const [map, setMap] = useState<ServiceMap | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [op, setOp] = useState<MapOp>('cat1')
  const [view, setView] = useState<View>('day')
  const [epoch, setEpoch] = useState(72)
  const [stationId, setStationId] = useState('TLMF')
  const showSources = useSources((s) => s.show)

  useEffect(() => {
    let live = true
    setFailed(false)
    loadServiceMap().then(
      (m) => live && setMap(m),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [attempt])

  const f = useMemo(() => (map ? frame(map) : null), [map])
  const dayShare = useMemo(() => (map ? map.points.map((_, k) => availabilityAt(map, k, op)) : []), [map, op])

  if (failed)
    return (
      <HudPanel index={index} title="Service-area map">
        <p className="text-[13px] text-foreground">The map of the day could not be loaded.</p>
        <HudButton className="mt-2" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </HudButton>
      </HudPanel>
    )
  if (!map || !f)
    return (
      <HudPanel index={index} title="Service-area map">
        <Skeleton className="aspect-[3/2] w-full" />
        <p className="mt-2 text-[12px] text-muted-foreground">Loading a real day of GPS orbits and station data…</p>
      </HudPanel>
    )

  const share = (k: number) => (view === 'day' ? dayShare[k] : availableAt(map, k, epoch, op) ? 1 : 0)
  const covered = map.points.filter((_, k) => share(k) >= 0.99).length
  const station = map.stations.find((s) => s.id === stationId) ?? map.stations[0]
  const si = Math.min(station.tS.length - 1, Math.round((epoch * map.stepS) / (station.tS[1] - station.tS[0] || 300)))
  const hErr = station.hErrCm[si]
  const vErr = station.vErrCm[si]
  const hErrs = station.hErrCm.filter((v): v is number => v !== null).map(Math.abs).sort((a, b) => a - b)
  const h95 = hErrs.length ? hErrs[Math.floor(hErrs.length * 0.95)] / 100 : Number.NaN
  const hpl = unpackLevel(station.hplPa[si])
  const vpl = unpackLevel(station.vplPa[si])
  const opLabel = SERVICE_MAP_OPS.find((o) => o.id === op)!.label
  const o = OPERATIONS[op]
  const modelled = map.source === 'modelled'
  const timeText = view === 'day' ? 'over the day' : `at ${utcLabel(epoch * map.stepS)}`

  return (
    <HudPanel index={index} title="Service-area map">
      <p className="hud-label normal-case text-brass">
        Real GPS orbits and EUREF stations · {map.day} · {modelled ? 'EGNOS corrections modelled' : 'real EGNOS messages'}
      </p>
      <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
        {modelled
          ? 'The satellites and the station measurements are real. The EGNOS corrections are the page’s model run on that real geometry, with the EGNOS reference sites ESSP names; real EGNOS messages of the day replace them when they are loaded.'
          : 'Satellites, station measurements and EGNOS messages are all real recordings of the day.'}{' '}
        <button type="button" className="hud-label normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources(['servicemap.real-day', 'servicemap.method', 'servicemap.rims-network', 'servicemap.egnos-real'])}>
          Sources
        </button>
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Segmented label="Operation" value={op} onChange={setOp} options={SERVICE_MAP_OPS.map((x) => ({ value: x.id, label: x.label, ariaLabel: `Show ${x.label} availability` }))} />
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'Whole day', ariaLabel: 'Show the share of the day available' },
            { value: 'now', label: 'At a time', ariaLabel: 'Show availability at the chosen time' },
          ]}
        />
        {view === 'now' && (
          <div className="flex flex-col gap-1.5">
            <span id="sm-time" className="hud-label">
              Time · <span className="hud-value text-foreground">{utcLabel(epoch * map.stepS)}</span>
            </span>
            <Slider aria-labelledby="sm-time" aria-valuetext={utcLabel(epoch * map.stepS)} min={0} max={map.epochs - 1} step={1} value={[epoch]} onValueChange={(v) => setEpoch(v[0])} className="py-3" />
          </div>
        )}
      </div>

      <div className="dark mt-2 rounded-[4px] border border-hud-line bg-scope-bg p-1">
        <svg
          viewBox={`0 0 ${W} ${f.H}`}
          className="w-full"
          role="img"
          aria-label={`${opLabel} availability ${timeText} over Europe, ${map.day}: ${covered} of ${map.points.length} map points available ${view === 'day' ? 'at least 99 % of the day' : ''}. Station ${station.name}: real GPS-alone horizontal error ${formatMetres(h95)} 95 % of the day.`}
        >
          <defs>
            <pattern id="sm-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" className="stroke-destructive/60" strokeWidth="1" />
            </pattern>
          </defs>
          {map.points.map((p, k) => {
            const s = share(k)
            const cls = cellClass(s)
            const x = f.X(p.lonDeg - f.half)
            const y = f.Y(p.latDeg + f.half)
            return cls ? <rect key={k} x={x} y={y} width={f.cellW + 0.2} height={f.cellH + 0.2} className={cls} /> : <rect key={k} x={x} y={y} width={f.cellW + 0.2} height={f.cellH + 0.2} fill="url(#sm-hatch)" />
          })}
          <path d={f.outline} className="fill-none stroke-foreground/60" strokeWidth={0.6} fillRule="evenodd" />
          {map.rims.map((r) => (
            <path key={r.id} d={`M${f.X(r.lonDeg)} ${f.Y(r.latDeg) - 2.2}l2 3.6h-4z`} className="fill-brass" />
          ))}
          {map.stations.map((s) => (
            <circle key={s.id} cx={f.X(s.lonDeg)} cy={f.Y(s.latDeg)} r={s.id === station.id ? 3.2 : 2} className={s.id === station.id ? 'fill-signal stroke-foreground' : 'fill-none stroke-signal'} strokeWidth={s.id === station.id ? 0.8 : 1} />
          ))}
        </svg>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] leading-4 text-muted-foreground" aria-label="Legend">
        <li>
          <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-success/55 align-middle" aria-hidden />
          {view === 'day' ? 'available ≥ 99 % of the day' : 'available'}
        </li>
        {view === 'day' && (
          <li>
            <span className="mr-1 inline-block size-2.5 rounded-[1px] bg-success/25 align-middle" aria-hidden />
            90–99 %
          </li>
        )}
        <li>
          <span className="mr-1 inline-block size-2.5 rounded-[1px] border border-destructive/60 align-middle" aria-hidden />
          hatched: {view === 'day' ? 'below 90 %' : 'not available'}
        </li>
        <li>▲ EGNOS RIMS (city level)</li>
        <li>○ EUREF station</li>
      </ul>
      <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">
        {opLabel}: HPL within {formatMetres(o.halM)}
        {o.valM !== null ? ` and VPL within ${formatMetres(o.valM)}` : ''}. A 2° grid, every 10 minutes; one GEO assumed received everywhere.
      </p>

      <h3 className="hud-label mt-3 text-foreground">At a station</h3>
      <div className="mt-1">
        <Select value={station.id} onValueChange={setStationId}>
          <SelectTrigger aria-label="EUREF station" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {map.stations.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.id} · {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TelemetryRow label={`GPS alone, real error ${view === 'now' ? utcLabel(station.tS[si]) : 'at midday'}`} value={hErr === null || vErr === null ? 'no fix' : `H ${cm(hErr)} · V ${cm(vErr)}`} unit="m" tone="muted" />
      <TelemetryRow label="GPS alone, horizontal error 95 % of the day" value={formatMetres(h95)} tone="muted" />
      <TelemetryRow label={`EGNOS ${modelled ? '(modelled) ' : ''}HPL / VPL`} value={hpl === null || vpl === null ? 'no solution' : `${formatMetres(hpl)} / ${formatMetres(vpl)}`} tone="signal" />
      <p className="mt-2 text-[11.5px] leading-4 text-muted-foreground">
        GPS data: BKG GNSS Data Center (IGS broadcast ephemeris) and the EUREF Permanent Network (CC BY 4.0). Errors are a single-frequency GPS-alone fix computed by SBAS Lab from the stations’ real pseudoranges, against each station’s position in its file (metre-accurate at some stations).
      </p>
    </HudPanel>
  )
}

export default ServiceMapPanel
