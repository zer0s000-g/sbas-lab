import { useMemo } from 'react'
import { HudPanel } from '@/hud/HudFrame'
import { TelemetryRow } from '@/hud/Telemetry'
import { messageType } from '@/core/messages'
import { UDRE_TABLE_M } from '@/core/groundSegment'
import { GIVE_TABLE_M } from '@/core/iono'
import { decodeRings } from '@/views/geo/coast'
import { europe } from '@/views/geo/europe.data'
import { slotSystem } from '@/core/sbasDecode'
import type { JourneyEngine } from '@/journey/engine'
import { formatMetres } from '@/lib/format'
import { egnosRecording, RECORDING_LABEL } from '@/replay/recording'
import { useSources } from '../sources/store'

const nameOf = (t: number) => messageType('L1', t)?.name ?? `Type ${t}`

/** The map of the recorded grid: 30°W–50°E, 20–70°N, with Europe's outline. */
const MAP = { lon0: -30, lon1: 50, lat0: 20, lat1: 70 }
const W = 300
const H = 190
const K = Math.cos((45 * Math.PI) / 180)
/** A margin, so the grid points on the box's edge are drawn whole. */
const PAD = 6
const sx = (W - 2 * PAD) / ((MAP.lon1 - MAP.lon0) * K)
const X = (lon: number) => PAD + (lon - MAP.lon0) * K * sx
const Y = (lat: number) => PAD + ((MAP.lat1 - lat) * (H - 2 * PAD)) / (MAP.lat1 - MAP.lat0)
const OUTLINE = decodeRings(europe)
  .map((r) => {
    let d = ''
    for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(r[i + 1]).toFixed(1)}`
    return `${d}Z`
  })
  .join('')

/**
 * The real EGNOS signal, replayed on the journey clock: the message broadcast this
 * second, checked and decoded, and the picture a receiver had built from the messages so
 * far: the satellites corrected and how far to trust them (UDRE), and the ionospheric
 * grid (delay and GIVE). Recorded in 2011 by ESA's EGNOS Message Server: real data, not
 * the simulated world, and not today's EGNOS.
 */
export function ReplayPanel({ engine, nowS, index = '10' }: { engine: JourneyEngine; nowS: number; index?: string }) {
  const rec = useMemo(() => egnosRecording(), [])
  const showSources = useSources((s) => s.show)
  const second = ((Math.floor(nowS) % rec.durationS) + rec.durationS) % rec.durationS
  const i = rec.indexAt(second)
  const msg = rec.messages[i]
  // The decoded picture changes once a recorded second, not with the page's 10 Hz readouts.
  const { state, fast, usable, grid, monitored } = useMemo(() => {
    const state = rec.stateAfter(i)
    const fast = [...state.fast.entries()].sort((a, b) => a[0] - b[0]).map(([slot, f]) => ({ ...f, ...slotSystem(state.maskBits[slot] ?? 0) }))
    return {
      state,
      fast,
      usable: fast.filter((f) => f.udrei < 14),
      grid: [...state.grid.values()].filter((g) => g.lonDeg >= MAP.lon0 && g.lonDeg <= MAP.lon1 && g.latDeg >= MAP.lat0 && g.latDeg <= MAP.lat1),
      monitored: [...state.grid.values()].filter((g) => g.givei < 15),
    }
  }, [rec, i])
  const sim = engine.snapshot()
  const simOk = [...sim.ground.corrections.values()].filter((c) => c.status === 'ok')
  const simBest = simOk.length ? Math.min(...simOk.map((c) => UDRE_TABLE_M[c.udrei] ?? Infinity)) : Number.NaN
  const recBest = usable.length ? Math.min(...usable.map((f) => UDRE_TABLE_M[f.udrei] ?? Infinity)) : Number.NaN
  const segs = [
    { n: 8, cls: 'bg-foreground/70', t: 'Preamble' },
    { n: 6, cls: 'bg-signal', t: 'Type' },
    { n: 212, cls: 'bg-brass', t: 'Data' },
    { n: 24, cls: msg.crcValid ? 'bg-success' : 'bg-destructive', t: 'CRC' },
  ]
  return (
    <HudPanel index={index} title="Real EGNOS signal">
      <p className="hud-label normal-case text-brass">{RECORDING_LABEL}</p>
      <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
        Replayed on the journey clock (second {second} of {rec.durationS}). Real data from 2011, not the simulated world and not today’s EGNOS GEOs.{' '}
        <button type="button" className="hud-label normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources(['replay.recording', 'replay.decoder-check', 'egnos.geos'])}>
          Sources
        </button>
      </p>

      <h3 className="hud-label mt-3 text-foreground">This second</h3>
      <p className="mt-1 text-[13px] leading-5 text-foreground">
        <span className="hud-value text-brass">MT{msg.type}</span> {nameOf(msg.type)}
      </p>
      <div className="mt-1 flex h-3 w-full overflow-hidden rounded-[2px]" role="img" aria-label={`Message of 250 bits: preamble 8, type 6, data 212, CRC 24, ${msg.crcValid ? 'CRC valid' : 'CRC failed'}`}>
        {segs.map((s) => (
          <span key={s.t} className={s.cls} style={{ width: `${(s.n / 250) * 100}%` }} title={`${s.t}, ${s.n} bits`} />
        ))}
      </div>
      <p className="mt-1 font-mono text-[10.5px] break-all text-muted-foreground">{msg.hex}</p>
      <TelemetryRow label="CRC-24Q" value={msg.crcValid ? 'valid' : 'FAILED'} tone={msg.crcValid ? 'ok' : 'alert'} />

      <h3 className="hud-label mt-3 text-foreground">What a receiver had decoded</h3>
      <TelemetryRow label="Satellites in the PRN mask" value={state.maskBits.length} />
      <TelemetryRow label="Corrected (UDREI below 14)" value={`${usable.length} / ${fast.length}`} tone="ok" />
      <TelemetryRow label="Best UDRE · recording" value={formatMetres(recBest)} tone="brass" />
      <TelemetryRow label="Best UDRE · simulation now" value={formatMetres(simBest)} tone="muted" />
      <TelemetryRow label="Grid points monitored" value={`${monitored.length} / ${state.grid.size}`} tone="brass" />
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Fast corrections by satellite: PRN and UDRE">
        {usable.slice(0, 32).map((f) => (
          <span key={`${f.system}${f.prn}`} className="hud-value rounded-[2px] border border-hud-line px-1 text-[10px] text-foreground/90" title={`${f.system} ${f.prn}: correction ${f.prcM.toFixed(3)} m, UDRE ${UDRE_TABLE_M[f.udrei]} m`}>
            {f.system === 'GPS' ? 'G' : f.system === 'GLONASS' ? 'R' : 'S'}
            {f.prn} · {UDRE_TABLE_M[f.udrei]} m
          </span>
        ))}
      </div>

      <h3 className="hud-label mt-3 text-foreground">The ionospheric grid it broadcast</h3>
      <div className="dark mt-1 rounded-[4px] border border-hud-line bg-scope-bg p-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Recorded EGNOS ionospheric grid over Europe: ${monitored.length} of ${state.grid.size} grid points monitored; circle size is the vertical delay, a cross marks a point not monitored.`}>
          <path d={OUTLINE} className="fill-foreground/10 stroke-foreground/40" strokeWidth={0.6} fillRule="evenodd" />
          {grid.map((g) =>
            g.givei >= 15 || g.delayM === null ? (
              <path key={`${g.latDeg},${g.lonDeg}`} d={`M${X(g.lonDeg) - 2.5} ${Y(g.latDeg) - 2.5}l5 5m0 -5l-5 5`} className="stroke-foreground/50" strokeWidth={1} />
            ) : (
              <circle key={`${g.latDeg},${g.lonDeg}`} cx={X(g.lonDeg)} cy={Y(g.latDeg)} r={Math.min(7, 1.5 + g.delayM * 0.8)} className="fill-signal/30 stroke-signal" strokeWidth={0.8}>
                <title>{`${g.latDeg}°, ${g.lonDeg}°: ${g.delayM.toFixed(2)} m, GIVE ${GIVE_TABLE_M[g.givei] ?? '–'} m`}</title>
              </circle>
            ),
          )}
        </svg>
      </div>
      <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">○ size: vertical delay at L1 · × not monitored. The simulation draws its own grid on the network map.</p>
      <p className="mt-2 text-[11.5px] leading-4 text-muted-foreground">
        Decoded by SBAS Lab and checked against RTKLIB’s independent decoder on the same file. Recording: ESA EGNOS Message Server, via the EGNOS Toolkit (EUPL v1.1).
      </p>
    </HudPanel>
  )
}

export default ReplayPanel
