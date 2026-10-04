import { useEffect, useMemo, useState } from 'react'
import { HudPanel } from '@/hud/HudFrame'
import { Segmented } from '@/hud/Controls'
import { DESTINATION, START_UTC_HOUR } from '@/core/region'
import { APPROACH_NOTE } from '@/core/approach'
import { forecastAt, notamProposals, utcClock, type Forecast } from '@/core/service'
import { conditionsFor, FAILURES, NO_FAILURES, NO_TIMES, type FailureId } from '@/journey/failures'
import type { JourneyEngine } from '@/journey/engine'
import { journeyIndex, TICK_S } from '@/journey/phases'
import { useJourneyState } from '@/journey/store'
import { EWA_FACTS, FORECASTABLE, ROLE_NOTES, ROLES, SERVICE_NOTICES, situationOf, type Role } from '@/scenarios/essp/provision'
import { cn } from '@/lib/utils'
import { useSources } from '../sources/store'
import { useExamLock } from './examLock'

/** The forecast window: from the gate (07:00 UTC) for three hours, covering the arrival at Nice. */
const WINDOW_S = 3 * 3600
const STEP_S = 300
const PROCEDURE = `RNP RWY ${DESTINATION.runway}`

function ClaimLink({ claims, children }: { claims: readonly string[]; children: string }) {
  const show = useSources((s) => s.show)
  return (
    <button type="button" className="hud-label normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => show(claims)}>
      {children}
    </button>
  )
}

/** Availability over the window, one row per operation, with the time now and LAB201’s arrival. */
function ForecastChart({ rows, nowS, etaS }: { rows: { label: string; f: Forecast }[]; nowS: number; etaS: number }) {
  const W = 300
  const rowH = 16
  const top = 4
  const left = 52
  const x = (t: number) => left + ((W - left - 4) * Math.min(Math.max(t, 0), WINDOW_S)) / WINDOW_S
  const h = top + rows.length * (rowH + 6) + 16
  const summary = rows.map(({ label, f }) => `${label} ${Math.round(f.availability * 100)} % available${f.outages.length ? `, not available ${f.outages.map((o) => `${utcClock(o.fromS, START_UTC_HOUR)}–${utcClock(o.toS, START_UTC_HOUR)} UTC`).join(', ')}` : ''}`).join('; ')
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img" aria-label={`LPV availability forecast at ${DESTINATION.city}: ${summary}.`}>
      <defs>
        <pattern id="unavail-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" className="fill-destructive/25" />
          <line x1="0" y1="0" x2="0" y2="4" className="stroke-destructive" strokeWidth="1.5" />
        </pattern>
      </defs>
      {rows.map(({ label, f }, i) => {
        const y = top + i * (rowH + 6)
        return (
          <g key={label}>
            <text x={0} y={y + rowH - 4} className="fill-muted-foreground font-mono text-[9px]">
              {label}
            </text>
            <rect x={x(0)} y={y} width={x(WINDOW_S) - x(0)} height={rowH} className="fill-success/25" />
            {f.outages.map((o, k) => (
              <rect key={k} x={x(o.fromS)} y={y} width={Math.max(1, x(o.toS) - x(o.fromS))} height={rowH} fill="url(#unavail-hatch)" />
            ))}
          </g>
        )
      })}
      {[0, 1, 2, 3].map((hh) => (
        <text key={hh} x={x(hh * 3600)} y={h - 2} textAnchor={hh === 0 ? 'start' : hh === 3 ? 'end' : 'middle'} className="fill-muted-foreground font-mono text-[9px]">
          {utcClock(hh * 3600, START_UTC_HOUR)}
        </text>
      ))}
      <line x1={x(etaS)} x2={x(etaS)} y1={top - 2} y2={h - 12} className="stroke-brass" strokeDasharray="3 2" />
      <line x1={x(nowS)} x2={x(nowS)} y1={top - 2} y2={h - 12} className="stroke-signal" strokeWidth="1.5" />
    </svg>
  )
}

/**
 * Service provision in the ESSP-SAS scenario: the LPV availability forecast at Nice and
 * the NOTAM ESSP would propose, the EGNOS service notices, the EGNOS Working Agreement,
 * and what each role does in the situation on screen.
 */
export function ServicePanel({ engine, nowS, index = '09' }: { engine: JourneyEngine; nowS: number; index?: string }) {
  const failures = useJourneyState(engine, (s) => s.failures)
  const locked = useExamLock((s) => s.locked)
  const [role, setRole] = useState<Role>('pilot')
  // Only what is known in advance belongs in a forecast; sudden failures do not.
  const predictable = useMemo(() => FORECASTABLE.filter((id) => failures[id]), [failures])
  const key = locked ? 'exam' : predictable.join(',')
  const [forecast, setForecast] = useState<{ key: string; apv: Forecast; lpv: Forecast } | null>(null)
  useEffect(() => {
    // Off the input path: a forecast is some tens of snapshots.
    const id = window.setTimeout(() => {
      const f = { ...NO_FAILURES }
      if (!locked) for (const p of predictable) f[p] = true
      const c = conditionsFor(f, NO_TIMES)
      setForecast({ key, apv: forecastAt(DESTINATION, 'apv1', 0, WINDOW_S, STEP_S, c), lpv: forecastAt(DESTINATION, 'cat1', 0, WINDOW_S, STEP_S, c) })
    }, 0)
    return () => window.clearTimeout(id)
  }, [key, locked, predictable])
  const etaS = useMemo(() => journeyIndex().touchdownTick * TICK_S, [])
  const ready = forecast?.key === key ? forecast : null
  const notams = ready ? notamProposals(ready.apv, DESTINATION, PROCEDURE, 'EGNOS', START_UTC_HOUR) : []
  const on = locked ? [] : (FAILURES.filter((f) => failures[f.id]).map((f) => f.id) as FailureId[])
  const situation = situationOf(on)
  const note = ROLE_NOTES[situation][role]
  return (
    <HudPanel index={index} title="Service provision">
      <h3 className="hud-label text-foreground">
        LPV forecast at {DESTINATION.city} ({DESTINATION.id}) · {utcClock(0, START_UTC_HOUR)}–{utcClock(WINDOW_S, START_UTC_HOUR)} UTC
      </h3>
      <div className="mt-2 rounded-[4px] border border-hud-line p-2">
        {ready ? (
          <ForecastChart
            rows={[
              { label: 'APV-I', f: ready.apv },
              { label: 'LPV-200', f: ready.lpv },
            ]}
            nowS={nowS}
            etaS={etaS}
          />
        ) : (
          <p className="hud-label py-4 text-center">Computing the forecast…</p>
        )}
        <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] leading-4 text-muted-foreground">
          <span>▬ available</span>
          <span>▨ not available</span>
          <span className="text-signal">│ now</span>
          <span className="text-brass">┊ LAB201 lands</span>
        </p>
      </div>
      <p className="mt-2 text-[12.5px] leading-5 text-foreground/90">
        The forecast runs the page’s EGNOS model forward at {DESTINATION.city}
        {predictable.length && !locked ? ` with ${predictable.map((p) => FAILURES.find((f) => f.id === p)?.label.toLowerCase()).join(' and ')}` : ''}. Sudden failures (a lost GEO, a clock jump, interference) are not in a forecast.{' '}
        <ClaimLink claims={['essp.forecast-model', 'essp.notam-proposal', 'ops.notam']}>Sources</ClaimLink>
      </p>

      <h3 className="hud-label mt-4 text-foreground">Proposed NOTAM</h3>
      {!ready ? null : notams.length ? (
        <div className="mt-1 flex flex-col gap-2">
          {notams.map((n, i) => (
            <pre key={i} className="hud-value overflow-x-auto rounded-[4px] border border-destructive/50 p-2 text-[11.5px] leading-5 whitespace-pre-wrap text-foreground">
              {`A) ${n.a}  B) ${n.b} UTC  C) ${n.c} UTC\nE) ${n.e}`}
            </pre>
          ))}
          <p className="text-[11.5px] leading-4 text-muted-foreground">
            As ESSP’s NOTAM proposal service would send it to the NOTAM office: illustrative wording, no Q line, no date (the flight has none). <ClaimLink claims={['essp.notam-format']}>To confirm</ClaimLink>
          </p>
        </div>
      ) : (
        <p className="mt-1 text-[12.5px] leading-5 text-foreground/90">None: APV-I is predicted available at {DESTINATION.city} for the whole window.</p>
      )}

      <h3 className="hud-label mt-4 text-foreground">Who does what now</h3>
      <Segmented
        className="mt-1"
        value={role}
        onChange={setRole}
        options={ROLES.map((r) => ({ value: r.id, label: r.label, ariaLabel: r.long }))}
      />
      <p className="mt-2 text-[12.5px] leading-5 text-foreground/90" aria-live="polite">
        <span className="hud-label mr-1 text-brass">{ROLES.find((r) => r.id === role)!.long}</span>
        {note.text} <ClaimLink claims={note.claims}>Sources</ClaimLink>
      </p>
      {situation !== 'nominal' && <p className="mt-1 text-[11.5px] text-muted-foreground">For: {FAILURES.find((f) => f.id === situation)?.label}.</p>}

      <h3 className="hud-label mt-4 text-foreground">EGNOS service notices</h3>
      <ul className="mt-1 flex flex-col gap-1.5 text-[12.5px] leading-5 text-foreground/90">
        {SERVICE_NOTICES.map((n) => (
          <li key={n.date}>
            <span className="hud-value mr-1 text-[11px] text-brass">{n.date}</span>
            {n.text}
          </li>
        ))}
      </ul>
      <ClaimLink claims={['egnos.geos', 'egnos.geo-status-current']}>Sources · status changes by notice</ClaimLink>

      <h3 className="hud-label mt-4 text-foreground">EGNOS Working Agreements</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-foreground/90">
        An air navigation service provider that publishes EGNOS (LPV) procedures first signs an EGNOS Working Agreement with ESSP. In {EWA_FACTS.asOf}: <span className={cn('hud-value text-foreground')}>{EWA_FACTS.ewas}</span> EWAs in force ({EWA_FACTS.withAnsps} with ANSPs) and{' '}
        <span className="hud-value text-foreground">{EWA_FACTS.procedures}</span> EGNOS-based procedures. <ClaimLink claims={EWA_FACTS.claims}>Sources</ClaimLink>
      </p>
      <p className="mt-2 text-[11.5px] leading-4 text-muted-foreground">{APPROACH_NOTE}.</p>
    </HudPanel>
  )
}
