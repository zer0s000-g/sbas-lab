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

export interface ExamPlan {
  seed: number
  /** The failure hidden in the journey. */
  failure: FailureId
  /** The phase the exam starts in; the failure is switched on there. */
  phase: PhaseId
  /** "What failed?": four failures, one of them the hidden one. */
  whatOptions: FailureId[]
  /** "What do the crew and ATC do?": the responses of four failures, one the hidden one's. */
  actionOptions: FailureId[]
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

/** The exam for a seed, from the failures the scenario offers. */
export function examPlan(seed: number, offered: readonly FailureDef[]): ExamPlan {
  const pool = EXAMABLE.filter((id) => offered.some((f) => f.id === id))
  if (pool.length < 4) throw new Error('an exam needs at least four failures')
  const rand = mulberry32(seed)
  const failure = pool[Math.floor(rand() * pool.length)]
  const pick = () => shuffled([failure, ...shuffled(pool.filter((id) => id !== failure), rand).slice(0, 3)], rand)
  return { seed, failure, phase: 'final', whatOptions: pick(), actionOptions: pick() }
}

export interface ExamResult {
  correct: number
  max: number
  whatRight: boolean
  actionRight: boolean
}

export function gradeExam(plan: ExamPlan, what: FailureId | null, action: FailureId | null): ExamResult {
  const whatRight = what === plan.failure
  const actionRight = action === plan.failure
  return { correct: Number(whatRight) + Number(actionRight), max: 2, whatRight, actionRight }
}

/** The share of the points needed to pass. */
export const PASS_MARK = 0.8

export interface Overall {
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
