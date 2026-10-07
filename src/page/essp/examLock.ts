/**
 * The running exam, kept outside the assessment panel so it survives the panel being
 * unmounted (a phone's tabs unmount the panels they hide): the plan, the answers so far,
 * and whether the failures are the exam's. While it runs, the Break panel and the service
 * panel must not show which failure is on.
 */
import { create } from 'zustand'
import type { ExamPlan } from '@/assessment/assessment'
import type { FailureId } from '@/journey/failures'

interface ExamState {
  running: ExamPlan | null
  what: FailureId | null
  /** The chosen in-flight response id. */
  action: string | null
  /** True while an exam runs. */
  locked: boolean
  start: (plan: ExamPlan) => void
  setWhat: (v: FailureId) => void
  setAction: (v: string) => void
  end: () => void
  /** For tests: lock or unlock without a plan. */
  setLocked: (v: boolean) => void
}

export const useExamLock = create<ExamState>()((set) => ({
  running: null,
  what: null,
  action: null,
  locked: false,
  start: (running) => set({ running, what: null, action: null, locked: true }),
  setWhat: (what) => set({ what }),
  setAction: (action) => set({ action }),
  end: () => set({ running: null, what: null, action: null, locked: false }),
  setLocked: (locked) => set(locked ? { locked } : { locked, running: null, what: null, action: null }),
}))
