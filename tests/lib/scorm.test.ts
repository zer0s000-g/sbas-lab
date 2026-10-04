import { describe, expect, it } from 'vitest'
import { findLmsApi, LmsSession, type Scorm12Api, type Scorm2004Api } from '@/lms/scorm'

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
  it('SCORM 1.2: score, status, commit; initialises once and finishes', () => {
    const { api, calls } = mock12()
    const s = new LmsSession({ version: '1.2', api })
    expect(s.report({ raw: 11, max: 14, status: 'incomplete' })).toBe(true)
    expect(s.report({ raw: 13, max: 14, status: 'passed' })).toBe(true)
    s.finish()
    expect(calls.filter((c) => c === 'init')).toHaveLength(1)
    expect(calls).toContain('cmi.core.score.raw=13')
    expect(calls).toContain('cmi.core.score.max=14')
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
    s.report({ raw: 3, max: 14, status: 'incomplete' })
    expect(calls).toContain('cmi.completion_status=incomplete')
    expect(calls).toContain('cmi.success_status=unknown')
  })
  it('clamps a score out of range, and a failing or throwing LMS never breaks the page', () => {
    const { api, calls } = mock12()
    new LmsSession({ version: '1.2', api }).report({ raw: 99, max: 14, status: 'passed' })
    expect(calls).toContain('cmi.core.score.raw=14')
    const refusing: Scorm12Api = { ...api, LMSInitialize: () => 'false' }
    expect(new LmsSession({ version: '1.2', api: refusing }).report({ raw: 1, max: 2, status: 'failed' })).toBe(false)
    const throwing: Scorm2004Api = { ...mock2004().api, SetValue: () => { throw new Error('LMS error') } }
    expect(new LmsSession({ version: '2004', api: throwing }).report({ raw: 1, max: 2, status: 'failed' })).toBe(false)
  })
})
