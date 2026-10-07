/**
 * The learner's assessment progress in the ESSP-SAS scenario, kept in this browser
 * (safeStorage, with a validating merge): the quiz answers and whether they were
 * checked, and the last exam's seed and answers. A running exam is not saved: the
 * journey it runs in is not, so a reload abandons it. Launched from an LMS, saved
 * progress is not restored (see the merge).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ALL_FAILURE_IDS, type FailureId } from '@/journey/failures'
import { isRecord, safeStorage } from '@/stores/storage'
import { pageLmsSession } from '@/lms/scorm'
import { IN_FLIGHT_RESPONSES } from '@/scenarios/essp/examResponses'

export interface DoneExam {
  seed: number
  what: FailureId | null
  /** The chosen in-flight response (src/scenarios/essp/examResponses.ts). */
  action: string | null
}

interface AssessmentState {
  quizAnswers: (number | null)[]
  quizChecked: boolean
  lastExam: DoneExam | null
  setAnswer: (i: number, a: number) => void
  checkQuiz: () => void
  retryQuiz: () => void
  saveExam: (e: DoneExam) => void
}

type Saved = Pick<AssessmentState, 'quizAnswers' | 'quizChecked' | 'lastExam'>

const isFailure = (v: unknown): v is FailureId => typeof v === 'string' && (ALL_FAILURE_IDS as readonly string[]).includes(v)
/** An exam saved before the responses had their own ids (a failure id) no longer matches one: it is dropped. */
const isResponse = (v: unknown): v is string => typeof v === 'string' && IN_FLIGHT_RESPONSES.some((r) => r.id === v)

/** Saved progress, keeping only well-formed fields. */
export function sanitizeAssessment(raw: unknown): Partial<Saved> {
  if (!isRecord(raw)) return {}
  const out: Partial<Saved> = {}
  if (Array.isArray(raw.quizAnswers) && raw.quizAnswers.length <= 64) out.quizAnswers = raw.quizAnswers.map((a) => (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < 16 ? a : null))
  if (typeof raw.quizChecked === 'boolean') out.quizChecked = raw.quizChecked
  const e = raw.lastExam
  if (e === null) out.lastExam = null
  else if (isRecord(e) && typeof e.seed === 'number' && Number.isInteger(e.seed) && (e.what === null || isFailure(e.what)) && (e.action === null || isResponse(e.action))) out.lastExam = { seed: e.seed, what: e.what as FailureId | null, action: e.action as string | null }
  return out
}

export const useAssessment = create<AssessmentState>()(
  persist(
    (set) => ({
      quizAnswers: [],
      quizChecked: false,
      lastExam: null,
      setAnswer: (i, a) =>
        set((s) => {
          const quizAnswers = [...s.quizAnswers]
          while (quizAnswers.length <= i) quizAnswers.push(null)
          quizAnswers[i] = a
          return { quizAnswers }
        }),
      checkQuiz: () => set({ quizChecked: true }),
      retryQuiz: () => set({ quizChecked: false, quizAnswers: [] }),
      saveExam: (lastExam) => set({ lastExam }),
    }),
    {
      name: 'sbaslab.essp.assessment',
      storage: safeStorage,
      version: 1,
      partialize: (s): Saved => ({ quizAnswers: s.quizAnswers, quizChecked: s.quizChecked, lastExam: s.lastExam }),
      // Inside a learning management system this browser may be shared by several learners:
      // results saved here are someone's earlier attempt, never this learner's to report.
      merge: (persisted, current) => (pageLmsSession() ? current : { ...current, ...sanitizeAssessment(persisted) }),
    },
  ),
)
