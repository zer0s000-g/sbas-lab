import { useMemo, useState } from 'react'
import { HudPanel } from '@/hud/HudFrame'
import { HudButton, Segmented } from '@/hud/Controls'
import { useSampled } from '@/hooks/useSampled'
import { useJourneyState } from '@/journey/store'
import { FAILURES, type FailureId } from '@/journey/failures'
import { cn } from '@/lib/utils'
import { localToGeodetic } from '@/core/geo'
import { DESTINATION, REGION } from '@/core/region'
import { approachMode, groundFor, snapshot } from '@/core/sbasWorld'
import { OPERATIONS } from '@/core/operations'
import { expectedInstructions, trafficAt, type AtcInstruction, type TrafficSpec } from '@/core/traffic'
import { M_PER_FT } from '@/core/units'
import type { JourneyEngine } from '@/journey/engine'
import { logAction } from '@/journey/sessionLog'
import { SCENARIO } from '@/scenarios/active'
import { SCENARIO_TRAFFIC } from '@/scenarios/traffic'
import { useSources } from '../sources/store'

const T = SCENARIO_TRAFFIC[SCENARIO.id]
const SPEC: TrafficSpec = {
  threshold: { eastNm: DESTINATION.thresholdEastNm, northNm: DESTINATION.thresholdNorthNm, elevationFt: DESTINATION.elevationFt },
  finalCourseDeg: DESTINATION.runwayCourseDeg,
  joinNm: T.joinNm,
  gpaDeg: 3,
  streams: T.streams,
  aircraft: T.aircraft,
  cycleS: T.cycleS,
}

type Mode = 'LPV' | 'LNAV/VNAV' | 'LNAV' | 'NONE'
interface Blip {
  callsign: string
  equip: 'sbas' | 'gps' | 'conventional'
  x: number
  y: number
  altFt: number
  trackDeg: number
  /** What it can fly now. */
  mode: Mode
  /** What the scope's data block says. */
  label: string
  flagged: boolean
}

/** The picture at the engine's current time: each arrival and what its avionics support now. */
function picture(engine: JourneyEngine): Blip[] {
  const tS = engine.worldS
  const c = engine.conditions()
  const ground = groundFor(tS, c)
  return trafficAt(SPEC, tS).map((a) => {
    let mode: Mode = 'NONE'
    if (a.equip !== 'conventional') {
      const snap = snapshot(tS, localToGeodetic(REGION, a.eastNm, a.northNm, a.altFt * M_PER_FT), c, ground)
      if (a.equip === 'sbas') mode = approachMode(snap).mode
      else mode = snap.abas && !snap.abas.alarm && snap.abas.hplM <= OPERATIONS.npa.halM ? 'LNAV' : 'NONE'
    }
    const label = a.equip === 'conventional' ? 'ILS' : mode === 'NONE' ? 'NO GNSS' : mode
    const flagged = (a.equip === 'sbas' && mode !== 'LPV') || (a.equip === 'gps' && mode === 'NONE')
    return { callsign: a.callsign, equip: a.equip, x: a.eastNm - SPEC.threshold.eastNm, y: a.northNm - SPEC.threshold.northNm, altFt: a.altFt, trackDeg: a.trackDeg, mode, label, flagged }
  })
}

/**
 * What each instruction sounds like (PANS-ATM, Doc 4444 §12.3.1.14 and §12.3.3; claim
 * atc.phraseology). A GNSS warning is a broadcast to all stations; the others are
 * addressed to an aircraft, shown here as "(callsign)". The hold fix and time are the
 * controller's to fill in.
 */
const SAY: Readonly<Record<AtcInstruction, { button: string; rt: string }>> = {
  'gnss-unreliable': { button: 'Warn: GNSS unreliable', rt: `ALL STATIONS, GNSS REPORTED UNRELIABLE IN THE VICINITY OF ${T.vicinity} 30 NM` },
  'sbas-unavailable': { button: 'Warn: SBAS unavailable for LPV', rt: '(callsign), SBAS UNAVAILABLE FOR LPV' },
  'clear-conventional': { button: `Clear to the ${T.conventional}`, rt: `(callsign), CLEARED ${T.conventional.replace('RWY', 'APPROACH RUNWAY')}` },
  hold: { button: 'Hold all arrivals', rt: '(callsign), HOLD AT (fix) AS PUBLISHED, EXPECT FURTHER CLEARANCE AT (time)' },
  'no-action': { button: 'No action needed', rt: '(no transmission)' },
}

/**
 * Scenarios without a "Break something" panel (AirNav Indonesia) get the outages a
 * controller meets here, so the view has something to handle.
 */
const OUTAGES: readonly FailureId[] = (['jamming', 'sbasOff', 'geoLost'] as const).filter((id) => FAILURES.some((f) => f.id === id))
const OWN_OUTAGES = SCENARIO.id !== 'essp'

const R_NM = 36
const W = 300
const K = W / (2 * R_NM)
const px = (nm: number) => W / 2 + nm * K
const py = (nm: number) => W / 2 - nm * K

/**
 * The controller's view: the arrivals into the destination on an approach scope, what
 * each one can fly now in the same SBAS world as LAB201, and the controller's choice of
 * instruction when GNSS degrades, checked against what the picture calls for and written
 * to the session log for the debrief. Traffic, callsigns and equipage are illustrative.
 */
export function AtcPanel({ engine, index = '13' }: { engine: JourneyEngine; index?: string }) {
  const blips = useSampled(() => picture(engine), 1000, (a, b) => JSON.stringify(a) === JSON.stringify(b))
  const [said, setSaid] = useState<{ what: AtcInstruction; correct: boolean; expected: AtcInstruction[] } | null>(null)
  const showSources = useSources((s) => s.show)
  const failures = useJourneyState(engine, (s) => s.failures)
  const outage = OUTAGES.find((id) => failures[id]) ?? 'none'
  const setOutage = (v: FailureId | 'none') => {
    for (const id of OUTAGES) if (id !== v) engine.setFailure(id, false)
    if (v !== 'none') engine.setFailure(v, true)
    setSaid(null)
  }
  const expected = useMemo(() => expectedInstructions(blips), [blips])
  const flagged = blips.filter((b) => b.flagged)
  const back = (DESTINATION.runwayCourseDeg + 180) * (Math.PI / 180)
  const say = (what: AtcInstruction) => {
    const correct = expected.includes(what)
    setSaid({ what, correct, expected })
    logAction(engine, 'atc', what, correct)
  }
  const summary = blips.map((b) => `${b.callsign} ${b.altFt} ft ${b.label}`).join('; ')
  return (
    <HudPanel index={index} title="Controller’s view">
      <p className="hud-label normal-case text-brass">Arrivals into {DESTINATION.city} · traffic, callsigns and equipage illustrative</p>
      <div className="dark mt-2 rounded-[4px] border border-hud-line bg-scope-bg p-1">
        <svg viewBox={`0 0 ${W} ${W}`} className="w-full" role="img" aria-label={`Approach scope around ${DESTINATION.city}, range rings 10, 20 and 30 NM. ${blips.length} arrivals: ${summary || 'none'}. ${flagged.length ? `${flagged.length} flagged.` : 'None flagged.'}`}>
          {[10, 20, 30].map((r) => (
            <circle key={r} cx={W / 2} cy={W / 2} r={r * K} className="fill-none stroke-scope-grid" strokeWidth={0.8} />
          ))}
          {[10, 20, 30].map((r) => (
            <text key={`t${r}`} x={W / 2 + 2} y={W / 2 - r * K - 2} className="fill-scope-dim font-mono text-[7px]">
              {r}
            </text>
          ))}
          <line x1={px(0)} y1={py(0)} x2={px(Math.sin(back) * T.joinNm)} y2={py(Math.cos(back) * T.joinNm)} className="stroke-scope-trace" strokeDasharray="3 2" strokeWidth={1} />
          <line x1={px(0)} y1={py(0)} x2={px(-Math.sin(back) * 1.6)} y2={py(-Math.cos(back) * 1.6)} className="stroke-foreground" strokeWidth={2.4} />
          {T.streams.map((s) => {
            const b = (s.fromBearingDeg * Math.PI) / 180
            return (
              <text key={s.id} x={px(Math.sin(b) * Math.min(R_NM - 1.5, s.entryNm + 1.8))} y={py(Math.cos(b) * Math.min(R_NM - 1.5, s.entryNm + 1.8))} textAnchor="middle" className="fill-scope-dim font-mono text-[8px]">
                {s.name}
              </text>
            )
          })}
          {blips.map((b) => {
            const x = px(b.x)
            const y = py(b.y)
            // The data block sits to the right of the track, clear of the aircraft's own path.
            const t = (b.trackDeg * Math.PI) / 180
            const dx = Math.cos(t)
            const dy = Math.sin(t)
            const lx = x + dx * 14
            const ly = y + dy * 14
            const anchor = dx >= 0 ? 'start' : 'end'
            const tone = b.flagged ? 'fill-scope-alert' : 'fill-scope-blip'
            return (
              <g key={b.callsign}>
                {b.equip === 'sbas' ? <rect x={x - 3} y={y - 3} width={6} height={6} className={tone} /> : b.equip === 'gps' ? <circle cx={x} cy={y} r={3.2} className={tone} /> : <path d={`M${x} ${y - 3.6}l3.6 3.6-3.6 3.6-3.6-3.6z`} className={tone} />}
                <line x1={x + dx * 4} y1={y + dy * 4} x2={lx - dx * 2} y2={ly - dy * 2} className="stroke-scope-dim" strokeWidth={0.6} />
                <text x={lx} y={ly - 2} textAnchor={anchor} className={cn('font-mono text-[8px]', b.flagged ? 'fill-scope-alert' : 'fill-scope-text')}>
                  {b.callsign} {String(Math.round(b.altFt / 100)).padStart(3, '0')}
                  <tspan x={lx} dy={9}>
                    {b.label}
                  </tspan>
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">■ SBAS avionics · ● GPS-only avionics · ◆ no GNSS approach (ILS) · flagged in red: cannot fly its planned GNSS approach now. Range rings 10, 20, 30 NM.</p>

      {OWN_OUTAGES && (
        <Segmented
          className="mt-3"
          label="What goes wrong"
          wrap
          value={outage}
          onChange={setOutage}
          options={[{ value: 'none' as const, label: 'Nothing', ariaLabel: 'No outage' }, ...OUTAGES.map((id) => ({ value: id, label: FAILURES.find((f) => f.id === id)!.label, ariaLabel: `Outage: ${FAILURES.find((f) => f.id === id)!.label}` }))]}
        />
      )}
      <h3 className="hud-label mt-3 text-foreground">You are the approach controller</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-foreground/90">
        {flagged.length ? `${flagged.map((b) => b.callsign).join(', ')} ${flagged.length === 1 ? 'cannot' : 'cannot'} fly the planned GNSS approach. What do you say?` : 'Every arrival can fly its planned approach. Break something, then decide what to say.'}
      </p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {(Object.keys(SAY) as AtcInstruction[]).map((k) => (
          <HudButton key={k} onClick={() => say(k)} active={said?.what === k} className="min-h-10 justify-start text-left normal-case">
            {SAY[k].button}
          </HudButton>
        ))}
      </div>
      {said && (
        <div className={cn('mt-2 rounded-[4px] border p-2 text-[12.5px] leading-5', said.correct ? 'border-success/60' : 'border-destructive/60')} aria-live="polite">
          <p className={cn('hud-label', said.correct ? 'text-success' : 'text-destructive')}>{said.correct ? 'Right call' : 'Not the best call'}</p>
          <p className="mt-1 font-mono text-[12px] text-foreground">“{SAY[said.what].rt}”</p>
          {!said.correct && <p className="mt-1 text-foreground/85">What the picture calls for: {said.expected.map((e) => SAY[e].button.toLowerCase()).join(', or ')}.</p>}
          {said.correct && said.expected.length > 1 && <p className="mt-1 text-foreground/85">Also right: {said.expected.filter((e) => e !== said.what).map((e) => SAY[e].button.toLowerCase()).join(', ')}.</p>}
        </div>
      )}
      <p className="mt-2 text-[11.5px] leading-4 text-muted-foreground">
        Wording after ICAO PANS-ATM (Doc 4444) Chapter 12.{' '}
        <button type="button" className="hud-label normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources(['atc.phraseology', 'atc.traffic', 'atc.conventional-approach'])}>
          Sources
        </button>
      </p>
    </HudPanel>
  )
}

export default AtcPanel
