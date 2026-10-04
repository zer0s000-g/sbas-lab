/**
 * The recorded EGNOS broadcast the ESSP-SAS scenario replays: 15 minutes of real
 * messages (src/replay/data, EUPL v1.1), parsed, checked and decoded once, with the
 * receiver's picture available at any second. Loaded on demand (its own chunk).
 */
import raw from './data/egnos-prn124-20110329-1500.ems?raw'
import { applyMessage, bitsFromHex, crcOk, decodeMessage, emptyState, parseEms, type Decoded, type DecoderState, type EmsRecord } from '@/core/sbasDecode'

export interface RecordedMessage extends EmsRecord {
  bits: Uint8Array
  crcValid: boolean
  decoded: Decoded
}

export interface Recording {
  messages: RecordedMessage[]
  /** Length of the recording, s. */
  durationS: number
  /** The index of the message broadcast at a second of the recording (the last one at or before it). */
  indexAt: (second: number) => number
  /** The picture after message `i` (cached forward; a jump back starts again from the start). */
  stateAfter: (i: number) => DecoderState
}

export function makeRecording(text: string): Recording {
  const messages: RecordedMessage[] = parseEms(text).flatMap((r) => {
    const bits = bitsFromHex(r.hex)
    if (!bits) return []
    const valid = crcOk(bits)
    return [{ ...r, bits, crcValid: valid, decoded: valid ? decodeMessage(bits) : { type: r.type, unknown: true as const } }]
  })
  const durationS = messages.length ? messages[messages.length - 1].tS + 1 : 0
  let cache = { i: -1, state: emptyState() }
  const indexAt = (second: number) => {
    let lo = 0
    let hi = messages.length - 1
    if (hi < 0 || !(second >= messages[0].tS)) return 0
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (messages[mid].tS <= second) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const stateAfter = (i: number) => {
    const target = Math.min(Math.max(Math.floor(i), 0), messages.length - 1)
    if (target < cache.i) cache = { i: -1, state: emptyState() }
    for (let k = cache.i + 1; k <= target; k++) if (messages[k].crcValid) applyMessage(cache.state, messages[k].decoded, messages[k].tS)
    cache.i = Math.max(cache.i, target)
    return cache.state
  }
  return { messages, durationS, indexAt, stateAfter }
}

let recording: Recording | null = null
/** The recording, parsed once. */
export function egnosRecording(): Recording {
  recording ??= makeRecording(raw)
  return recording
}

/** What the recording is, for its label. */
export const RECORDING_LABEL = 'Recorded EGNOS broadcast · PRN 124 · 29 March 2011 · 15:00–15:15 GPS time'
