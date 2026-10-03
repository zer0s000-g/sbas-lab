/**
 * Reporting to a learning management system with SCORM, from a static page: the LMS
 * that launches the page provides a JavaScript API object in a parent window
 * (SCORM 1.2: `API`; SCORM 2004: `API_1484_11`), found by walking up the parent and
 * opener windows. With no LMS, nothing is sent and the page works as usual.
 */

/** SCORM 1.2 runtime API (the calls this page uses). */
export interface Scorm12Api {
  LMSInitialize(arg: ''): string
  LMSSetValue(name: string, value: string): string
  LMSCommit(arg: ''): string
  LMSFinish(arg: ''): string
}

/** SCORM 2004 runtime API (the calls this page uses). */
export interface Scorm2004Api {
  Initialize(arg: ''): string
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
 * One LMS session: initialised once, then each report sets the score and the status and
 * commits. Every call is guarded: a misbehaving LMS never breaks the page.
 */
export class LmsSession {
  private started = false
  private readonly lms: LmsApi
  constructor(lms: LmsApi) {
    this.lms = lms
  }

  get version() {
    return this.lms.version
  }

  private start(): boolean {
    if (this.started) return true
    try {
      const ok = this.lms.version === '1.2' ? this.lms.api.LMSInitialize('') : this.lms.api.Initialize('')
      this.started = String(ok) === 'true'
    } catch {
      this.started = false
    }
    return this.started
  }

  report(r: LmsReport): boolean {
    if (!this.start()) return false
    const max = Math.max(r.max, 1)
    const raw = Math.min(Math.max(r.raw, 0), max)
    try {
      if (this.lms.version === '1.2') {
        const a = this.lms.api
        a.LMSSetValue('cmi.core.score.min', '0')
        a.LMSSetValue('cmi.core.score.max', String(max))
        a.LMSSetValue('cmi.core.score.raw', String(raw))
        a.LMSSetValue('cmi.core.lesson_status', r.status)
        return String(a.LMSCommit('')) === 'true'
      }
      const a = this.lms.api
      a.SetValue('cmi.score.min', '0')
      a.SetValue('cmi.score.max', String(max))
      a.SetValue('cmi.score.raw', String(raw))
      a.SetValue('cmi.score.scaled', (raw / max).toFixed(4))
      a.SetValue('cmi.completion_status', r.status === 'incomplete' ? 'incomplete' : 'completed')
      a.SetValue('cmi.success_status', r.status === 'incomplete' ? 'unknown' : r.status)
      return String(a.Commit('')) === 'true'
    } catch {
      return false
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
