/**
 * Decoding real SBAS L1 messages: the 250-bit message (8-bit preamble, 6-bit type,
 * 212 data bits, 24-bit CRC-24Q), the fields of the message types the page shows, and
 * the receiver's picture they build up over time: which satellites are corrected (MT1),
 * their fast corrections and UDREIs (MT2–5, 6, 24), and the ionospheric grid (MT18, 26).
 *
 * Bit positions follow RTCA DO-229 (Appendix A). They were checked two ways: every
 * message of the recorded EGNOS broadcast (src/replay) passes the CRC over this layout,
 * and the decoded picture equals the one RTKLIB's independent decoder builds from the
 * same file (tests/essp/replay.test.ts). Pure: the same bits always give the same result.
 */

/** The three 8-bit preambles, sent in turn, one per message. */
export const L1_PREAMBLES = [0x53, 0x9a, 0xc6] as const

/** Message bits (0 or 1) from the hex of an EMS line (64 hex digits: 250 bits and 6 padding bits). */
export function bitsFromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]{63,64}$/.test(hex)) return null
  const out = new Uint8Array(hex.length * 4)
  for (let i = 0; i < hex.length; i++) {
    const v = Number.parseInt(hex[i], 16)
    for (let b = 0; b < 4; b++) out[i * 4 + b] = (v >> (3 - b)) & 1
  }
  return out
}

/** An unsigned field. */
export function getU(bits: Uint8Array, pos: number, len: number): number {
  let v = 0
  for (let i = 0; i < len; i++) v = v * 2 + (bits[pos + i] ?? 0)
  return v
}

/** A two's-complement signed field. */
export function getS(bits: Uint8Array, pos: number, len: number): number {
  const u = getU(bits, pos, len)
  return u >= 2 ** (len - 1) ? u - 2 ** len : u
}

/** CRC-24Q (polynomial 0x1864CFB, zero start) of the first `n` bits. */
export function crc24q(bits: Uint8Array, n: number): number {
  let crc = 0
  for (let i = 0; i < n; i++) {
    const fb = ((crc >>> 23) & 1) ^ bits[i]
    crc = (crc << 1) & 0xffffff
    if (fb) crc ^= 0x864cfb
  }
  return crc
}

/** True when the message's 24-bit CRC matches its first 226 bits. */
export const crcOk = (bits: Uint8Array) => bits.length >= 250 && crc24q(bits, 226) === getU(bits, 226, 24)

// ---------------------------------------------------------------------------
// IGP bands (DO-229 Appendix A). Ported from RTKLIB src/sbas.c,
// Copyright (c) 2007-2013, T. Takasu, BSD 2-clause licence (docs/THIRD_PARTY.md).
// ---------------------------------------------------------------------------

const X1 = [-75, -65, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 65, 75, 85]
const X2 = [-55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const X3 = [-75, -65, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 65, 75]
const X4 = [-85, -75, -65, -55, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 65, 75]
const X5 = Array.from({ length: 72 }, (_, i) => -180 + 5 * i)
const X6 = Array.from({ length: 36 }, (_, i) => -180 + 10 * i)
const X7 = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]
const X8 = [-170, -140, -110, -80, -50, -20, 10, 40, 70, 100, 130, 160]

type Col = [fixed: number, list: number[], first: number, last: number]
const BANDS_0_8: Col[][] = [
  [[-180, X1, 1, 28], [-175, X2, 29, 51], [-170, X3, 52, 78], [-165, X2, 79, 101], [-160, X3, 102, 128], [-155, X2, 129, 151], [-150, X3, 152, 178], [-145, X2, 179, 201]],
  [[-140, X4, 1, 28], [-135, X2, 29, 51], [-130, X3, 52, 78], [-125, X2, 79, 101], [-120, X3, 102, 128], [-115, X2, 129, 151], [-110, X3, 152, 178], [-105, X2, 179, 201]],
  [[-100, X3, 1, 27], [-95, X2, 28, 50], [-90, X1, 51, 78], [-85, X2, 79, 101], [-80, X3, 102, 128], [-75, X2, 129, 151], [-70, X3, 152, 178], [-65, X2, 179, 201]],
  [[-60, X3, 1, 27], [-55, X2, 28, 50], [-50, X4, 51, 78], [-45, X2, 79, 101], [-40, X3, 102, 128], [-35, X2, 129, 151], [-30, X3, 152, 178], [-25, X2, 179, 201]],
  [[-20, X3, 1, 27], [-15, X2, 28, 50], [-10, X3, 51, 77], [-5, X2, 78, 100], [0, X1, 101, 128], [5, X2, 129, 151], [10, X3, 152, 178], [15, X2, 179, 201]],
  [[20, X3, 1, 27], [25, X2, 28, 50], [30, X3, 51, 77], [35, X2, 78, 100], [40, X4, 101, 128], [45, X2, 129, 151], [50, X3, 152, 178], [55, X2, 179, 201]],
  [[60, X3, 1, 27], [65, X2, 28, 50], [70, X3, 51, 77], [75, X2, 78, 100], [80, X3, 101, 127], [85, X2, 128, 150], [90, X1, 151, 178], [95, X2, 179, 201]],
  [[100, X3, 1, 27], [105, X2, 28, 50], [110, X3, 51, 77], [115, X2, 78, 100], [120, X3, 101, 127], [125, X2, 128, 150], [130, X4, 151, 178], [135, X2, 179, 201]],
  [[140, X3, 1, 27], [145, X2, 28, 50], [150, X3, 51, 77], [155, X2, 78, 100], [160, X3, 101, 127], [165, X2, 128, 150], [170, X3, 151, 177], [175, X2, 178, 200]],
]
const BANDS_9_10: Col[][] = [
  [[60, X5, 1, 72], [65, X6, 73, 108], [70, X6, 109, 144], [75, X6, 145, 180], [85, X7, 181, 192]],
  [[-60, X5, 1, 72], [-65, X6, 73, 108], [-70, X6, 109, 144], [-75, X6, 145, 180], [-85, X8, 181, 192]],
]

export interface IgpPos {
  latDeg: number
  lonDeg: number
}

/** The IGP at mask bit `i` (1-based) of a band, or null for a bit with no IGP. */
export function igpAt(band: number, i: number): IgpPos | null {
  const vertical = band >= 0 && band <= 8
  const cols = vertical ? BANDS_0_8[band] : band === 9 || band === 10 ? BANDS_9_10[band - 9] : null
  if (!cols) return null
  for (const [fixed, list, first, last] of cols) {
    if (i < first || i > last) continue
    const v = list[i - first]
    return vertical ? { latDeg: v, lonDeg: fixed } : { latDeg: fixed, lonDeg: v }
  }
  return null
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** What the PRN mask slot of a mask bit (1–210) is. */
export function slotSystem(bit: number): { system: 'GPS' | 'GLONASS' | 'SBAS' | 'other'; prn: number } {
  if (bit >= 1 && bit <= 37) return { system: 'GPS', prn: bit }
  if (bit >= 38 && bit <= 61) return { system: 'GLONASS', prn: bit - 37 }
  if (bit >= 120 && bit <= 138) return { system: 'SBAS', prn: bit }
  return { system: 'other', prn: bit }
}

export type Decoded =
  | { type: 0 | 2 | 3 | 4 | 5; iodf: number; iodp: number; prc: number[]; udrei: number[] }
  | { type: 1; maskBits: number[]; iodp: number }
  | { type: 6; iodf: number[]; udrei: number[] }
  | { type: 7; latency: number; iodp: number; ai: number[] }
  | { type: 18; bands: number; band: number; iodi: number; maskBits: number[] }
  | { type: 24; prc: number[]; udrei: number[]; iodp: number; block: number; iodf: number; longTerm: LongTermHalf }
  | { type: 25; halves: [LongTermHalf, LongTermHalf] }
  | { type: 26; band: number; block: number; delay: (number | null)[]; givei: number[]; iodi: number }
  | { type: 9 | 10 | 12 | 17 | 27 | 63 }
  | { type: number; unknown: true }

/** Half a long-term correction message: the satellites (mask slot numbers) it corrects, and its IODP. */
export interface LongTermHalf {
  velocityCode: 0 | 1
  slots: { slot: number; iode: number; dxM: number; dyM: number; dzM: number }[]
  iodp: number
}

function longTermHalf(b: Uint8Array, p: number): LongTermHalf {
  const velocityCode = getU(b, p, 1) as 0 | 1
  if (velocityCode === 0) {
    const sat = (q: number) => ({ slot: getU(b, q, 6), iode: getU(b, q + 6, 8), dxM: getS(b, q + 14, 9) * 0.125, dyM: getS(b, q + 23, 9) * 0.125, dzM: getS(b, q + 32, 9) * 0.125 })
    return { velocityCode, slots: [sat(p + 1), sat(p + 52)].filter((s) => s.slot > 0), iodp: getU(b, p + 103, 2) }
  }
  const q = p + 1
  const s = { slot: getU(b, q, 6), iode: getU(b, q + 6, 8), dxM: getS(b, q + 14, 11) * 0.125, dyM: getS(b, q + 25, 11) * 0.125, dzM: getS(b, q + 36, 11) * 0.125 }
  return { velocityCode, slots: s.slot > 0 ? [s] : [], iodp: getU(b, p + 104, 2) }
}

/** The fields of one message (bits after the CRC check). */
export function decodeMessage(b: Uint8Array): Decoded {
  const type = getU(b, 8, 6)
  switch (type) {
    case 1: {
      const maskBits: number[] = []
      for (let i = 1; i <= 210; i++) if (b[13 + i]) maskBits.push(i)
      return { type, maskBits, iodp: getU(b, 224, 2) }
    }
    case 0:
    case 2:
    case 3:
    case 4:
    case 5:
      return {
        type,
        iodf: getU(b, 14, 2),
        iodp: getU(b, 16, 2),
        prc: Array.from({ length: 13 }, (_, i) => getS(b, 18 + 12 * i, 12) * 0.125),
        udrei: Array.from({ length: 13 }, (_, i) => getU(b, 174 + 4 * i, 4)),
      }
    case 6:
      return { type, iodf: [0, 1, 2, 3].map((i) => getU(b, 14 + 2 * i, 2)), udrei: Array.from({ length: 51 }, (_, i) => getU(b, 22 + 4 * i, 4)) }
    case 7:
      return { type, latency: getU(b, 14, 4), iodp: getU(b, 18, 2), ai: Array.from({ length: 51 }, (_, i) => getU(b, 22 + 4 * i, 4)) }
    case 18: {
      const maskBits: number[] = []
      for (let i = 1; i <= 201; i++) if (b[23 + i]) maskBits.push(i)
      return { type, bands: getU(b, 14, 4), band: getU(b, 18, 4), iodi: getU(b, 22, 2), maskBits }
    }
    case 24:
      return {
        type,
        prc: Array.from({ length: 6 }, (_, i) => getS(b, 14 + 12 * i, 12) * 0.125),
        udrei: Array.from({ length: 6 }, (_, i) => getU(b, 86 + 4 * i, 4)),
        iodp: getU(b, 110, 2),
        block: getU(b, 112, 2),
        iodf: getU(b, 114, 2),
        longTerm: longTermHalf(b, 120),
      }
    case 25:
      return { type, halves: [longTermHalf(b, 14), longTermHalf(b, 120)] }
    case 26:
      return {
        type,
        band: getU(b, 14, 4),
        block: getU(b, 18, 4),
        delay: Array.from({ length: 15 }, (_, i) => {
          const d = getU(b, 22 + 13 * i, 9)
          return d === 0x1ff ? null : d * 0.125
        }),
        givei: Array.from({ length: 15 }, (_, i) => getU(b, 31 + 13 * i, 4)),
        iodi: getU(b, 217, 2),
      }
    case 9:
    case 10:
    case 12:
    case 17:
    case 27:
    case 63:
      return { type }
    default:
      return { type, unknown: true }
  }
}

// ---------------------------------------------------------------------------
// The receiver's picture, message by message
// ---------------------------------------------------------------------------

export interface FastCorrection {
  /** Pseudo-range correction, m. */
  prcM: number
  udrei: number
  iodf: number
  /** Second of the recording it was received. */
  tS: number
}

export interface GridPoint extends IgpPos {
  band: number
  /** Vertical delay at L1, m (null: "do not use"). */
  delayM: number | null
  givei: number
  tS: number
}

export interface DecoderState {
  /** PRN mask: the mask bits (1–210) in order; slot j of the corrections is maskBits[j]. */
  maskBits: number[]
  iodp: number | null
  fast: Map<number, FastCorrection>
  /** Per band: the IGP mask and its IODI. */
  bands: Map<number, { iodi: number; igps: IgpPos[] }>
  grid: Map<string, GridPoint>
  latency: number | null
  /** Messages seen, by type. */
  counts: Map<number, number>
}

export const emptyState = (): DecoderState => ({ maskBits: [], iodp: null, fast: new Map(), bands: new Map(), grid: new Map(), latency: null, counts: new Map() })

const gridKey = (p: IgpPos) => `${p.latDeg},${p.lonDeg}`

/**
 * Apply one message to the picture (in place). The issue-of-data rules decide what may
 * be used: fast corrections need the IODP of the current PRN mask, MT6 UDREIs the IODF
 * of the corrections they rate, grid delays the IODI of their band's mask (DO-229).
 */
export function applyMessage(s: DecoderState, m: Decoded, tS: number): void {
  s.counts.set(m.type, (s.counts.get(m.type) ?? 0) + 1)
  if ('unknown' in m) return
  switch (m.type) {
    case 1:
      if (!('maskBits' in m) || 'band' in m) return
      s.maskBits = m.maskBits
      s.iodp = m.iodp
      return
    case 0:
    case 2:
    case 3:
    case 4:
    case 5: {
      if (!('prc' in m) || s.iodp !== m.iodp) return
      const first = 13 * ((m.type === 0 ? 2 : m.type) - 2)
      for (let i = 0; i < 13; i++) {
        const slot = first + i
        if (slot >= s.maskBits.length) break
        s.fast.set(slot, { prcM: m.prc[i], udrei: m.udrei[i], iodf: m.iodf, tS })
      }
      return
    }
    case 6:
      if (!('iodf' in m) || !Array.isArray(m.iodf)) return
      for (let slot = 0; slot < s.maskBits.length && slot < 51; slot++) {
        const f = s.fast.get(slot)
        if (!f || f.iodf !== m.iodf[Math.floor(slot / 13)]) continue
        s.fast.set(slot, { ...f, udrei: m.udrei[slot] })
      }
      return
    case 7:
      if ('latency' in m && s.iodp === m.iodp) s.latency = m.latency
      return
    case 18: {
      if (!('maskBits' in m) || !('band' in m)) return
      const igps = m.maskBits.map((i) => igpAt(m.band, i)).filter((p): p is IgpPos => p !== null)
      s.bands.set(m.band, { iodi: m.iodi, igps })
      return
    }
    case 24: {
      if (!('block' in m) || s.iodp !== m.iodp) return
      for (let i = 0; i < 6; i++) {
        const slot = 13 * m.block + i
        if (slot >= s.maskBits.length) break
        s.fast.set(slot, { prcM: m.prc[i], udrei: m.udrei[i], iodf: m.iodf, tS })
      }
      return
    }
    case 26: {
      if (!('givei' in m)) return
      const band = s.bands.get(m.band)
      if (!band || band.iodi !== m.iodi) return
      for (let i = 0; i < 15; i++) {
        const p = band.igps[m.block * 15 + i]
        if (!p) continue
        s.grid.set(gridKey(p), { ...p, band: m.band, delayM: m.delay[i], givei: m.givei[i], tS })
      }
      return
    }
    default:
  }
}

// ---------------------------------------------------------------------------
// EMS files (ESA EGNOS Message Server)
// ---------------------------------------------------------------------------

export interface EmsRecord {
  prn: number
  /** UTC-like calendar fields as the file gives them (GPS time). */
  time: { year: number; month: number; day: number; hour: number; minute: number; second: number }
  /** Seconds since the first record. */
  tS: number
  type: number
  hex: string
}

/** The records of an EMS file: "PRN YY MM DD hh mm ss MT HEX" per line; malformed lines are skipped. */
export function parseEms(text: string): EmsRecord[] {
  const out: EmsRecord[] = []
  let t0: number | null = null
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/)
    if (f.length < 9) continue
    const [prn, yy, mo, dd, hh, mi, ss, mt] = f.slice(0, 8).map(Number)
    const hex = f[8]
    if (![prn, yy, mo, dd, hh, mi, ss, mt].every(Number.isInteger) || !/^[0-9A-Fa-f]{63,64}$/.test(hex)) continue
    const abs = Date.UTC(2000 + yy, mo - 1, dd, hh, mi, ss) / 1000
    t0 ??= abs
    out.push({ prn, time: { year: 2000 + yy, month: mo, day: dd, hour: hh, minute: mi, second: ss }, tS: abs - t0, type: mt, hex })
  }
  return out
}
