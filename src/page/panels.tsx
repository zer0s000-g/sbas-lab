/**
 * The journey panels (design.md §4). Each reads the sampled view model, so every
 * number agrees with the views.
 */
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { DEPARTURE, DESTINATION } from '@/core/region'
import { GEO_SATS } from '@/core/orbits'
import { DEFAULT_SPEEDS } from '@/core/clock'
import type { Fix } from '@/core/receiver'
import { messageBits } from '@/core/messages'
import { HudPanel } from '@/hud/HudFrame'
import { HudButton, LeverSwitch, Segmented } from '@/hud/Controls'
import { TelemetryRow } from '@/hud/Telemetry'
import { Button } from '@/components/ui/button'
import { CDI } from '@/instruments/CDI'
import { MessageLog } from '@/instruments/MessageLog'
import { ProtectionBars } from '@/instruments/ProtectionBars'
import { StanfordChart, type StanfordPoint } from '@/instruments/StanfordChart'
import { formatDuration, formatMetres, formatNumber, formatSpeed, NO_VALUE } from '@/lib/format'
import { cn } from '@/lib/utils'
import { NARRATION } from '@/journey/narration'
import { STORY_NOTE } from '@/journey/director'
import type { JourneyEngine, SpeedMode, StopId } from '@/journey/engine'
import type { ViewModel } from './model'
import { SCENARIO } from '@/scenarios/active'
import { useSources } from './sources/store'

const TX = SCENARIO.texts

const hhmm = (h: number) => (Number.isFinite(h) ? `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}` : NO_VALUE)
const serviceName = (s: ViewModel['service']) => TX.serviceNames[s]

export function FlightCard({ m }: { m: ViewModel }) {
  return (
    <HudPanel index="01" title="Flight">
      <TelemetryRow label="Callsign" value="LAB201" />
      <TelemetryRow label="Route" value={`${DEPARTURE.city} ${DEPARTURE.id} → ${DESTINATION.city} ${DESTINATION.id}`} tone="muted" />
      <TelemetryRow label="Altitude" value={m.altFt < 100 ? 'On ground' : formatNumber(Math.round(m.altFt / 10) * 10, 0)} unit={m.altFt < 100 ? undefined : 'ft'} />
      <TelemetryRow label="Ground speed" value={formatNumber(m.gsKt, 0)} unit="kt" />
      <TelemetryRow label={`To ${DESTINATION.city}`} value={formatNumber(m.distToGoNm, 1)} unit="NM" />
      <TelemetryRow label="Local time" value={`${hhmm(m.localHour)} ${m.localZone}`} tone="muted" />
      <p className="mt-2 text-[12px] leading-4 text-muted-foreground">{TX.flightNote}</p>
    </HudPanel>
  )
}

export function NowPanel({ m }: { m: ViewModel }) {
  const n = NARRATION[m.phase]
  const showSources = useSources((s) => s.show)
  return (
    <HudPanel index="02" title="What's happening">
      <h3 className="text-[15px] leading-6 font-medium text-foreground">{n.title}</h3>
      <p className="mt-1 text-[14px] leading-6 text-foreground/90">{n.now}</p>
      <p className="mt-2 text-[14px] leading-6 text-foreground/90">
        <span className="hud-label mr-1 text-brass">SBAS</span>
        {n.benefit}
      </p>
      {m.detail && <Detail d={m.detail} />}
      {!m.sbasShown && <p className="mt-2 text-[12px] leading-4 text-muted-foreground">{STORY_NOTE}</p>}
      {n.claims?.length ? (
        <button type="button" onClick={() => showSources(n.claims)} className="hud-label mt-3 block text-left normal-case underline-offset-2 hover:text-foreground hover:underline" aria-label={`Sources: ${n.source}. Show the ${n.claims.length} claims behind this phase and their review status`}>
          {n.source} · {n.claims.length} claims, review status
        </button>
      ) : (
        <p className="hud-label mt-3 normal-case">{n.source}</p>
      )}
    </HudPanel>
  )
}

const SBAS_TAG = { corrected: 'SBAS corrects', modelled: 'receiver models', stays: 'stays' } as const

/** Numbers that go with the phase's explanation. */
function Detail({ d }: { d: NonNullable<ViewModel['detail']> }) {
  const box = 'mt-3 rounded-[4px] border border-hud-line p-3'
  if (d.kind === 'errors') {
    const total = d.parts.reduce((s, p) => s + Math.abs(p.m), 0)
    return (
      <div className={box}>
        <p className="hud-label mb-2">
          Range error of {d.satId} · elevation {formatNumber(d.elDeg, 0)}°
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-[2px]" aria-hidden>
          {d.parts.map((p, i) => (
            <span key={p.name} className={cn('block h-full', p.sbas === 'corrected' ? 'bg-brass' : p.sbas === 'modelled' ? 'bg-signal/70' : 'bg-foreground/35', i > 0 && 'border-l border-background')} style={{ width: `${(Math.abs(p.m) / Math.max(total, 1e-6)) * 100}%` }} />
          ))}
        </div>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Parts of the range error in metres, and what deals with each</caption>
          <tbody>
            {d.parts.map((p) => (
              <tr key={p.name}>
                <th scope="row" className="py-0.5 text-[12px] font-normal text-foreground/90">
                  {p.name}
                </th>
                <td className="hud-value py-0.5 text-right text-[12px] text-foreground">{formatMetres(p.m)}</td>
                <td className={cn('hud-label py-0.5 pl-2 text-right', p.sbas === 'corrected' ? 'text-brass' : '')}>{SBAS_TAG[p.sbas]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (d.kind === 'reference')
    return (
      <div className={box}>
        <TelemetryRow label="Stations measuring" value={d.stations} />
        <TelemetryRow label="Satellites each sees" value={formatNumber(d.perStation, 1)} />
        <TelemetryRow label="Ionosphere samples" value={d.pierce} tone="signal" />
      </div>
    )
  if (d.kind === 'master')
    return (
      <div className={box}>
        <TelemetryRow label="Satellites corrected" value={d.ok} tone="ok" />
        <TelemetryRow label="Not monitored" value={d.notMonitored} tone="muted" />
        <TelemetryRow label="Do not use" value={d.doNotUse} tone={d.doNotUse ? 'alert' : 'muted'} />
        <TelemetryRow label="Best UDRE" value={formatMetres(d.bestUdreM)} tone="brass" />
        <TelemetryRow label="Grid points monitored" value={`${d.igpMonitored} / ${d.igpTotal}`} tone="brass" />
      </div>
    )
  if (d.kind === 'uplink') {
    // The layout of the signal in use: L1 (8-bit preamble) or DFMC on L5 (4-bit preamble).
    const b = messageBits(d.signal)
    return (
      <div className={box}>
        <p className="hud-label mb-2">One {d.signal === 'L1' ? 'L1' : 'L5 DFMC'} SBAS message · 250 bits · one per second</p>
        <div className="flex h-5 w-full overflow-hidden rounded-[2px] text-center font-mono text-[10px] leading-5 text-background">
          <span className="bg-foreground/70" style={{ width: `${(b.preamble / b.total) * 100}%` }} title={`Preamble, ${b.preamble} bits`} />
          <span className="bg-signal" style={{ width: `${(b.type / b.total) * 100}%` }} title={`Message type, ${b.type} bits`} />
          <span className="bg-brass" style={{ width: `${(b.data / b.total) * 100}%` }}>
            data {b.data}
          </span>
          <span className="bg-foreground/70" style={{ width: `${(b.crc / b.total) * 100}%` }} title={`CRC, ${b.crc} bits`} />
        </div>
        <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
          Preamble {b.preamble} · type {b.type} · data {b.data} · CRC {b.crc} bits.
        </p>
      </div>
    )
  }
  if (d.kind === 'fas')
    return (
      <div className={box}>
        <p className="hud-label mb-1">Final approach segment data block</p>
        <TelemetryRow label="Channel" value={d.channel} tone="brass" />
        <TelemetryRow label="Runway" value={d.runway} />
        <TelemetryRow label="Glide path" value={`${formatNumber(d.gpaDeg, 2)}°`} />
        <TelemetryRow label="Threshold crossing" value={d.tchFt} unit="ft" />
        <TelemetryRow label="HAL / VAL" value={`${d.halM} / ${d.valM} m`} tone="brass" />
        <TelemetryRow label="CRC" value={`${d.crc} ${d.valid ? 'valid' : 'FAIL'}`} tone={d.valid ? 'ok' : 'alert'} />
      </div>
    )
  return (
    <div className={box}>
      <TelemetryRow label="Height above threshold" value={formatNumber(d.heightFt, 0)} unit="ft" />
      <TelemetryRow label="Decision height" value={d.daFt} unit="ft" tone="brass" />
      <TelemetryRow label="To threshold" value={formatNumber(Math.max(0, d.alongNm), 1)} unit="NM" />
    </div>
  )
}

function Cell({ fix, k }: { fix: Fix | null; k: 'hplM' | 'vplM' | 'horizontalErrorM' | 'verticalErrorM' }) {
  const v = fix ? fix[k] : null
  return <td className="hud-value py-1 text-right text-[12px] text-foreground">{v === null ? (k === 'vplM' && fix ? 'none' : NO_VALUE) : formatMetres(v)}</td>
}

/** What SBAS gives in this phase: the operation's limits (Doc 9849 Table 2-1) and GPS alone next to SBAS. */
export function BenefitCard({ m }: { m: ViewModel }) {
  const op = m.op
  const final = m.phase === 'final' || m.phase === 'descent'
  const cols: { name: string; fix: Fix | null; inUse: boolean }[] = [
    { name: 'GPS alone', fix: m.abas, inUse: m.navSource === 'abas' },
    // The DFMC column shows the protection levels of the fix flown in this phase: the precision K factor on final, otherwise non-precision.
    { name: m.service === 'l1' ? 'L1 SBAS' : 'DFMC SBAS', fix: m.service === 'l1' ? m.sbas : m.phase === 'final' ? m.dfmc : m.dfmcNpa, inUse: m.navSource === 'sbas' },
  ]
  if (final && m.service === 'dfmc') cols.push({ name: 'L1 only', fix: m.l1Pa, inUse: false })
  return (
    <HudPanel index="03" title="SBAS in this phase">
      {op ? (
        <p className="text-[13px] leading-5 text-foreground">
          <span className="font-medium">{op.name}</span>
          <span className="hud-value block text-[12px] text-brass">
            HAL {formatMetres(op.halM)}
            {op.valM !== null ? ` · VAL ${formatMetres(op.valM)}` : ' · no vertical limit'} · alert within {formatDuration(op.ttaS)}
          </span>
        </p>
      ) : (
        <p className="text-[13px] leading-5 text-muted-foreground">
          {m.phase === 'landing' ? TX.benefitLanding : TX.benefitGate}
        </p>
      )}
      <table className="mt-3 w-full border-collapse text-left">
        <caption className="sr-only">Protection levels and errors, GPS alone compared with SBAS</caption>
        <thead>
          <tr>
            <th className="hud-label py-1 font-normal" scope="col">
              <span className="sr-only">Quantity</span>
            </th>
            {cols.map((c) => (
              <th key={c.name} scope="col" className="hud-label py-1 text-right font-normal">
                {c.name}
                {c.inUse && <span className="block text-signal">in use</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="border-t border-hud-line">
          {(
            [
              ['HPL', 'hplM'],
              ['VPL', 'vplM'],
              ['H error', 'horizontalErrorM'],
              ['V error', 'verticalErrorM'],
            ] as const
          ).map(([label, k]) => (
            <tr key={k} className="border-b border-hud-line last:border-b-0">
              <th scope="row" className="hud-label py-1 font-normal">
                {label}
              </th>
              {cols.map((c) => (
                <Cell key={c.name} fix={c.fix} k={k} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] leading-4 text-muted-foreground">
        {m.phase === 'final' && m.service === 'dfmc' ? TX.benefitCompareNote : 'Same satellites, same moment: only the corrections and their bounds differ. Values: Doc 9849 Table 2-1.'}
      </p>
    </HudPanel>
  )
}

export function StatusPanel({ m }: { m: ViewModel }) {
  const n = m.nav
  const hal = m.op?.halM ?? null
  const val = m.op?.valM ?? null
  const last = m.log[0]
  return (
    <HudPanel index="04" title="SBAS status">
      <TelemetryRow label="Satellites used" value={n ? `${n.used.length} / ${m.gpsTracked}` : NO_VALUE} />
      <TelemetryRow label="HDOP" value={n ? formatNumber(n.hdop) : NO_VALUE} />
      <TelemetryRow label="VDOP" value={n ? formatNumber(n.vdop) : NO_VALUE} />
      <TelemetryRow label={hal ? `HPL vs HAL ${formatMetres(hal)}` : 'HPL'} value={n ? formatMetres(n.hplM) : NO_VALUE} tone="signal" bar={n && hal ? n.hplM / hal : undefined} />
      <TelemetryRow label={val ? `VPL vs VAL ${formatMetres(val)}` : 'VPL'} value={n?.vplM !== null && n?.vplM !== undefined ? formatMetres(n.vplM) : 'none'} tone="signal" bar={n?.vplM && val ? n.vplM / val : undefined} />
      {m.approachPhase ? (
        <TelemetryRow label="Approach mode" value={m.modeText} tone={m.mode === 'LPV' ? 'ok' : m.mode === 'NONE' ? 'alert' : 'default'} />
      ) : (
        <TelemetryRow
          label="Navigating with"
          value={m.navSource === 'sbas' ? 'SBAS' : m.navSource === 'abas' ? 'GPS alone' : 'No GNSS'}
          tone={m.navSource === 'none' ? 'alert' : m.navSource === 'sbas' ? 'ok' : 'default'}
        />
      )}
      <TelemetryRow label="Last message" value={last ? `MT${last.type} ${last.name}` : 'None'} tone={last?.alarm ? 'alert' : last ? 'brass' : 'alert'} />
      {/* No GEO received and no loss on record (jamming): there is no last message to age. */}
      {m.geosTracked === 0 && m.messageAgeS === 0 ? (
        <TelemetryRow label="Message age" value="No signal" tone="alert" />
      ) : (
        <TelemetryRow label="Message age" value={formatDuration(m.messageAgeS)} tone={m.messageAgeS > 0 ? 'alert' : 'muted'} />
      )}
      <TelemetryRow label="GEO received" value={`${m.geosTracked} / ${GEO_SATS.length}`} tone={m.geosTracked === GEO_SATS.length ? 'ok' : m.geosTracked === 0 ? 'alert' : 'default'} />
      <TelemetryRow label="Service" value={serviceName(m.service)} tone="muted" />
      <p className="mt-2 text-[12px] leading-4 text-muted-foreground">{TX.statusNote}</p>
    </HudPanel>
  )
}

export function CockpitPanel({ m }: { m: ViewModel }) {
  return (
    <HudPanel index="05" title="Cockpit">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-4">
        <div className="dark rounded-md">
          <CDI dev={m.dev} mode={m.mode} />
        </div>
        <ProtectionBars fix={m.nav} op={m.op} />
      </div>
    </HudPanel>
  )
}

export function SignalsPanel({ m, getPoints }: { m: ViewModel; getPoints: () => StanfordPoint[] }) {
  return (
    <HudPanel index="06" title="Signals">
      <p className="hud-label mb-1">SBAS messages · {m.signal === 'L1' ? 'L1' : 'L5 (DFMC)'} · one per second</p>
      <MessageLog rows={m.log} signal={m.signal} />
      <p className="hud-label mt-4 mb-1">Stanford chart · horizontal error vs HPL (m)</p>
      <div className="dark">
        <StanfordChart
          getPoints={getPoints}
          alM={m.op?.halM ?? null}
          label={`Stanford chart of the journey so far: horizontal error against horizontal protection level. ${m.op ? `Alert limit ${formatMetres(m.op.halM)}.` : ''} All points above the diagonal means the protection level bounded every error.`}
          className="w-full rounded-[4px] border border-hud-line"
        />
      </div>
    </HudPanel>
  )
}

export function ControlsPanel({ engine, speedMode, guidedStops, onGuidedStops }: { engine: JourneyEngine; speedMode: SpeedMode; guidedStops: boolean; onGuidedStops: (v: boolean) => void }) {
  return (
    <HudPanel index="07" title="Time">
      <Segmented
        label="Time-lapse"
        value={String(speedMode)}
        options={[{ value: 'auto', label: 'Auto', ariaLabel: 'Automatic time-lapse' }, ...DEFAULT_SPEEDS.map((s) => ({ value: String(s), label: formatSpeed(s), ariaLabel: `Time-lapse ${s} times` }))]}
        onChange={(v) => engine.setSpeed(v === 'auto' ? 'auto' : Number(v))}
      />
      <LeverSwitch className="mt-3" tone="signal" label="Guided stops" hint="Pause at the four key moments." checked={guidedStops} onChange={onGuidedStops} />
      <HudButton className="mt-3 w-full" onClick={() => engine.reset()}>
        <RotateCcw aria-hidden /> Fly again from the gate
      </HudButton>
    </HudPanel>
  )
}

const STOP_TEXT: Readonly<Record<StopId, { title: string; body: string }>> = TX.stops

export function StopCard({ stop, onContinue, className }: { stop: StopId; onContinue: () => void; className?: string }) {
  const s = STOP_TEXT[stop]
  // Continue takes focus so the stop is announced and one key press goes on; afterwards
  // focus goes back where the learner was (the card unmounts, which would drop it to <body>).
  const [back] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const proceed = () => {
    onContinue()
    if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus()
  }
  return (
    <section role="dialog" aria-modal="false" aria-labelledby="stop-title" className={cn('hud-panel rounded-md p-4 shadow-[0_0_24px_-12px_var(--signal)]', className)}>
      <p className="hud-label text-signal">Guided stop</p>
      <h2 id="stop-title" className="mt-1 text-[15px] leading-6 font-medium text-foreground">
        {s.title}
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-foreground/90">{s.body}</p>
      <Button className="mt-3" autoFocus onClick={proceed}>
        Continue
      </Button>
    </section>
  )
}
