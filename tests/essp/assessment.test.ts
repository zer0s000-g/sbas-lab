/**
 * The ESSP-SAS assessment: the question bank rests on claims, the exam is deterministic
 * for its seed and always solvable from the journey, and the marks add up.
 */
import { describe, expect, it } from 'vitest'
import { EXAMABLE, examPlan, gradeExam, gradeQuiz, overall, PASS_MARK } from '@/assessment/assessment'
import { OBJECTIVES, QUESTIONS } from '@/scenarios/essp/questions'
import { claim } from '@/content/claims'
import { FAILURES } from '@/journey/failures'
import { JourneyEngine } from '@/journey/engine'
import { viewModel } from '@/page/model'

describe('the ESSP-SAS question bank', () => {
  it('has unique ids, four options, a valid answer and an objective for each question', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size, q.id).toBe(4)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(4)
      expect(OBJECTIVES.some((o) => o.id === q.objective), q.id).toBe(true)
    }
    for (const o of OBJECTIVES) expect(QUESTIONS.some((q) => q.objective === o.id), o.id).toBe(true)
  })
  it('every answer rests on claims that exist and belong to the scenario', () => {
    for (const q of QUESTIONS) {
      expect(q.claims.length, q.id).toBeGreaterThan(0)
      for (const id of q.claims) {
        expect(claim(id), `${q.id} → ${id}`).toBeDefined()
        expect(claim(id)!.scenarios).toContain('essp')
      }
    }
  })
  it('marks right, wrong and unanswered questions, ignoring answers out of range', () => {
    const answers = QUESTIONS.map((q, i) => (i === 0 ? null : i === 1 ? (q.answer + 1) % 4 : i === 2 ? 9 : q.answer))
    const r = gradeQuiz(QUESTIONS, answers)
    expect(r.max).toBe(QUESTIONS.length)
    expect(r.correct).toBe(QUESTIONS.length - 3)
    expect(r.marks.slice(0, 3)).toEqual([null, false, null])
  })
})

describe('the exam', () => {
  it('is the same exam for the same seed, and hides one of the failures the scenario offers', () => {
    for (let seed = 1; seed < 200; seed++) {
      const a = examPlan(seed, FAILURES)
      expect(examPlan(seed, FAILURES)).toEqual(a)
      expect(EXAMABLE).toContain(a.failure)
      expect(FAILURES.some((f) => f.id === a.failure)).toBe(true)
      for (const opts of [a.whatOptions, a.actionOptions]) {
        expect(opts).toHaveLength(4)
        expect(new Set(opts).size).toBe(4)
        expect(opts).toContain(a.failure)
      }
    }
  })
  it('over many seeds, every examable failure is used', () => {
    const seen = new Set(Array.from({ length: 300 }, (_, i) => examPlan(i + 1, FAILURES).failure))
    expect([...seen].sort()).toEqual([...EXAMABLE].sort())
  })
  it('every hidden failure shows on the panels on final: the learner can find it', () => {
    for (const id of EXAMABLE) {
      const e = new JourneyEngine({ guidedStops: false, running: false })
      e.jumpTo('final')
      const before = viewModel(e)
      e.setFailure(id, true)
      // Let the world run 20 s (a lost GEO times out after 12 s).
      for (let i = 0; i < 400 && e.state.phase === 'final'; i++) {
        e.play()
        e.advance(0.05)
      }
      const after = viewModel(e)
      const changed = after.mode !== before.mode || after.alarmed.length > 0 || after.navSource !== before.navSource || after.geosTracked !== before.geosTracked
      expect(changed, id).toBe(true)
    }
  })
  it('marks the two exam questions', () => {
    const p = examPlan(42, FAILURES)
    const other = p.whatOptions.find((x) => x !== p.failure)!
    expect(gradeExam(p, p.failure, p.failure)).toMatchObject({ correct: 2, max: 2 })
    expect(gradeExam(p, other, p.failure)).toMatchObject({ correct: 1, whatRight: false, actionRight: true })
    expect(gradeExam(p, null, null).correct).toBe(0)
  })
  it('passes at 80 % of the quiz and exam points together, and is incomplete until both are done', () => {
    const q = gradeQuiz(QUESTIONS, QUESTIONS.map((x) => x.answer))
    const p = examPlan(7, FAILURES)
    expect(overall(q, null, QUESTIONS.length).status).toBe('incomplete')
    expect(overall(null, gradeExam(p, p.failure, p.failure), QUESTIONS.length).status).toBe('incomplete')
    const all = overall(q, gradeExam(p, p.failure, p.failure), QUESTIONS.length)
    expect(all).toMatchObject({ raw: QUESTIONS.length + 2, max: QUESTIONS.length + 2, scaled: 1, status: 'passed' })
    const weak = gradeQuiz(QUESTIONS, QUESTIONS.map((x, i) => (i < 6 ? x.answer : null)))
    expect(overall(weak, gradeExam(p, null, null), QUESTIONS.length).status).toBe('failed')
    expect(PASS_MARK).toBe(0.8)
  })
})
