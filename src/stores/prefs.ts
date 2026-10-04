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

/**
 * Apply the theme class to <html>, and colour the browser's own chrome to match.
 * (index.html runs the same first step inline, before the page's script has loaded.)
 */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  const dark = choice === 'dark' || (choice === 'system' && systemPrefersDark())
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  const background = getComputedStyle(root).getPropertyValue('--background').trim()
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
}

/**
 * The learner's motion choice on <html> (`data-motion`), so CSS transitions and
 * animations follow it too, not only the operating system setting.
 */
export function applyMotion(override: boolean | null) {
  const root = document.documentElement
  if (override === null) delete root.dataset.motion
  else root.dataset.motion = override ? 'reduce' : 'full'
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
