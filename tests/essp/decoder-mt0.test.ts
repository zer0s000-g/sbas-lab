/**
 * Message Type 0 means "discard the data of this PRN signal", but the decoder treats
 * an MT0 as an MT2 and applies its fast corrections and UDREIs.
 * Sources: EGNOS SoL SDD v3.6 §4.1.2 Table 4 (MT0: "Discard any ranging, corrections, and
 * integrity data from that PRN signal"); FAA WAAS PS 2008 Table 2.1-1 (MT0: "Discard data
 * from the transmitting PRN signal"); EASA CS-ETSO Amdt 16, ETSO-C199 A1.2.6.7 ("SHALL not
 * use SBAS corrections when the SBAS satellite is broadcasting message type 0").
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyMessage, bitsFromHex, crc24q, crcOk, decodeMessage, emptyState, getU, parseEms } from '@/core/sbasDecode'
import { groundFromDecoder } from '@/core/serviceMap'

const EMS = readFileSync(join(import.meta.dirname, '../../src/replay/data/egnos-prn124-20110329-1500.ems'), 'utf8')
const recs = parseEms(EMS)
const bitsOf = (type: number) => bitsFromHex(recs.find((r) => r.type === type)!.hex)!

/** A real MT2 re-labelled as MT0 (the "MT0/2" test message), with a valid CRC. */
function asMt0(mt2: Uint8Array): Uint8Array {
  const b = mt2.slice()
  for (let i = 8; i < 14; i++) b[i] = 0
  const crc = crc24q(b, 226)
  for (let i = 0; i < 24; i++) b[226 + i] = (crc >>> (23 - i)) & 1
  return b
}

describe('MT0: discard the data of that PRN signal', () => {
  it('an MT0 carrying MT2 data does not give the receiver usable corrections', () => {
    const mt1 = bitsOf(1)
    const mt0 = asMt0(bitsOf(2))
    expect(crcOk(mt0)).toBe(true)
    expect(getU(mt0, 8, 6)).toBe(0)
    const s = emptyState()
    applyMessage(s, decodeMessage(mt1), 0)
    applyMessage(s, decodeMessage(mt0), 1)
    // The service map's real-data mode turns these into usable UDREIs.
    expect(groundFromDecoder(s, 2).udrei.size).toBe(0)
  })
  it('an MT0 discards the corrections already received from that signal', () => {
    const s = emptyState()
    applyMessage(s, decodeMessage(bitsOf(1)), 0)
    applyMessage(s, decodeMessage(bitsOf(2)), 1)
    expect(s.fast.size).toBeGreaterThan(0)
    applyMessage(s, decodeMessage(asMt0(bitsOf(2))), 2)
    expect(s.fast.size).toBe(0)
  })
})
