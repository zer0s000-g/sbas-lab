/**
 * The Sources sheet's state: open or closed, and the claims it focuses on (those behind
 * one phase's narration), or all of the scenario's claims.
 */
import { create } from 'zustand'

interface SourcesState {
  open: boolean
  /** Claim ids to show first, or null for all. */
  focus: readonly string[] | null
  show: (focus?: readonly string[]) => void
  setOpen: (open: boolean) => void
}

export const useSources = create<SourcesState>()((set) => ({
  open: false,
  focus: null,
  show: (focus) => set({ open: true, focus: focus ?? null }),
  setOpen: (open) => set(open ? { open } : { open, focus: null }),
}))
