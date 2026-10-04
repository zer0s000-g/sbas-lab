import { RotateCcw } from 'lucide-react'
import { HudPanel } from '@/hud/HudFrame'
import { HudButton, LeverSwitch } from '@/hud/Controls'
import { FAILURES, type FailureId } from '@/journey/failures'
import type { JourneyEngine } from '@/journey/engine'
import { useJourneyState } from '@/journey/store'
import { useSources } from '../sources/store'
import { useExamLock } from './examLock'

/**
 * "Break something" in the ESSP-SAS scenario: each failure the scenario offers, what it
 * is, what to notice and what the crew, the controller and the provider do. The flight
 * keeps its planned path whatever is broken (design.md §6).
 */
export function BreakPanel({ engine, index = '08' }: { engine: JourneyEngine; index?: string }) {
  const failures = useJourneyState(engine, (s) => s.failures)
  const locked = useExamLock((s) => s.locked)
  const showSources = useSources((s) => s.show)
  const anyOn = FAILURES.some((f) => failures[f.id])
  return (
    <HudPanel index={index} title="Break something">
      {locked ? (
        <p className="text-[13px] leading-5 text-muted-foreground">Locked while the assessment runs: the failures are the assessment’s, and finding them is the task.</p>
      ) : (
        <>
          <p className="text-[12.5px] leading-5 text-muted-foreground">Switch a failure on and watch the panels, the map and the cockpit. LAB201 keeps its planned path; the page shows what the crew, the controller and EGNOS do.</p>
          <ul className="mt-2 flex flex-col">
            {FAILURES.map((f) => {
              const on = failures[f.id]
              return (
                <li key={f.id} className="border-b border-hud-line py-1 last:border-b-0">
                  <LeverSwitch label={f.label} hint={f.explain} checked={on} onChange={(v) => engine.setFailure(f.id as FailureId, v)} />
                  {on && (
                    <div className="mb-2 ml-7 flex flex-col gap-1.5 text-[12.5px] leading-5">
                      <p className="text-foreground/90">
                        <span className="hud-label mr-1 text-brass">Notice</span>
                        {f.notice}
                      </p>
                      <p className="text-foreground/90">
                        <span className="hud-label mr-1 text-signal">Crew and ATC</span>
                        {f.crewAtc}
                      </p>
                      {f.claims?.length ? (
                        <button type="button" className="hud-label self-start normal-case underline-offset-2 hover:text-foreground hover:underline" onClick={() => showSources(f.claims)}>
                          {f.source} · {f.claims.length} claims, review status
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <HudButton className="mt-2 w-full" disabled={!anyOn} onClick={() => FAILURES.forEach((f) => engine.setFailure(f.id, false))}>
            <RotateCcw aria-hidden /> Mend everything
          </HudButton>
        </>
      )}
    </HudPanel>
  )
}
