/**
 * SBAS Lab's SBAS message decoder against real data and an independent decoder:
 * 15 minutes of EGNOS messages (PRN 124, 29 March 2011, EGNOS Toolkit example file,
 * src/replay/data) and the picture RTKLIB builds from the same file
 * (scripts/egnos/rtklib-reference.c → tests/fixtures/rtklib-…json).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyMessage, bitsFromHex, crc24q, crcOk, decodeMessage, emptyState, getS, getU, igpAt, L1_PREAMBLES, parseEms, slotSystem } from '@/core/sbasDecode'

const ROOT = join(import.meta.dirname, '..', '..')
const EMS = readFileSync(join(ROOT, 'src/replay/data/egnos-prn124-20110329-1500.ems'), 'utf8')
const RTKLIB = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/rtklib-egnos-prn124-20110329-1500.json'), 'utf8')) as {
  messages: number
  checkpoints: { after: number; iodp: number; nsat: number; fast: [number, number, number][]; ion: [number, number, number, number, number][] }[]
}
const records = parseEms(EMS)

describe('the recorded EGNOS broadcast', () => {
  it('has 900 messages from PRN 124, starting 29 March 2011 15:00 (GPS time), one a second', () => {
    expect(records).toHaveLength(900)
    expect(records[0]).toMatchObject({ prn: 124, time: { year: 2011, month: 3, day: 29, hour: 15, minute: 0, second: 0 }, tS: 0 })
    for (let i = 1; i < records.length; i++) expect(records[i].tS).toBeGreaterThan(records[i - 1].tS)
    expect(records.at(-1)!.tS).toBe(900)
  })
  it('every message passes its 24-bit CRC over the 8 + 6 + 212 bit layout, and carries its type in bits 8–13', () => {
    for (const r of records) {
      const b = bitsFromHex(r.hex)!
      expect(crcOk(b), `${r.tS}`).toBe(true)
      expect(getU(b, 8, 6)).toBe(r.type)
      expect(L1_PREAMBLES as readonly number[]).toContain(getU(b, 0, 8))
    }
  })
  it('a single flipped bit fails the CRC', () => {
    const b = bitsFromHex(records[10].hex)!
    for (const pos of [0, 13, 100, 225, 249]) {
      const c = b.slice()
      c[pos] ^= 1
      expect(crcOk(c)).toBe(false)
    }
  })
  it('the preambles 0x53, 0x9A, 0xC6 follow each other from second to second', () => {
    let checked = 0
    for (let i = 1; i < records.length; i++) {
      if (records[i].tS - records[i - 1].tS !== 1) continue
      const a = L1_PREAMBLES.indexOf(getU(bitsFromHex(records[i - 1].hex)!, 0, 8) as 0x53)
      const b = L1_PREAMBLES.indexOf(getU(bitsFromHex(records[i].hex)!, 0, 8) as 0x53)
      expect(b).toBe((a + 1) % 3)
      checked++
    }
    expect(checked).toBeGreaterThan(890)
  })
})

describe('decoding, against RTKLIB', () => {
  it('builds the same picture as RTKLIB after messages 100, 300, 600 and 900: the PRN mask, every fast correction and UDREI, every grid point delay and GIVEI', () => {
    expect(RTKLIB.messages).toBe(records.length)
    const s = emptyState()
    let next = 0
    records.forEach((r, i) => {
      applyMessage(s, decodeMessage(bitsFromHex(r.hex)!), r.tS)
      const cp = RTKLIB.checkpoints[next]
      if (!cp || cp.after !== i) return
      next++
      expect(s.iodp).toBe(cp.iodp)
      expect(s.maskBits).toHaveLength(cp.nsat)
      const fast = [...s.fast.entries()].sort((a, b) => a[0] - b[0]).map(([slot, f]) => [slot, f.prcM, f.udrei])
      expect(fast).toEqual(cp.fast.map(([slot, prc, udrei]) => [slot, prc, udrei]))
      const ion = [...s.grid.values()].map((g) => [g.band, g.latDeg, g.lonDeg, g.delayM ?? 0, g.givei]).sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1])
      const ref = cp.ion.map((x) => [...x]).sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1])
      expect(ion).toEqual(ref)
    })
    expect(next).toBe(RTKLIB.checkpoints.length)
  })
  it('EGNOS corrected the GPS satellites in its mask, with UDREIs and GIVEIs from the DO-229 tables', () => {
    const s = emptyState()
    for (const r of records) applyMessage(s, decodeMessage(bitsFromHex(r.hex)!), r.tS)
    const systems = s.maskBits.map((b) => slotSystem(b).system)
    expect(systems.filter((x) => x === 'GPS').length).toBeGreaterThan(20)
    for (const f of s.fast.values()) {
      expect(f.udrei).toBeGreaterThanOrEqual(0)
      expect(f.udrei).toBeLessThanOrEqual(15)
      expect(Math.abs(f.prcM)).toBeLessThan(256)
    }
    // The grid covers Europe: bands 3–5 hold 60°W–55°E (and EGNOS also masks IGPs in bands 6 and 9).
    const g = [...s.grid.values()]
    expect(g.some((p) => p.latDeg === 45 && p.lonDeg === 5)).toBe(true)
    const bands = new Set(g.map((p) => p.band))
    for (const b of [3, 4, 5]) expect(bands.has(b)).toBe(true)
  })
})

describe('bits, fields and tables', () => {
  it('reads unsigned and two’s-complement fields', () => {
    const b = new Uint8Array([1, 1, 1, 1, 0, 0, 0, 1])
    expect(getU(b, 0, 4)).toBe(15)
    expect(getS(b, 0, 4)).toBe(-1)
    expect(getS(b, 4, 4)).toBe(1)
    expect(bitsFromHex('zz')).toBeNull()
  })
  it('CRC-24Q of the single bit 1 is the polynomial; leading zero bits change nothing', () => {
    expect(crc24q(new Uint8Array([1]), 1)).toBe(0x864cfb)
    const b = bitsFromHex(records[3].hex)!
    const padded = new Uint8Array(6 + 226)
    padded.set(b.subarray(0, 226), 6)
    expect(crc24q(padded, padded.length)).toBe(crc24q(b, 226))
  })
  it('places IGPs by band and mask bit (DO-229 Appendix A)', () => {
    expect(igpAt(0, 1)).toEqual({ latDeg: -75, lonDeg: -180 })
    expect(igpAt(4, 101)).toEqual({ latDeg: -75, lonDeg: 0 })
    expect(igpAt(4, 128)).toEqual({ latDeg: 85, lonDeg: 0 })
    expect(igpAt(9, 1)).toEqual({ latDeg: 60, lonDeg: -180 })
    expect(igpAt(10, 192)).toEqual({ latDeg: -85, lonDeg: 160 })
    expect(igpAt(8, 201)).toBeNull()
    expect(igpAt(11, 1)).toBeNull()
  })
  it('skips malformed EMS lines', () => {
    expect(parseEms('garbage\n124 11 03 29 15 00 00 2 XYZ\n')).toEqual([])
  })
})
