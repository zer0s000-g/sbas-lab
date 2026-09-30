import { useMemo } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import {
  createClock,
  pause,
  play,
  setSpeed,
  stepSpeed,
  tickClock,
  togglePlay,
  type ClockState,
  DEFAULT_SPEEDS,
} from '@/core/clock'
import { systemPrefersReducedMotion, usePrefs } from '@/stores/prefs'

export interface ClockStore extends ClockState {
  play: () => void
  pause: () => void
  toggle: () => void
  setSpeed: (s: number) => void
  faster: () => void
  slower: () => void
  /** Advance by a real frame time; returns the world time step. */
  tick: (realDtS: number) => number
  reset: () => void
}

export type SimClock = StoreApi<ClockStore>

export function createSimClock(opts: { speeds?: readonly number[]; speed?: number; running?: boolean } = {}): SimClock {
  const initial = createClock({ speeds: opts.speeds ?? DEFAULT_SPEEDS, speed: opts.speed ?? 1, running: opts.running ?? true })
  return createStore<ClockStore>()((set, get) => {
    const apply = (fn: (s: ClockState) => ClockState) => set((s) => fn(s))
    return {
      ...initial,
      play: () => apply(play),
      pause: () => apply(pause),
      toggle: () => apply(togglePlay),
      setSpeed: (v) => apply((s) => setSpeed(s, v)),
      faster: () => apply((s) => stepSpeed(s, 1)),
      slower: () => apply((s) => stepSpeed(s, -1)),
      tick: (realDtS) => {
        const s = get()
        const { state, dt } = tickClock(s, realDtS)
        if (dt > 0) set({ timeS: state.timeS })
        return dt
      },
      reset: () => set({ timeS: 0 }),
    }
  })
}

/**
 * A clock owned by one simulator. Starts paused when the learner prefers
 * reduced motion.
 */
export function useSimClock(opts: { speeds?: readonly number[]; speed?: number } = {}): SimClock {
  const reducedOverride = usePrefs.getState().reducedMotionOverride
  const reduced = reducedOverride ?? systemPrefersReducedMotion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createSimClock({ ...opts, running: !reduced }), [])
}

export function useClock<T>(clock: SimClock, selector: (s: ClockStore) => T): T {
  return useStore(clock, selector)
}

export { useSimulationLoop } from './useSimulationLoop'
