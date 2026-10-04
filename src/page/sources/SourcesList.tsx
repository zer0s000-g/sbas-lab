import { useMemo, useState } from 'react'
import { CircleDashed, FileCheck2, ShieldCheck } from 'lucide-react'
import { Segmented } from '@/hud/Controls'
import { cn } from '@/lib/utils'
import { claimsFor, STATUS_LABEL, statusCounts, type Claim, type ClaimStatus, type ClaimTopic } from '@/content/claims'
import { SOURCES } from '@/content/sources'
import { SCENARIO } from '@/scenarios/active'
import { useSources } from './store'

type Filter = 'all' | ClaimStatus

const STATUS_ICON: Record<ClaimStatus, typeof ShieldCheck> = { reviewed: ShieldCheck, sourced: FileCheck2, 'to-confirm': CircleDashed }
const STATUS_TONE: Record<ClaimStatus, string> = { reviewed: 'text-success', sourced: 'text-foreground', 'to-confirm': 'text-brass' }
const TOPICS: readonly ClaimTopic[] = ['EGNOS and ESSP', 'Operations and ATM', 'SBAS', 'Ionosphere', 'GNSS', 'Scenario data', 'Real signal']

/** A claim's status, as an icon and words (never colour alone). */
export function StatusTag({ status }: { status: ClaimStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={cn('hud-label inline-flex items-center gap-1', STATUS_TONE[status])}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}

function ClaimCard({ c }: { c: Claim }) {
  const value = c.value === undefined ? null : `${Array.isArray(c.value) ? c.value.join(', ') : c.value}${c.unit ? ` ${c.unit}` : ''}`
  return (
    <article className="border-b border-hud-line py-3 last:border-b-0" aria-labelledby={`claim-${c.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusTag status={c.status} />
        <code id={`claim-${c.id}`} className="hud-label normal-case text-muted-foreground">
          {c.id}
        </code>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-5 text-foreground">{c.text}</p>
      {value && (
        <p className="hud-value mt-1 text-[12px] text-brass">
          <span className="sr-only">Value: </span>
          {value}
        </p>
      )}
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] leading-4 text-muted-foreground">
        {c.refs.map((r, i) => {
          const s = SOURCES[r.source]
          return (
            <li key={i}>
              {s.publisher}, <cite>{s.title}</cite>
              {r.section ? `, ${r.section}` : ''} ({s.edition}
              {s.access === 'via-search' ? '; read through search results' : s.access === 'not-reached' ? '; not reached by this build' : s.access === 'via-doc9849' ? '; through Doc 9849' : ''})
            </li>
          )
        })}
      </ul>
      {c.note && <p className="mt-1.5 text-[12px] leading-4 text-foreground/80 italic">{c.note}</p>}
      {c.review && (
        <p className="hud-label mt-1 normal-case text-success">
          Reviewed by {c.review.by}, {c.review.on}
        </p>
      )}
      {c.code && <p className="mt-1 font-mono text-[11px] text-muted-foreground">In the code: {c.code}</p>}
    </article>
  )
}

/** The scenario's claims, grouped by topic, filtered by status, or focused on one phase's. */
export default function SourcesList({ focus }: { focus: readonly string[] | null }) {
  const [filter, setFilter] = useState<Filter>('all')
  const clearFocus = useSources((s) => s.show)
  const all = useMemo(() => claimsFor(SCENARIO.id), [])
  const n = statusCounts(all)
  const shown = all.filter((c) => (focus ? focus.includes(c.id) : true) && (filter === 'all' || c.status === filter))
  return (
    <div className="flex flex-col gap-3 p-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {(['reviewed', 'sourced', 'to-confirm'] as const).map((s) => (
          <div key={s} className="rounded-[4px] border border-hud-line p-2">
            <dt className="flex justify-center">
              <StatusTag status={s} />
            </dt>
            <dd className="hud-value mt-1 text-[18px] text-foreground">{n[s]}</dd>
          </div>
        ))}
      </dl>
      {n.reviewed === 0 && (
        <p className="text-[12.5px] leading-5 text-foreground/85">
          No claim has been signed off by a qualified GNSS/CNS engineer yet. "Sourced" means the source and section are identified; "To confirm" marks simplified or illustrative values and facts this build could not check against the primary document.
        </p>
      )}
      <Segmented
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', ariaLabel: 'Show all claims' },
          { value: 'to-confirm', label: 'To confirm', ariaLabel: 'Show the claims to confirm' },
          { value: 'sourced', label: 'Sourced', ariaLabel: 'Show the sourced claims awaiting review' },
          { value: 'reviewed', label: 'Reviewed', ariaLabel: 'Show the reviewed claims' },
        ]}
      />
      {focus && (
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-foreground/85">
          The claims behind this phase.
          <button type="button" className="hud-label text-signal underline-offset-2 hover:underline" onClick={() => clearFocus()}>
            Show all {all.length}
          </button>
        </p>
      )}
      {TOPICS.map((t) => {
        const list = shown.filter((c) => c.topic === t)
        if (!list.length) return null
        return (
          <section key={t} aria-label={t}>
            <h3 className="hud-title mt-2 text-[12px] text-foreground">{t}</h3>
            {list.map((c) => (
              <ClaimCard key={c.id} c={c} />
            ))}
          </section>
        )
      })}
      {shown.length === 0 && <p className="text-[13px] text-muted-foreground">No claims with this status.</p>}
    </div>
  )
}
