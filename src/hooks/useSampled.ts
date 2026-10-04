import { useEffect, useRef, useState } from 'react'

/**
 * Polls `read()` every `intervalMs` and returns the latest value. Used for
 * text readouts so React re-renders ~10 times a second instead of every frame.
 * Values are compared with `equal` to avoid needless renders.
 */
export function useSampled<T>(read: () => T, intervalMs = 100, equal: (a: T, b: T) => boolean = shallowEqual): T {
  // Both in refs: callers pass inline functions, which must not restart the interval.
  const readRef = useRef(read)
  readRef.current = read
  const equalRef = useRef(equal)
  equalRef.current = equal
  const [value, setValue] = useState<T>(() => read())
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = readRef.current()
      setValue((prev) => (equalRef.current(prev, next) ? prev : next))
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return value
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}
