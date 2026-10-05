import { ACTIVE_SCENARIO, SCENARIO_IDS, scenarioHref } from '@/scenarios/id'
import { SCENARIOS } from '@/scenarios/active'
import { cn } from '@/lib/utils'
import { ACTIVE_VIEW, systemsHref, withoutView } from '@/page/view'

const tabClass = (active: boolean) =>
  cn(
    'hud-label -mb-px flex shrink-0 items-center gap-2 rounded-t-[3px] border-b-2 px-3 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    active ? 'border-signal text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
  )

/**
 * The scenario tabs under the top bar: the AirNav Indonesia journey (a what-if
 * Indonesian SBAS) and the ESSP-SAS journey (EGNOS over southern France). Each tab is a
 * link: a scenario is a page load of its own (one world, one clock), so switching starts
 * that scenario's journey from the gate. Other query parameters (an LMS launch) stay.
 * A last tab leads to the SBAS systems of the world (`?view=systems`).
 */
export function ScenarioBar() {
  const search = typeof location !== 'undefined' ? location.search : ''
  // Launched from a learning management system: the LMS chose the scenario, and leaving
  // the page would end its SCORM session (an LMS accepts one initialise per launch).
  if (new URLSearchParams(search).has('lms')) return null
  return (
    <nav aria-label="Scenario" className="border-b border-hud-line bg-background/60">
      <div className="mx-auto flex h-10 max-w-[1440px] items-stretch gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:px-8">
        <span className="hud-label mr-2 hidden items-center text-muted-foreground sm:flex" aria-hidden>
          Scenario
        </span>
        {SCENARIO_IDS.map((id) => {
          const s = SCENARIOS[id]
          const active = ACTIVE_VIEW === 'journey' && id === ACTIVE_SCENARIO
          return (
            <a key={id} href={scenarioHref(id, import.meta.env.BASE_URL, withoutView(search))} aria-current={active ? 'page' : undefined} title={s.tab.hint} className={tabClass(active)}>
              <span className={cn('inline-block size-1.5 shrink-0', active ? 'bg-signal shadow-[0_0_6px_var(--signal)]' : 'bg-hud-line')} aria-hidden />
              <span className="whitespace-nowrap">{s.tab.label}</span>
              <span className="hidden truncate tracking-normal normal-case lg:inline">· {s.tab.hint}</span>
            </a>
          )
        })}
        <a href={systemsHref(import.meta.env.BASE_URL)} aria-current={ACTIVE_VIEW === 'systems' ? 'page' : undefined} title="Every SBAS for civil aviation, and how SBAS works end to end" className={cn(tabClass(ACTIVE_VIEW === 'systems'), 'ml-auto')}>
          <span className={cn('inline-block size-1.5 shrink-0 rotate-45', ACTIVE_VIEW === 'systems' ? 'bg-brass shadow-[0_0_6px_var(--brass)]' : 'bg-hud-line')} aria-hidden />
          <span className="whitespace-nowrap">SBAS worldwide</span>
        </a>
      </div>
    </nav>
  )
}
