/**
 * The assessment: a quiz whose answers each rest on claims (src/content/claims), and an
 * exam that hides a failure in the journey for the learner to find and handle. Pure and
 * deterministic: an exam is a function of its seed (CLAUDE.md: randomness only through
 * a seeded generator), so a learner, a trainer and a test see the same exam for a seed.
 */
import { mulberry32 } from '@/core/random'
import type { FailureDef, FailureId } from '@/journey/failures'
import type { PhaseId } from '@/journey/phases'

export interface Question {
  id: string
  prompt: string
  options: readonly string[]
  /** Index of the right option. */
  answer: number
  /** Why, in plain words. */
  explain: string
  claims: readonly string[]
  /** The learning objective it checks (ObjectiveId). */
  objective: string
}

/** A question as authored: the right answer first, which makes the bank easy to review. */
export type AuthoredQuestion = Omit<Question, 'answer'>

/** A stable seed from an id. */
function seedOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return h
}

/**
 * The question as shown: its options in an order fixed by its id (so the right answer is
 * not always first, and every learner sees the same order), and the answer's new index.
 */
export function presentQuestion(q: AuthoredQuestion): Question {
  const order = shuffled(
    q.options.map((_, i) => i),
    mulberry32(seedOf(q.id)),
  )
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(0) }
}

export interface Objective {
  id: string
  text: string
}

export interface QuizResult {
  correct: number
  max: number
  /** Per question: right, wrong, or not answered (null). */
  marks: (boolean | null)[]
}

/** Mark the quiz. An answer out of range counts as not answered. */
export function gradeQuiz(questions: readonly Question[], answers: readonly (number | null | undefined)[]): QuizResult {
  const marks = questions.map((q, i) => {
    const a = answers[i]
    return typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < q.options.length ? a === q.answer : null
  })
  return { correct: marks.filter((m) => m === true).length, max: questions.length, marks }
}

/**
 * An answer to "LAB201 is on final: what do the crew and the controller do now?". On final
 * the crew act on what the cockpit shows, not on the cause, so a response is right for
 * every failure that looks the same there (several failures can share one), and each
 * examable failure has exactly one right response. A response right for none is a
 * distractor.
 */
export interface InFlightResponse {
  id: string
  /** What the crew see on final when this is the right response; for a distractor, why it is never right. */
  seen: string
  /** The response, in plain words. */
  text: string
  /** The failures it is the right response to, on final. */
  rightFor: readonly FailureId[]
  claims: readonly string[]
}

export interface ExamPlan {
  seed: number
  /** The failure hidden in the journey. */
  failure: FailureId
  /** The phase the exam starts in; the failure is switched on there. */
  phase: PhaseId
  /** "What failed?": four failures, one of them the hidden one. */
  whatOptions: FailureId[]
  /** "What do the crew and ATC do?": four distinct responses (InFlightResponse ids), exactly one right. */
  actionOptions: string[]
  /** The right response for the hidden failure, one of actionOptions. */
  action: string
}

/** Failures an exam can hide: each shows on the panels during the final approach. */
export const EXAMABLE: readonly FailureId[] = ['clockJump', 'geoLost', 'storm', 'stationOffline', 'jamming', 'sbasOff']

function shuffled<T>(xs: readonly T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The response that is right for a failure on final; throws unless exactly one is. */
export function rightResponse(failure: FailureId, responses: readonly InFlightResponse[]): InFlightResponse {
  const right = responses.filter((r) => r.rightFor.includes(failure))
  if (right.length !== 1) throw new Error(`${failure}: ${right.length} right responses on final, not one`)
  return right[0]
}

/**
 * The exam for a seed, from the failures the scenario offers and its in-flight responses.
 * The hidden failure and the "What failed?" options depend on the seed only, so an
 * instructor's `?seed=` link hides the same failure for everyone. "What do the crew and
 * ATC do?" offers the hidden failure's one right response and three others that are not
 * right for it, so exactly one option is right.
 */
export function examPlan(seed: number, offered: readonly FailureDef[], responses: readonly InFlightResponse[]): ExamPlan {
  const pool = EXAMABLE.filter((id) => offered.some((f) => f.id === id))
  if (pool.length < 4) throw new Error('an exam needs at least four failures')
  const rand = mulberry32(seed)
  const failure = pool[Math.floor(rand() * pool.length)]
  const whatOptions = shuffled([failure, ...shuffled(pool.filter((id) => id !== failure), rand).slice(0, 3)], rand)
  const action = rightResponse(failure, responses).id
  const wrong = responses.filter((r) => r.id !== action).map((r) => r.id)
  if (wrong.length < 3) throw new Error('the exam needs at least three wrong responses')
  const actionOptions = shuffled([action, ...shuffled(wrong, rand).slice(0, 3)], rand)
  return { seed, failure, phase: 'final', whatOptions, actionOptions, action }
}

export interface ExamResult {
  correct: number
  max: number
  whatRight: boolean
  actionRight: boolean
}

/** Marks the exam: `action` is the id of the chosen InFlightResponse. */
export function gradeExam(plan: ExamPlan, what: FailureId | null, action: string | null): ExamResult {
  const whatRight = what === plan.failure
  const actionRight = action === plan.action
  return { correct: Number(whatRight) + Number(actionRight), max: 2, whatRight, actionRight }
}

/** The share of the points needed to pass. */
export const PASS_MARK = 0.8

export interface Overall {
  /**
   * Points so far, a part not done counting zero: a running total for the page. It is
   * not a result until the status is final, so an LMS gets no score while incomplete
   * (src/lms/scorm.ts, LmsSession.report).
   */
  raw: number
  max: number
  /** raw / max, 0..1. */
  scaled: number
  /** Incomplete until both the quiz and the exam are done. */
  status: 'incomplete' | 'passed' | 'failed'
}

export function overall(quiz: QuizResult | null, exam: ExamResult | null, quizMax: number): Overall {
  const raw = (quiz?.correct ?? 0) + (exam?.correct ?? 0)
  const max = quizMax + 2
  const scaled = max > 0 ? raw / max : 0
  const status = !quiz || !exam ? 'incomplete' : scaled >= PASS_MARK ? 'passed' : 'failed'
  return { raw, max, scaled, status }
}
