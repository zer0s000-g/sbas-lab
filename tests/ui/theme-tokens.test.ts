// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getThemeTokens, onThemeChange } from '@/hooks/useThemeTokens'

// MutationObserver callbacks run as a microtask.
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('theme tokens', () => {
  it('a class or style change on <html> that changes no token keeps the tokens and tells no one', async () => {
    const before = getThemeTokens()
    let calls = 0
    const off = onThemeChange(() => calls++)
    document.documentElement.classList.add('scroll-locked')
    document.documentElement.style.setProperty('overflow', 'hidden')
    await settle()
    expect(calls).toBe(0)
    expect(getThemeTokens()).toBe(before)
    off()
  })

  it('a change of theme replaces the tokens and tells every subscriber once', async () => {
    const before = getThemeTokens()
    let calls = 0
    const off = onThemeChange(() => calls++)
    document.documentElement.classList.add('dark')
    await settle()
    expect(calls).toBe(1)
    const after = getThemeTokens()
    expect(after).not.toBe(before)
    expect(after.isDark).toBe(true)
    // A second unrelated mutation in the same theme changes nothing.
    document.documentElement.classList.add('another')
    await settle()
    expect(calls).toBe(1)
    expect(getThemeTokens()).toBe(after)
    off()
  })
})
