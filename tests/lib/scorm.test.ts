import { describe, expect, it } from 'vitest'
import { findLmsApi, LmsSession, type Scorm12Api, type Scorm2004Api } from '@/lms/scorm'
import { gradeQuiz, overall } from '@/assessment/assessment'
import { QUESTIONS } from '@/scenarios/essp/questions'
// @ts-expect-error: a plain .mjs build script, no type declarations
import { manifest } from '../../scripts/scorm/lib.mjs'

function mock12() {
  const calls: string[] = []
  const api: Scorm12Api = {
    LMSInitialize: () => (calls.push('init'), 'true'),
    LMSSetValue: (n, v) => (calls.push(`${n}=${v}`), 'true'),
    LMSCommit: () => (calls.push('commit'), 'true'),
    LMSFinish: () => (calls.push('finish'), 'true'),
  }
  return { api, calls }
}

function mock2004() {
  const calls: string[] = []
  const api: Scorm2004Api = {
    Initialize: () => (calls.push('init'), 'true'),
    SetValue: (n, v) => (calls.push(`${n}=${v}`), 'true'),
    Commit: () => (calls.push('commit'), 'true'),
    Terminate: () => (calls.push('terminate'), 'true'),
  }
  return { api, calls }
}

describe('finding the LMS', () => {
  it('finds SCORM 2004 before 1.2, up the parent chain, then from the opener', () => {
    const { api: a12 } = mock12()
    const { api: a04 } = mock2004()
    const top: Record<string, unknown> = { API: a12, API_1484_11: a04 }
    top.parent = top
    const frame = { parent: { parent: top } }
    expect(findLmsApi(frame)?.version).toBe('2004')
    const only12: Record<string, unknown> = { API: a12 }
    only12.parent = only12
    expect(findLmsApi({ parent: only12 })?.version).toBe('1.2')
    expect(findLmsApi({ parent: null, opener: { API: a12 } })?.version).toBe('1.2')
  })
  it('finds nothing without an LMS, and survives a frame it may not read', () => {
    expect(findLmsApi({ parent: null })).toBeNull()
    expect(findLmsApi(null)).toBeNull()
    const hostile = {
      get API(): unknown {
        throw new Error('cross-origin')
      },
    }
    expect(findLmsApi(hostile)).toBeNull()
    // A deep chain: at most 7 levels up.
    let w: Record<string, unknown> = { API: mock12().api }
    for (let i = 0; i < 10; i++) w = { parent: w }
    expect(findLmsApi(w)).toBeNull()
  })
})

describe('reporting to the LMS', () => {
  it('SCORM 1.2: score as a percentage (the manifest masteryscore is one), status, commit; initialises once and finishes', () => {
    const { api, calls } = mock12()
    const s = new LmsSession({ version: '1.2', api })
    expect(s.report({ raw: 11, max: 14, status: 'incomplete' })).toBe(true)
    expect(s.report({ raw: 13, max: 14, status: 'passed' })).toBe(true)
    s.finish()
    expect(calls.filter((c) => c === 'init')).toHaveLength(1)
    expect(calls).toContain('cmi.core.score.raw=93')
    expect(calls).toContain('cmi.core.score.max=100')
    expect(calls).toContain('cmi.core.lesson_status=passed')
    expect(calls.at(-1)).toBe('finish')
  })
  it('SCORM 2004: scaled score, completion and success status', () => {
    const { api, calls } = mock2004()
    const s = new LmsSession({ version: '2004', api })
    s.report({ raw: 7, max: 14, status: 'failed' })
    expect(calls).toContain('cmi.score.scaled=0.5000')
    expect(calls).toContain('cmi.completion_status=completed')
    expect(calls).toContain('cmi.success_status=failed')
    // A fresh session: in one session a later, lower result is not sent.
    new LmsSession({ version: '2004', api }).report({ raw: 3, max: 14, status: 'incomplete' })
    expect(calls).toContain('cmi.completion_status=incomplete')
    expect(calls).toContain('cmi.success_status=unknown')
  })
  it('never reports a lower result than one already reported (reopening a passed quiz)', () => {
    const { api, calls } = mock12()
    const s = new LmsSession({ version: '1.2', api })
    s.report({ raw: 13, max: 14, status: 'passed' })
    const n = calls.length
    expect(s.report({ raw: 9, max: 14, status: 'incomplete' })).toBe(true)
    expect(calls).toHaveLength(n)
    s.report({ raw: 14, max: 14, status: 'passed' })
    expect(calls).toContain('cmi.core.score.raw=100')
  })
  it('a page kept in the back/forward cache commits instead of finishing', () => {
    const { api, calls } = mock12()
    const s = new LmsSession({ version: '1.2', api })
    s.start()
    s.commit()
    expect(calls).toContain('commit')
    expect(calls).not.toContain('finish')
  })
  it('clamps a score out of range, and a failing or throwing LMS never breaks the page', () => {
    const { api, calls } = mock12()
    new LmsSession({ version: '1.2', api }).report({ raw: 99, max: 14, status: 'passed' })
    expect(calls).toContain('cmi.core.score.raw=100')
    const refusing: Scorm12Api = { ...api, LMSInitialize: () => 'false' }
    expect(new LmsSession({ version: '1.2', api: refusing }).report({ raw: 1, max: 2, status: 'failed' })).toBe(false)
    const throwing: Scorm2004Api = { ...mock2004().api, SetValue: () => { throw new Error('LMS error') } }
    expect(new LmsSession({ version: '2004', api: throwing }).report({ raw: 1, max: 2, status: 'failed' })).toBe(false)
  })
})

/** A SCORM 1.2 LMS that keeps its record across launches (the same attempt, resumed). */
function recordingLms(record: Record<string, string>) {
  const api: Scorm12Api = {
    LMSInitialize: () => 'true',
    LMSGetValue: (n) => record[n] ?? '',
    LMSSetValue: (n, v) => ((record[n] = v), 'true'),
    LMSCommit: () => 'true',
    LMSFinish: () => 'true',
  }
  return api
}

describe('what the LMS records', () => {
  it('an incomplete attempt sends no score, so a quiz-only 12/12 cannot reach the mastery score', () => {
    const quiz = gradeQuiz(QUESTIONS, QUESTIONS.map((q) => q.answer))
    const total = overall(quiz, null, QUESTIONS.length)
    expect(total.status).toBe('incomplete')
    const record: Record<string, string> = {}
    new LmsSession({ version: '1.2', api: recordingLms(record) }).report({ raw: total.raw, max: total.max, status: total.status })
    const mastery = Number(/<adlcp:masteryscore>(\d+)<\/adlcp:masteryscore>/.exec(manifest({ title: 't', files: ['index.html'] }))![1])
    expect(mastery).toBe(80)
    expect(record['cmi.core.lesson_status']).toBe('incomplete')
    expect(record['cmi.core.score.raw']).toBeUndefined()
    // SCORM 2004: the same, completion incomplete, success unknown, no score.
    const { api, calls } = mock2004()
    new LmsSession({ version: '2004', api }).report({ raw: 12, max: 14, status: 'incomplete' })
    expect(calls.some((c) => c.startsWith('cmi.score.'))).toBe(false)
  })

  it('a relaunch never lowers the status or score the LMS already holds', () => {
    const record: Record<string, string> = {}
    const first = new LmsSession({ version: '1.2', api: recordingLms(record) })
    first.report({ raw: 14, max: 14, status: 'passed' })
    first.finish()
    expect(record['cmi.core.lesson_status']).toBe('passed')
    // Launch 2, a new page load: the learner checks the quiz again, then passes with less.
    record['cmi.core.entry'] = 'resume'
    const second = new LmsSession({ version: '1.2', api: recordingLms(record) })
    expect(second.report({ raw: 12, max: 14, status: 'incomplete' })).toBe(true)
    second.report({ raw: 12, max: 14, status: 'passed' })
    expect(record['cmi.core.lesson_status']).toBe('passed')
    expect(record['cmi.core.score.raw']).toBe('100')
    // A recorded fail may become a pass, and "completed" is not undone by "incomplete".
    const failed: Record<string, string> = { 'cmi.core.lesson_status': 'failed', 'cmi.core.score.raw': '50' }
    const third = new LmsSession({ version: '1.2', api: recordingLms(failed) })
    third.report({ raw: 5, max: 14, status: 'failed' })
    expect(failed['cmi.core.score.raw']).toBe('50')
    third.report({ raw: 13, max: 14, status: 'passed' })
    expect(failed['cmi.core.lesson_status']).toBe('passed')
    const completed: Record<string, string> = { 'cmi.core.lesson_status': 'completed' }
    new LmsSession({ version: '1.2', api: recordingLms(completed) }).report({ raw: 3, max: 14, status: 'incomplete' })
    expect(completed['cmi.core.lesson_status']).toBe('completed')
  })

  it('SCORM 2004: a recorded pass is kept on relaunch', () => {
    const record: Record<string, string> = { 'cmi.success_status': 'passed', 'cmi.completion_status': 'completed', 'cmi.score.scaled': '1' }
    const calls: string[] = []
    const api: Scorm2004Api = { ...mock2004().api, GetValue: (n) => record[n] ?? '', SetValue: (n, v) => (calls.push(`${n}=${v}`), 'true') }
    new LmsSession({ version: '2004', api }).report({ raw: 12, max: 14, status: 'incomplete' })
    expect(calls).toEqual([])
  })

  it('writes nothing when launched for review, browsing or no credit, and still works', () => {
    const launches: Record<string, string>[] = [{ 'cmi.core.lesson_mode': 'review' }, { 'cmi.core.lesson_mode': 'browse' }, { 'cmi.core.credit': 'no-credit' }]
    for (const launch of launches) {
      const record: Record<string, string> = { ...launch }
      const s = new LmsSession({ version: '1.2', api: recordingLms(record) })
      expect(s.report({ raw: 14, max: 14, status: 'passed' })).toBe(true)
      expect(s.recording).toBe(false)
      expect(record).toEqual(launch)
    }
    const normal = new LmsSession({ version: '1.2', api: recordingLms({ 'cmi.core.lesson_mode': 'normal', 'cmi.core.credit': 'credit' }) })
    normal.start()
    expect(normal.recording).toBe(true)
    // An LMS without a getter (or one that throws) is taken as an empty record.
    const throwing = { ...recordingLms({}), LMSGetValue: () => { throw new Error('LMS error') } }
    expect(new LmsSession({ version: '1.2', api: throwing }).report({ raw: 14, max: 14, status: 'passed' })).toBe(true)
  })
})
