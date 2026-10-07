import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { HudPanel } from '@/hud/HudFrame'
import { HudButton } from '@/hud/Controls'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FAILURES } from '@/journey/failures'
import { debrief, parseLog, type SessionLog } from '@/journey/sessionLog'
import { examPlan } from '@/assessment/assessment'
import { IN_FLIGHT_RESPONSES } from '@/scenarios/essp/examResponses'
import { cn } from '@/lib/utils'
import { examSeedFromUrl } from './instructor'

const label = (id: string) => FAILURES.find((f) => f.id === id)?.label ?? id
/** Journey time as h:mm:ss. */
const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * The instructor's panel (`?instructor`): choose the exam's seed and share a link with it,
 * so every learner gets the same hidden failure; load a learner's exported session and
 * debrief it: when each failure began, what the learner did, how long it took, and the
 * right and wrong calls. Everything stays in this browser; there is no server.
 */
export function InstructorPanel({ index = '00' }: { index?: string }) {
  const [seed, setSeed] = useState<string>(() => String(examSeedFromUrl() ?? 1234))
  const [copied, setCopied] = useState(false)
  const [log, setLog] = useState<SessionLog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const n = Number(seed)
  const valid = Number.isInteger(n) && n > 0 && n < 2 ** 31
  const plan = valid ? examPlan(n, FAILURES, IN_FLIGHT_RESPONSES) : null
  const link = valid ? `${location.origin}${location.pathname}?scenario=essp&seed=${n}` : ''
  const d = log ? debrief(log) : null

  const load = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    const parsed = parseLog(await file.text())
    if (!parsed) {
      setLog(null)
      setError('This file is not an SBAS Lab session.')
    } else setLog(parsed)
  }

  return (
    <HudPanel index={index} title="Instructor">
      <p className="text-[12.5px] leading-5 text-foreground/90">Give every learner the same exam, then debrief their session. Nothing leaves this browser.</p>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="exam-seed" className="hud-label">
          Exam seed
        </Label>
        <Input id="exam-seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))} aria-describedby="exam-seed-help" className="h-10" />
        <p id="exam-seed-help" className="text-[12px] leading-4 text-muted-foreground">
          {plan ? `This seed hides: ${label(plan.failure)} (on final).` : 'A whole number from 1 to 2 147 483 647.'}
        </p>
        <HudButton
          disabled={!valid}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            } catch {
              setCopied(false)
              setError('Copy failed; the link is shown below.')
            }
          }}
        >
          <Link2 className="size-4" aria-hidden /> Copy the learners’ link
        </HudButton>
        {valid && <p className="font-mono text-[11px] break-all text-muted-foreground">{link}</p>}
        {copied && (
          <p className="hud-label normal-case text-success" aria-live="polite">
            Link copied.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="session-file" className="hud-label">
          Load a learner’s session
        </Label>
        <Input id="session-file" type="file" accept="application/json,.json" aria-label="Load a learner’s session" className="h-10" onChange={(e) => load(e.target.files?.[0])} />
        {error && (
          <p className="text-[12px] text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {log && d && (
        <section className="mt-3" aria-label="Debrief">
          <h3 className="hud-label text-foreground">Debrief</h3>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
            {log.scenario} · started {new Date(log.startedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC{log.seed ? ` · seed ${log.seed}` : ''} · {log.entries.length} events
          </p>
          <p className="mt-2 text-[13px] text-foreground">
            <span className="hud-value text-success">{d.right}</span> right · <span className="hud-value text-destructive">{d.wrong}</span> not right
          </p>
          {d.failures.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] leading-5">
              {d.failures.map((f, i) => (
                <li key={i} className="border-l-2 border-brass pl-2">
                  <span className="font-medium text-foreground">{label(f.id)}</span> at {clock(f.onS)}:{' '}
                  {f.responseS === null ? <span className="text-destructive">no response</span> : `first response after ${f.responseS.toFixed(0)} s (${f.firstAction})`}
                </li>
              ))}
            </ul>
          )}
          <ol className="mt-2 max-h-56 overflow-y-auto border-t border-hud-line text-[12px] leading-5" aria-label="Session timeline">
            {log.entries.map((e, i) => (
              <li key={i} className="flex gap-2 border-b border-hud-line py-1">
                <span className="hud-value w-16 shrink-0 text-muted-foreground">{clock(e.tS)}</span>
                <span className={cn('min-w-0', e.event.kind === 'action' && e.event.correct === false && 'text-destructive', e.event.kind === 'action' && e.event.correct === true && 'text-success')}>
                  {e.event.kind === 'phase'
                    ? `Phase: ${e.event.phase}`
                    : e.event.kind === 'failure'
                      ? `${e.event.on ? 'Broke' : 'Mended'}: ${label(e.event.id)}`
                      : e.event.kind === 'action'
                        ? `${e.event.area.toUpperCase()}: ${e.event.what}${e.event.correct === undefined ? '' : e.event.correct ? ' (right)' : ' (not right)'}`
                        : e.event.kind === 'stop'
                          ? `Guided stop: ${e.event.id}`
                          : e.event.kind === 'speed'
                            ? `Time-lapse: ${e.event.mode}`
                            : e.event.kind === 'running'
                              ? e.event.on
                                ? 'Played'
                                : 'Paused'
                              : 'Continued'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </HudPanel>
  )
}

export default InstructorPanel
