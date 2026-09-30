import { useRef } from 'react'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import type { SimClock } from '@/hooks/useSimClock'

/**
 * Drives a simulation: every animation frame the clock is ticked and
 * `step(dt, realDt)` is called with the world time step (0 while paused).
 * `step` is always called, so views can still animate UI while paused.
 */
export function useSimulationLoop(clock: SimClock, step: (dt: number, realDt: number) => void, active = true) {
  const stepRef = useRef(step)
  stepRef.current = step
  useAnimationFrame((realDt) => {
    const dt = clock.getState().tick(realDt)
    stepRef.current(dt, realDt)
  }, active)
}
