import { describe, expect, it } from 'vitest'
import { alarmBroadcastS, MESSAGE_BITS, messageType, MESSAGE_TYPES, scheduledMessage } from '@/core/messages'
import { OPERATIONS } from '@/core/operations'

describe('SBAS messages', () => {
  it('a 250-bit message: preamble, type, data and CRC', () => {
    expect(MESSAGE_BITS.preamble + MESSAGE_BITS.type + MESSAGE_BITS.data + MESSAGE_BITS.crc).toBe(MESSAGE_BITS.total)
  })
  it('the catalogue has the types Doc 9849 names, each with a plain meaning', () => {
    for (const [sig, t] of [['L1', 0], ['L1', 28], ['DFMC', 32]] as const) expect(messageType(sig, t)).toBeTruthy()
    for (const m of MESSAGE_TYPES) expect(m.plain.length).toBeGreaterThan(5)
  })
  it('every scheduled message is in the catalogue, and the two GEOs are offset', () => {
    for (let s = 0; s < 120; s++) {
      expect(messageType('L1', scheduledMessage(s, 0, 'L1'))).toBeTruthy()
      expect(messageType('DFMC', scheduledMessage(s, 1, 'DFMC'))).toBeTruthy()
    }
    const same = Array.from({ length: 36 }, (_, s) => scheduledMessage(s, 0, 'L1') === scheduledMessage(s, 1, 'L1')).filter(Boolean).length
    expect(same).toBeLessThan(36)
    expect(scheduledMessage(-5, 0, 'L1')).toBeGreaterThanOrEqual(0)
  })
  it('an alarm reaches the aircraft within the tightest time to alert (6 s, Doc 9849 Table 2-1)', () => {
    for (const raised of [100, 100.4, 100.99]) expect(alarmBroadcastS(raised) + 1 - raised).toBeLessThanOrEqual(OPERATIONS.cat1.ttaS)
  })
})
