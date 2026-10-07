/**
 * The EGNOS broadcast the ESSP-SAS scenario shows: only types EGNOS transmits (EGNOS SoL
 * SDD v3.6 §4.1.2 Table 4), no GEO ranging (its footnote 17), and a claim note that
 * matches the recording.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { messageType, scheduledMessage } from '@/core/messages'
import { parseEms } from '@/core/sbasDecode'
import { SBAS_CLAIMS } from '@/content/claims/sbas'
import { ESSP } from '@/scenarios/essp'

const EGNOS_TABLE_4 = new Set([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 17, 18, 24, 25, 26, 27, 63])
const EMS = readFileSync(join(import.meta.dirname, '../../src/replay/data/egnos-prn124-20110329-1500.ems'), 'utf8')

describe('the EGNOS broadcast shown in the ESSP-SAS scenario', () => {
  it('the scenario shows the L1 stream', () => expect(ESSP.nominalService).toBe('l1'))
  it('every message type the EGNOS GEOs are shown broadcasting is one EGNOS transmits, and has a name', () => {
    const shown = new Set<number>()
    for (let s = 0; s < 72; s++) for (const g of [0, 1]) shown.add(scheduledMessage(s, g, 'L1'))
    expect([...shown].filter((t) => !EGNOS_TABLE_4.has(t))).toEqual([])
    for (const t of shown) expect(messageType('L1', t), `Type ${t}`).toBeTruthy()
  })
  it('MT9 is not described as GEO ranging (EGNOS has no ranging function)', () => {
    expect(messageType('L1', 9)!.plain).not.toMatch(/ranging/i)
  })
  it('the types the claim note says the recording contains are exactly the recorded ones, and all have names', () => {
    const note = SBAS_CLAIMS.find((c) => c.id === 'sbas.message-types')!.note!
    const listed = note.match(/contains Types ([\d, and]+)/)![1].split(/,\s*|\s+and\s+/).map(Number)
    const seen = [...new Set(parseEms(EMS).map((r) => r.type))].sort((a, b) => a - b)
    expect(listed).toEqual(seen)
    for (const t of seen) expect(messageType('L1', t), `Type ${t}`).toBeTruthy()
  })
})
