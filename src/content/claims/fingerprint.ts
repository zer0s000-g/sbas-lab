/**
 * A short fingerprint of what an AI check read in a claim: its text and its value. Each
 * entry in ./aiChecks records the fingerprint of the claim as it was checked, and the
 * claims test fails when the claim's text or value no longer matches it, so a changed claim
 * cannot keep an old check (CLAUDE.md: check it again or remove its entry).
 *
 * FNV-1a, 32 bits, over the text, a NUL and the JSON of the value; 8 hex digits.
 */
import type { Claim } from './types'

export function claimFingerprint(c: Pick<Claim, 'text' | 'value'>): string {
  const s = `${c.text}\u0000${JSON.stringify(c.value ?? null)}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
