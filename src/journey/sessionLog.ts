/**
 * The session log: what happened in a learner's session, on the journey's clock, for
 * the instructor's debrief. Engine events (phase, failures, stops, speed, play/pause)
 * come from comparing the engine's discrete state before and after each change
 * (`journeyEvents`); the assessment and the controller's view add their own events
 * (`logAction`). Pure functions plus a small store; the log is a plain JSON document the
 * learner can export and the instructor can load.
 */
import { create } from 'zustand'
import type { JourneyEngine, JourneyState } from './engine'
import type { FailureId } from './failures'
import type { PhaseId } from './phases'

export type LogEvent =
  | { kind: 'phase'; phase: PhaseId }
  | { kind: 'failure'; id: FailureId; on: boolean }
  | { kind: 'stop'; id: string }
  | { kind: 'continue' }
  | { kind: 'running'; on: boolean }
  | { kind: 'speed'; mode: string }
  /** An action of the learner outside the engine: a quiz answer, an exam decision, an ATC instruction. */
  | { kind: 'action'; area: 'quiz' | 'exam' | 'atc' | 'instructor'; what: string; correct?: boolean }

export interface LogEntry {
  /** Journey world time, s. */
  tS: number
  phase: PhaseId
  event: LogEvent
}

export interface SessionLog {
  format: 'sbas-lab-session/1'
  scenario: string
  /** Exam seed in force, if any. */
  seed: number | null
  startedAt: string
  entries: LogEntry[]
}

/** The engine events between two discrete states. Pure. */
export function journeyEvents(prev: JourneyState, next: JourneyState): LogEvent[] {
  const out: LogEvent[] = []
  if (next.phase !== prev.phase) out.push({ kind: 'phase', phase: next.phase })
  for (const id of Object.keys(next.failures) as FailureId[]) if (next.failures[id] !== prev.failures[id]) out.push({ kind: 'failure', id, on: next.failures[id] })
  if (next.stop && next.stop !== prev.stop) out.push({ kind: 'stop', id: next.stop })
  // A "continue" is the learner leaving a stop where it stands; a stop left by a jump or a
  // reset (a new phase) is not one.
  if (!next.stop && prev.stop) {
    if (next.phase === prev.phase) out.push({ kind: 'continue' })
  }
  else if (next.running !== prev.running && !next.stop && !prev.stop) out.push({ kind: 'running', on: next.running })
  if (next.speedMode !== prev.speedMode) out.push({ kind: 'speed', mode: String(next.speedMode) })
  return out
}

export function emptyLog(scenario: string, seed: number | null = null, startedAt = new Date().toISOString()): SessionLog {
  return { format: 'sbas-lab-session/1', scenario, seed, startedAt, entries: [] }
}

/** The failures switched on after the log's first `i + 1` entries. Pure. */
export function failuresAfter(log: SessionLog, i: number): FailureId[] {
  const on = new Set<FailureId>()
  for (const e of log.entries.slice(0, i + 1)) {
    if (e.event.kind !== 'failure') continue
    if (e.event.on) on.add(e.event.id)
    else on.delete(e.event.id)
  }
  return [...on]
}

export interface Debrief {
  /** Each failure the session saw, when it began, and the learner's first action after it. */
  failures: { id: FailureId; onS: number; firstActionS: number | null; firstAction: string | null; responseS: number | null }[]
  actions: { tS: number; area: string; what: string; correct?: boolean }[]
  /** Right and wrong actions where the panel marked them. */
  right: number
  wrong: number
}

/**
 * The debrief of a session: response times to each failure, and the learner's actions. Pure.
 * The response to a failure is the first learner action logged AFTER it, in the order of
 * the log (journey time goes back on a jump, so it cannot order the entries). The response
 * time is the journey time flown between the two: the forward steps of the clock from one
 * entry to the next, a jump back counting as none.
 */
export function debrief(log: SessionLog): Debrief {
  const isAction = (e: LogEntry): e is LogEntry & { event: Extract<LogEvent, { kind: 'action' }> } => e.event.kind === 'action'
  const actions = log.entries.filter(isAction).map((e) => ({ tS: e.tS, ...e.event }))
  const failures: Debrief['failures'] = []
  log.entries.forEach((e, i) => {
    if (e.event.kind !== 'failure' || !e.event.on) return
    let flown = 0
    let after: (LogEntry & { event: Extract<LogEvent, { kind: 'action' }> }) | null = null
    for (let j = i + 1; j < log.entries.length; j++) {
      const x = log.entries[j]
      flown += Math.max(0, x.tS - log.entries[j - 1].tS)
      if (isAction(x) && x.event.area !== 'instructor') {
        after = x
        break
      }
    }
    const responseS = after ? Math.round(flown * 10) / 10 : null
    failures.push({ id: e.event.id, onS: e.tS, firstActionS: after?.tS ?? null, firstAction: after?.event.what ?? null, responseS })
  })
  return {
    failures,
    actions: actions.map(({ tS, area, what, correct }) => ({ tS, area, what, correct })),
    right: actions.filter((a) => a.correct === true).length,
    wrong: actions.filter((a) => a.correct === false).length,
  }
}

/** Reads a log a learner exported; null when it is not one. */
export function parseLog(text: string): SessionLog | null {
  try {
    const v = JSON.parse(text) as SessionLog
    if (v?.format !== 'sbas-lab-session/1' || !Array.isArray(v.entries)) return null
    const ok = v.entries.every((e) => Number.isFinite(e?.tS) && typeof e?.phase === 'string' && typeof e?.event?.kind === 'string')
    return ok ? v : null
  } catch {
    return null
  }
}

/** The log of this page's session. */
interface LogStore {
  log: SessionLog
  record: (tS: number, phase: PhaseId, event: LogEvent) => void
  reset: (scenario: string, seed: number | null) => void
}

export const useSessionLog = create<LogStore>((set) => ({
  log: emptyLog('unknown'),
  record: (tS, phase, event) => set((s) => ({ log: { ...s.log, entries: [...s.log.entries, { tS: Math.round(tS * 10) / 10, phase, event }] } })),
  reset: (scenario, seed) => set({ log: emptyLog(scenario, seed) }),
}))

/** Logs an action of the learner at the engine's current time. */
export function logAction(engine: JourneyEngine, area: Extract<LogEvent, { kind: 'action' }>['area'], what: string, correct?: boolean) {
  useSessionLog.getState().record(engine.worldS, engine.state.phase, { kind: 'action', area, what, correct })
}

/** Records the engine's events into the session log; returns the unsubscribe function. */
export function attachSessionLog(engine: JourneyEngine): () => void {
  let prev = engine.state
  return engine.subscribe(() => {
    const next = engine.state
    if (next === prev) return
    for (const ev of journeyEvents(prev, next)) useSessionLog.getState().record(engine.worldS, next.phase, ev)
    prev = next
  })
}
