/**
 * Whether an assessment is running: during an exam the failures are the exam's, so the
 * Break panel and the service panel must not show which ones are on.
 */
import { create } from 'zustand'

export const useExamLock = create<{ locked: boolean; setLocked: (v: boolean) => void }>()((set) => ({
  locked: false,
  setLocked: (locked) => set({ locked }),
}))
