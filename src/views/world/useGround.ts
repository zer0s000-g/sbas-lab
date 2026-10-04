import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { buildGroundAt, buildRestWhenIdle, builtAirports, subscribeBuilt } from './terrainData'

/**
 * The airports whose ground (terrain patch, trees, sea map) is built and can be drawn:
 * `first`, the one the view opens at, at once; the others follow in idle time. Everything
 * built is kept for the session, so opening the view again costs nothing.
 */
export function useBuiltAirports(first: string): readonly string[] {
  // Idempotent: builds only what is missing.
  useMemo(() => buildGroundAt(first), [first])
  useEffect(() => buildRestWhenIdle(), [])
  return useSyncExternalStore(subscribeBuilt, builtAirports, builtAirports)
}
