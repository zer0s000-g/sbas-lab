// @vitest-environment jsdom
/**
 * The assessment panel, rendered with a real journey engine and a mock SCORM 1.2 LMS:
 * the quiz, the exam hiding a failure in the journey, the result, and what reaches the LMS.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JourneyEngine } from '@/journey/engine'
import { AssessmentPanel } from '@/page/essp/AssessmentPanel'
import { sanitizeAssessment, useAssessment } from '@/page/essp/assessmentStore'
import { useExamLock } from '@/page/essp/examLock'
import { QUESTIONS } from '@/scenarios/essp/questions'
import { FAILURES } from '@/journey/failures'
import type { Scorm12Api } from '@/lms/scorm'

const calls: string[] = []
const api: Scorm12Api = {
  LMSInitialize: () => (calls.push('init'), 'true'),
  LMSSetValue: (n, v) => (calls.push(`${n}=${v}`), 'true'),
  LMSCommit: () => (calls.push('commit'), 'true'),
  LMSFinish: () => (calls.push('finish'), 'true'),
}

beforeEach(() => {
  act(() => useAssessment.setState({ quizAnswers: [], quizChecked: false, lastExam: null }))
  calls.length = 0
})
afterEach(() => {
  cleanup()
  delete (window as unknown as { API?: unknown }).API
  act(() => useExamLock.getState().setLocked(false))
})

const answerQuiz = () => {
  QUESTIONS.forEach((q) => fireEvent.click(screen.getByRole('radio', { name: q.options[q.answer] })))
  fireEvent.click(screen.getByRole('button', { name: 'Check my answers' }))
}

describe('the assessment panel', () => {
  it('marks the quiz, explains each answer, and keeps the answers', () => {
    render(<AssessmentPanel engine={new JourneyEngine({ guidedStops: false, running: false })} />)
    answerQuiz()
    expect(screen.getByText(`${QUESTIONS.length} / ${QUESTIONS.length} right`)).toBeTruthy()
    expect(screen.getAllByText('Right')).toHaveLength(QUESTIONS.length)
    expect(useAssessment.getState().quizChecked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(useAssessment.getState().quizAnswers).toEqual([])
  })

  it('runs an exam: a hidden failure on final, Break something locked, then marked and mended', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<AssessmentPanel engine={e} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Exam' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the exam' }))
    expect(e.state.phase).toBe('final')
    const on = FAILURES.filter((f) => e.state.failures[f.id])
    expect(on).toHaveLength(1)
    expect(useExamLock.getState().locked).toBe(true)
    // Answer right: the failure that is on, and its response.
    fireEvent.click(screen.getByRole('radio', { name: on[0].label }))
    fireEvent.click(screen.getByRole('radio', { name: on[0].crewAtc }))
    fireEvent.click(screen.getByRole('button', { name: 'Hand in the exam' }))
    expect(FAILURES.some((f) => e.state.failures[f.id])).toBe(false)
    expect(useExamLock.getState().locked).toBe(false)
    expect(screen.getByText(/Exam: 2 \/ 2/)).toBeTruthy()
    expect(screen.getByText(/Incomplete: do the quiz and the exam/)).toBeTruthy()
  })

  it('reports to the LMS that launched it: incomplete after the quiz, passed after the exam', () => {
    ;(window as unknown as { API: Scorm12Api }).API = api
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<AssessmentPanel engine={e} />)
    answerQuiz()
    expect(calls).toContain('cmi.core.lesson_status=incomplete')
    fireEvent.click(screen.getByRole('radio', { name: 'Exam' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start the exam' }))
    const f = FAILURES.find((x) => e.state.failures[x.id])!
    fireEvent.click(screen.getByRole('radio', { name: f.label }))
    fireEvent.click(screen.getByRole('radio', { name: f.crewAtc }))
    fireEvent.click(screen.getByRole('button', { name: 'Hand in the exam' }))
    expect(calls).toContain(`cmi.core.score.raw=${QUESTIONS.length + 2}`)
    expect(calls).toContain('cmi.core.lesson_status=passed')
    expect(screen.getByText(/Result sent to your learning management system/)).toBeTruthy()
    cleanup()
    expect(calls.at(-1)).toBe('finish')
  })

  it('without an LMS, says the results stay in the browser', () => {
    render(<AssessmentPanel engine={new JourneyEngine({ guidedStops: false, running: false })} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Result' }))
    expect(screen.getByText(/results stay in this browser/)).toBeTruthy()
  })
})

describe('saved assessment progress', () => {
  it('keeps only well-formed fields', () => {
    expect(sanitizeAssessment({ quizAnswers: [1, 'x', -1, 2.5, 3], quizChecked: 'yes', lastExam: { seed: 5, what: 'storm', action: 'nope' } })).toEqual({ quizAnswers: [1, null, null, null, 3] })
    expect(sanitizeAssessment({ lastExam: { seed: 5, what: 'storm', action: null }, quizChecked: true })).toEqual({ quizChecked: true, lastExam: { seed: 5, what: 'storm', action: null } })
    expect(sanitizeAssessment('garbage')).toEqual({})
  })
})
