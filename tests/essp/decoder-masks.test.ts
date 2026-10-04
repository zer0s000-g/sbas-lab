import { describe, expect, it } from 'vitest'
import { applyMessage, emptyState } from '@/core/sbasDecode'

const fast = (iodp: number, iodf = 0) => ({ type: 2 as const, iodf, iodp, prc: Array(13).fill(1.5), udrei: Array(13).fill(5) })

describe('the decoder and a new mask (DO-229 issue of data)', () => {
  it('a new PRN mask (IODP) drops the corrections kept for the old one', () => {
    const s = emptyState()
    applyMessage(s, { type: 1, maskBits: [1, 2, 3], iodp: 1 }, 0)
    applyMessage(s, fast(1), 1)
    expect(s.fast.size).toBe(3)
    applyMessage(s, { type: 1, maskBits: [4, 5, 6], iodp: 2 }, 2)
    expect(s.fast.size).toBe(0)
    // The same mask again keeps them.
    applyMessage(s, fast(2), 3)
    applyMessage(s, { type: 1, maskBits: [4, 5, 6], iodp: 2 }, 4)
    expect(s.fast.size).toBe(3)
  })
  it("MT6 with IODF 3 is an alarm: its UDREIs apply whatever the corrections' IODF", () => {
    const s = emptyState()
    applyMessage(s, { type: 1, maskBits: [1, 2, 3], iodp: 1 }, 0)
    applyMessage(s, fast(1, 1), 1)
    applyMessage(s, { type: 6, iodf: [3, 3, 3, 3], udrei: Array(51).fill(15) }, 2)
    expect(s.fast.get(0)!.udrei).toBe(15)
  })
  it("a new IGP mask (IODI) for a band drops that band's old grid points", () => {
    const s = emptyState()
    applyMessage(s, { type: 18, bands: 1, band: 3, iodi: 0, maskBits: Array.from({ length: 30 }, (_, i) => i + 1) }, 0)
    applyMessage(s, { type: 26, band: 3, block: 0, delay: Array(15).fill(2), givei: Array(15).fill(5), iodi: 0 }, 1)
    expect(s.grid.size).toBeGreaterThan(0)
    applyMessage(s, { type: 18, bands: 1, band: 3, iodi: 1, maskBits: Array.from({ length: 30 }, (_, i) => i + 1) }, 2)
    expect(s.grid.size).toBe(0)
  })
})
