/**
 * React binding for the journey engine: components subscribe to the discrete state
 * (phase, stop, settings) and read the continuous parts (tick, aircraft, snapshot)
 * from the engine at their own sampling rate (design.md §7: never set React state per frame).
 */
import { useSyncExternalStore } from 'react'
import { JourneyEngine, type JourneyState } from './engine'

let engine: JourneyEngine | null = null

/** The page's one engine (one world, one clock). */
export function getJourney(opts?: ConstructorParameters<typeof JourneyEngine>[0]): JourneyEngine {
  if (!engine) engine = new JourneyEngine(opts)
  return engine
}

export function useJourneyState<T>(e: JourneyEngine, select: (s: JourneyState) => T): T {
  return useSyncExternalStore(
    (cb) => e.subscribe(cb),
    () => select(e.state),
    () => select(e.state),
  )
}
