import { ACTIVE_SCENARIO, SCENARIO_IDS, scenarioHref } from '@/scenarios/id'
import { SCENARIOS } from '@/scenarios/active'
import { cn } from '@/lib/utils'

/**
 * The scenario tabs under the top bar: the AirNav Indonesia journey (a what-if
 * Indonesian SBAS) and the ESSP-SAS journey (EGNOS over southern France). Each tab is a
 * link: a scenario is a page load of its own (one world, one clock), so switching starts
 * that scenario's journey from the gate. Other query parameters (an LMS launch) stay.
 */
export function ScenarioBar() {
  const search = typeof location !== 'undefined' ? location.search : ''
  // Launched from a learning management system: the LMS chose the scenario, and leaving
  // the page would end its SCORM session (an LMS accepts one initialise per launch).
  if (new URLSearchParams(search).has('lms')) return null
  return (
    <nav aria-label="Scenario" className="border-b border-hud-line bg-background/60">
      <div className="mx-auto flex h-10 max-w-[1440px] items-stretch gap-1 px-4 md:px-8">
        <span className="hud-label mr-2 hidden items-center text-muted-foreground sm:flex" aria-hidden>
          Scenario
        </span>
        {SCENARIO_IDS.map((id) => {
          const s = SCENARIOS[id]
          const active = id === ACTIVE_SCENARIO
          return (
            <a
              key={id}
              href={scenarioHref(id, import.meta.env.BASE_URL, search)}
              aria-current={active ? 'page' : undefined}
              title={s.tab.hint}
              className={cn(
                'hud-label -mb-px flex min-w-0 items-center gap-2 rounded-t-[3px] border-b-2 px-3 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active ? 'border-signal text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('inline-block size-1.5 shrink-0', active ? 'bg-signal shadow-[0_0_6px_var(--signal)]' : 'bg-hud-line')} aria-hidden />
              <span className="truncate">{s.tab.label}</span>
              <span className="hidden truncate tracking-normal normal-case lg:inline">· {s.tab.hint}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
