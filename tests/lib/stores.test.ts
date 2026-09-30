// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizePrefs } from '@/stores/prefs'

// The store hydrates from localStorage when first imported: each test loads a fresh copy.
async function freshPrefs() {
  vi.resetModules()
  return (await import('@/stores/prefs')).usePrefs
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('saved preferences', () => {
  it('start dark, with guided stops on', async () => {
    const usePrefs = await freshPrefs()
    expect(usePrefs.getState().theme).toBe('dark')
    expect(usePrefs.getState().guidedStops).toBe(true)
  })

  it('keep only values of the right type', () => {
    expect(sanitizePrefs({ theme: 'blue', soundOn: 'false', reducedMotionOverride: 'yes', captionsOn: false, guidedStops: 'no' })).toEqual({ captionsOn: false })
    expect(sanitizePrefs({ theme: 'light', soundOn: false, reducedMotionOverride: null, guidedStops: false })).toEqual({
      theme: 'light',
      soundOn: false,
      reducedMotionOverride: null,
      guidedStops: false,
    })
    expect(sanitizePrefs('junk')).toEqual({})
    expect(sanitizePrefs(null)).toEqual({})
  })

  it('a stored soundOn "false" string does not turn sound on; a bad theme keeps the default', async () => {
    localStorage.setItem('sbaslab.prefs', JSON.stringify({ state: { theme: 'blue', soundOn: 'false' }, version: 1 }))
    const usePrefs = await freshPrefs()
    expect(usePrefs.getState().theme).toBe('dark')
    expect(usePrefs.getState().soundOn).toBe(true)
  })

  it('a saved light theme and stops-off come back', async () => {
    localStorage.setItem('sbaslab.prefs', JSON.stringify({ state: { theme: 'light', guidedStops: false }, version: 1 }))
    const usePrefs = await freshPrefs()
    expect(usePrefs.getState().theme).toBe('light')
    expect(usePrefs.getState().guidedStops).toBe(false)
  })

  it('corrupted JSON leaves the defaults', async () => {
    localStorage.setItem('sbaslab.prefs', '{not json')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const usePrefs = await freshPrefs()
    expect(usePrefs.getState().theme).toBe('dark')
  })

  it('a full disk does not throw from the setter; the value stays in memory', async () => {
    const usePrefs = await freshPrefs()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(() => usePrefs.getState().setTheme('light')).not.toThrow()
    expect(usePrefs.getState().theme).toBe('light')
  })

  it('blocked storage (getItem throws) still starts with defaults', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const usePrefs = await freshPrefs()
    expect(usePrefs.getState().theme).toBe('dark')
  })
})
