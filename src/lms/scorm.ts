/**
 * Reporting to a learning management system with SCORM, from a static page: the LMS
 * that launches the page provides a JavaScript API object in a parent window
 * (SCORM 1.2: `API`; SCORM 2004: `API_1484_11`), found by walking up the parent and
 * opener windows. With no LMS, nothing is sent and the page works as usual.
 */

/**
 * SCORM 1.2 runtime API (the calls this page uses). Every conformant LMS provides
 * LMSGetValue; it is optional here only so that a partial API never breaks the page (no
 * getter: the LMS record is taken as empty).
 */
export interface Scorm12Api {
  LMSInitialize(arg: ''): string
  LMSGetValue?(name: string): string
  LMSSetValue(name: string, value: string): string
  LMSCommit(arg: ''): string
  LMSFinish(arg: ''): string
}

/** SCORM 2004 runtime API (the calls this page uses; GetValue optional as above). */
export interface Scorm2004Api {
  Initialize(arg: ''): string
  GetValue?(name: string): string
  SetValue(name: string, value: string): string
  Commit(arg: ''): string
  Terminate(arg: ''): string
}

export type LmsApi = { version: '1.2'; api: Scorm12Api } | { version: '2004'; api: Scorm2004Api }

interface WindowLike {
  API?: unknown
  API_1484_11?: unknown
  parent?: WindowLike | null
  opener?: WindowLike | null
}

const is2004 = (x: unknown): x is Scorm2004Api => !!x && typeof (x as Scorm2004Api).Initialize === 'function' && typeof (x as Scorm2004Api).SetValue === 'function'
const is12 = (x: unknown): x is Scorm12Api => !!x && typeof (x as Scorm12Api).LMSInitialize === 'function' && typeof (x as Scorm12Api).LMSSetValue === 'function'

/** The LMS API, searched from this window up its parents (at most 7 levels, as SCORM's discovery advises), then from its opener. */
export function findLmsApi(win: WindowLike | null | undefined): LmsApi | null {
  const search = (start: WindowLike | null | undefined): LmsApi | null => {
    let w = start
    for (let depth = 0; w && depth <= 7; depth++) {
      try {
        if (is2004(w.API_1484_11)) return { version: '2004', api: w.API_1484_11 }
        if (is12(w.API)) return { version: '1.2', api: w.API }
      } catch {
        return null // a cross-origin frame: not ours to read
      }
      if (!w.parent || w.parent === w) break
      w = w.parent
    }
    return null
  }
  try {
    return search(win) ?? search(win?.opener)
  } catch {
    return null
  }
}

export interface LmsReport {
  /** Points scored and possible. */
  raw: number
  max: number
  status: 'incomplete' | 'passed' | 'failed'
}

/**
 * How far a result has got: incomplete < failed (or completed) < passed. A report whose
 * rank is lower than the best one known, or whose score is lower at the same final rank,
 * is not sent.
 */
interface Mark {
  rank: number
  /** Score as a share of the maximum, 0..1. */
  share: number
}
const STATUS_RANK: Record<LmsReport['status'], number> = { incomplete: 0, failed: 1, passed: 2 }

const lower = (m: Mark, best: Mark | null) => !!best && (m.rank < best.rank || (m.rank > 0 && m.rank === best.rank && m.share < best.share))

/** A share 0..1 from an LMS value, or 0 when it is empty or not a number. */
const shareOf = (value: string, scale: number) => {
  const n = Number(value)
  return value.trim() !== '' && Number.isFinite(n) ? Math.min(Math.max(n / scale, 0), 1) : 0
}

/**
 * The result the LMS already holds for this attempt, read once at initialise (the cmi
 * data model of the SCORM 1.2 and SCORM 2004 run-time environments):
 * - SCORM 1.2 cmi.core.lesson_status is one of "passed", "completed", "failed",
 *   "incomplete", "browsed", "not attempted"; cmi.core.score.raw is our 0–100 percentage.
 * - SCORM 2004 cmi.success_status is "passed" | "failed" | "unknown" and
 *   cmi.completion_status "completed" | "incomplete" | "not attempted" | "unknown";
 *   cmi.score.scaled is -1..1.
 * "completed" ranks with "failed": a later incomplete must not undo it, a pass or a fail
 * (a completed attempt with a verdict) may replace it.
 */
function recordedMark(lms: LmsApi, get: (name: string) => string): Mark | null {
  if (lms.version === '1.2') {
    const status = get('cmi.core.lesson_status')
    const rank = status === 'passed' ? 2 : status === 'failed' || status === 'completed' ? 1 : 0
    return rank ? { rank, share: shareOf(get('cmi.core.score.raw'), 100) } : null
  }
  const success = get('cmi.success_status')
  const rank = success === 'passed' ? 2 : success === 'failed' || get('cmi.completion_status') === 'completed' ? 1 : 0
  return rank ? { rank, share: shareOf(get('cmi.score.scaled'), 1) } : null
}

/**
 * One LMS session: initialised once, then each report sets the score and the status and
 * commits. Every call is guarded: a misbehaving LMS never breaks the page.
 *
 * At initialise the session reads what the LMS holds, because a relaunch is a new page
 * load and inside an LMS the page deliberately does not restore saved progress: without
 * this, the first report of the new launch (say, the quiz only) would turn an LMS record
 * of "passed" back to "incomplete". So:
 * - the LMS's own recorded status and score are a floor: a lower result is never sent
 *   (the same rule as within one launch, where reopening a passed quiz to review it must
 *   not undo the pass);
 * - in "browse" or "review" mode (1.2 cmi.core.lesson_mode, 2004 cmi.mode) or when the
 *   attempt is taken for no credit (cmi.core.credit / cmi.credit = "no-credit") nothing
 *   is written at all. Those element names and vocabularies are the SCORM RTE data
 *   model; writing nothing in these cases is this page's conservative choice (the RTE
 *   lets the LMS keep the learner's record unchanged in review and no-credit launches),
 *   so the page can be reviewed freely and never alters a record it should not.
 */
export class LmsSession {
  private started = false
  private readonly lms: LmsApi
  /** The best result known: what the LMS held at launch, then what this session sent. */
  private best: Mark | null = null
  private writes = true
  constructor(lms: LmsApi) {
    this.lms = lms
  }

  get version() {
    return this.lms.version
  }

  /**
   * Whether results are written: false when the LMS launched the page for browsing,
   * review or no credit (known once the session has started).
   */
  get recording(): boolean {
    return this.started && this.writes
  }

  /** Initialise the session (at launch, so the LMS sees the attempt even without a result). */
  start(): boolean {
    if (this.started) return true
    try {
      const ok = this.lms.version === '1.2' ? this.lms.api.LMSInitialize('') : this.lms.api.Initialize('')
      this.started = String(ok) === 'true'
    } catch {
      this.started = false
    }
    if (this.started) this.readRecord()
    return this.started
  }

  /** What the LMS holds for this attempt and how it launched the page (see the class comment). */
  private readRecord() {
    const lms = this.lms
    const get = (name: string): string => {
      try {
        const v = lms.version === '1.2' ? lms.api.LMSGetValue?.(name) : lms.api.GetValue?.(name)
        return typeof v === 'string' ? v : v == null ? '' : String(v)
      } catch {
        return ''
      }
    }
    const mode = get(lms.version === '1.2' ? 'cmi.core.lesson_mode' : 'cmi.mode')
    const credit = get(lms.version === '1.2' ? 'cmi.core.credit' : 'cmi.credit')
    this.writes = mode !== 'browse' && mode !== 'review' && credit !== 'no-credit'
    this.best = recordedMark(lms, get)
  }

  /**
   * Sends a result. An incomplete attempt is sent as a status only, with no score: the
   * page's running total counts the part not yet done as zero, and in SCORM 1.2 the LMS
   * may set the status itself by comparing cmi.core.score.raw with the manifest's
   * adlcp:masteryscore (80), so a quiz-only 12 of 14 (86 %) could be recorded as
   * "passed" without the exam. The score goes with the final status (passed or failed),
   * once both parts are done. Returns true when there was nothing to send.
   */
  report(r: LmsReport): boolean {
    if (!this.start()) return false
    if (!this.writes) return true
    const max = Math.max(r.max, 1)
    const raw = Math.min(Math.max(r.raw, 0), max)
    const mark: Mark = { rank: STATUS_RANK[r.status], share: raw / max }
    if (lower(mark, this.best)) return true
    this.best = mark
    const scored = r.status !== 'incomplete'
    try {
      if (this.lms.version === '1.2') {
        const a = this.lms.api
        // SCORM 1.2 scores are 0–100 and the LMS compares them with the manifest's
        // masteryscore (a percentage), so the score is sent as a percentage.
        if (scored) {
          a.LMSSetValue('cmi.core.score.min', '0')
          a.LMSSetValue('cmi.core.score.max', '100')
          a.LMSSetValue('cmi.core.score.raw', String(Math.round(100 * mark.share)))
        }
        a.LMSSetValue('cmi.core.lesson_status', r.status)
        return String(a.LMSCommit('')) === 'true'
      }
      const a = this.lms.api
      if (scored) {
        a.SetValue('cmi.score.min', '0')
        a.SetValue('cmi.score.max', String(max))
        a.SetValue('cmi.score.raw', String(raw))
        a.SetValue('cmi.score.scaled', mark.share.toFixed(4))
      }
      a.SetValue('cmi.completion_status', scored ? 'completed' : 'incomplete')
      a.SetValue('cmi.success_status', scored ? r.status : 'unknown')
      return String(a.Commit('')) === 'true'
    } catch {
      return false
    }
  }

  /** Save what has been reported so far. */
  commit(): void {
    if (!this.started) return
    try {
      if (this.lms.version === '1.2') this.lms.api.LMSCommit('')
      else this.lms.api.Commit('')
    } catch {
      /* the LMS is gone */
    }
  }

  finish(): void {
    if (!this.started) return
    try {
      if (this.lms.version === '1.2') this.lms.api.LMSFinish('')
      else this.lms.api.Terminate('')
    } catch {
      /* the LMS is gone */
    }
    this.started = false
  }
}

let pageSession: LmsSession | null | undefined
/**
 * The page's one LMS session (SCORM allows one initialise and one finish per launch):
 * found on first use, finished when the page goes away. Null when there is no LMS.
 */
export function pageLmsSession(): LmsSession | null {
  if (pageSession !== undefined) return pageSession
  if (typeof window === 'undefined') return null
  const found = findLmsApi(window as unknown as WindowLike)
  pageSession = found ? new LmsSession(found) : null
  if (pageSession) {
    const session = pageSession
    window.addEventListener('pagehide', (e) => {
      // A page kept in the back/forward cache may come back: commit only, so the session
      // can carry on (an LMS rejects a second initialise after finish).
      if (e.persisted) session.commit()
      else session.finish()
    })
  }
  return pageSession
}

/** For tests: forget the page's session. */
export function resetPageLmsSession() {
  pageSession = undefined
}
