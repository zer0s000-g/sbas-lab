import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isRecord, safeStorage } from './storage'

export type ThemeChoice = 'light' | 'dark' | 'system'

interface PrefsState {
  theme: ThemeChoice
  /** null = follow the operating system setting. */
  reducedMotionOverride: boolean | null
  soundOn: boolean
  captionsOn: boolean
  /** Pause the journey at the four guided stops (design.md §4). */
  guidedStops: boolean
  setTheme: (t: ThemeChoice) => void
  setReducedMotion: (v: boolean | null) => void
  setSoundOn: (v: boolean) => void
  setCaptionsOn: (v: boolean) => void
  setGuidedStops: (v: boolean) => void
}

type SavedPrefs = Pick<PrefsState, 'theme' | 'reducedMotionOverride' | 'soundOn' | 'captionsOn' | 'guidedStops'>

const THEMES: readonly ThemeChoice[] = ['light', 'dark', 'system']

/** Saved preferences, keeping only fields of the right type ("false" as a string is not false). */
export function sanitizePrefs(raw: unknown): Partial<SavedPrefs> {
  if (!isRecord(raw)) return {}
  const out: Partial<SavedPrefs> = {}
  if (THEMES.includes(raw.theme as ThemeChoice)) out.theme = raw.theme as ThemeChoice
  if (typeof raw.reducedMotionOverride === 'boolean' || raw.reducedMotionOverride === null) out.reducedMotionOverride = raw.reducedMotionOverride
  if (typeof raw.soundOn === 'boolean') out.soundOn = raw.soundOn
  if (typeof raw.captionsOn === 'boolean') out.captionsOn = raw.captionsOn
  if (typeof raw.guidedStops === 'boolean') out.guidedStops = raw.guidedStops
  return out
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      reducedMotionOverride: null,
      soundOn: true,
      captionsOn: true,
      guidedStops: true,
      setTheme: (theme) => set({ theme }),
      setReducedMotion: (reducedMotionOverride) => set({ reducedMotionOverride }),
      setSoundOn: (soundOn) => set({ soundOn }),
      setCaptionsOn: (captionsOn) => set({ captionsOn }),
      setGuidedStops: (guidedStops) => set({ guidedStops }),
    }),
    {
      name: 'sbaslab.prefs',
      storage: safeStorage,
      version: 1,
      partialize: (s): SavedPrefs => ({
        theme: s.theme,
        reducedMotionOverride: s.reducedMotionOverride,
        soundOn: s.soundOn,
        captionsOn: s.captionsOn,
        guidedStops: s.guidedStops,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizePrefs(persisted) }),
    },
  ),
)

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Apply the theme class to <html>. */
export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(REDUCED_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** Effective reduced-motion setting: the learner's choice, else the operating system's (live). */
export function useReducedMotion(): boolean {
  const override = usePrefs((s) => s.reducedMotionOverride)
  const system = useSyncExternalStore(subscribeReducedMotion, systemPrefersReducedMotion, () => false)
  return override ?? system
}
