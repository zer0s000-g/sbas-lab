/**
 * SBAS messages: the catalogue with plain names, the broadcast schedule and the
 * time-outs.
 *
 * - L1 SBAS messages carry satellite status, clock and ephemeris corrections, and the
 *   ionospheric grid (Doc 9849 §4.3.1.4.2, §4.3.1.5). Type 27 or 28 bound the residual
 *   errors away from the network (§4.3.4.2); Type 0 means "do not use this SBAS for
 *   safety-of-life" (Appendix G, 2.5).
 * - DFMC SBAS messages are broadcast on L5 and carry ionosphere-free clock and
 *   ephemeris corrections with integrity (§4.3.1.4.3); Type 32 is the satellite
 *   clock-ephemeris corrections and covariance message (§4.3.4.2).
 * The other type numbers and names follow RTCA DO-229 (L1) and EUROCAE ED-259 (DFMC).
 */

export type SbasSignal = 'L1' | 'DFMC'

export interface MessageType {
  type: number
  signal: SbasSignal
  name: string
  /** What it tells the aircraft, in plain words. */
  plain: string
}

// TODO(expert-review): message type numbers and names other than Types 0, 27, 28 (L1) and 32 (DFMC), which Doc 9849 names.
export const MESSAGE_TYPES: readonly MessageType[] = [
  { type: 0, signal: 'L1', name: 'Do not use (test mode)', plain: 'This SBAS must not be used for safety' },
  { type: 1, signal: 'L1', name: 'PRN mask', plain: 'Which satellites the corrections are for' },
  { type: 2, signal: 'L1', name: 'Fast corrections', plain: 'Clock corrections, updated every few seconds' },
  { type: 3, signal: 'L1', name: 'Fast corrections', plain: 'Clock corrections for more satellites' },
  { type: 6, signal: 'L1', name: 'Integrity information', plain: 'How much to trust each satellite, and alarms' },
  { type: 7, signal: 'L1', name: 'Fast correction degradation', plain: 'How quickly the clock corrections go stale' },
  { type: 9, signal: 'L1', name: 'GEO navigation', plain: 'Where the GEO satellite is, so it can be used for ranging' },
  { type: 10, signal: 'L1', name: 'Degradation parameters', plain: 'How uncertainty grows when messages are missed' },
  { type: 12, signal: 'L1', name: 'SBAS network time', plain: 'The link between SBAS time and UTC' },
  { type: 17, signal: 'L1', name: 'GEO almanac', plain: 'Where all the GEO satellites are' },
  { type: 18, signal: 'L1', name: 'Ionospheric grid mask', plain: 'Which grid points the delays are for' },
  { type: 25, signal: 'L1', name: 'Long-term corrections', plain: 'Orbit corrections and slow clock corrections' },
  { type: 26, signal: 'L1', name: 'Ionospheric delay corrections', plain: 'The delay at each grid point, with its GIVE' },
  { type: 28, signal: 'L1', name: 'Clock-ephemeris covariance', plain: 'How the correction error grows away from the network' },
  { type: 63, signal: 'L1', name: 'Null message', plain: 'Nothing new this second' },
  { type: 31, signal: 'DFMC', name: 'Satellite mask', plain: 'Which satellites of which constellations are augmented' },
  { type: 32, signal: 'DFMC', name: 'Clock-ephemeris corrections and covariance', plain: 'Orbit and clock corrections for the ionosphere-free measurement' },
  { type: 34, signal: 'DFMC', name: 'Integrity (DFREI)', plain: 'How much to trust each satellite, and alarms' },
  { type: 37, signal: 'DFMC', name: 'Degradation parameters and DFRE table', plain: 'How uncertainty grows when messages are missed' },
  { type: 39, signal: 'DFMC', name: 'SBAS satellite ephemeris', plain: 'Where the GEO satellite is' },
  { type: 47, signal: 'DFMC', name: 'SBAS satellite almanac', plain: 'Where all the SBAS satellites are' },
]

const BY_KEY = new Map(MESSAGE_TYPES.map((m) => [`${m.signal}:${m.type}`, m]))
export const messageType = (signal: SbasSignal, type: number) => BY_KEY.get(`${signal}:${type}`)

/**
 * One message per second on each signal, 250 bits: on L1 an 8-bit preamble, a 6-bit type,
 * 212 bits of data and a 24-bit CRC.
 */
// TODO(expert-review): 250 bit/s, 500 symbols/s after FEC, 8+6+212+24 bit layout (DO-229 / Annex 10 Appendix B).
export const MESSAGE_BITS = { total: 250, preamble: 8, type: 6, data: 212, crc: 24 } as const
/**
 * A DFMC message on L5 is also 250 bits a second, with a 4-bit preamble, so its data
 * field is 216 bits (EUROCAE ED-259; ICAO DFMC SBAS SARPs).
 */
// TODO(expert-review): DFMC L5 layout 4+6+216+24 bits (ED-259 / Annex 10 DFMC SBAS SARPs).
export const DFMC_MESSAGE_BITS = { total: 250, preamble: 4, type: 6, data: 216, crc: 24 } as const

/** The message layout on a signal. */
export const messageBits = (signal: SbasSignal) => (signal === 'L1' ? MESSAGE_BITS : DFMC_MESSAGE_BITS)
export const MESSAGE_PERIOD_S = 1

/** A repeating broadcast plan (illustrative; real schedules are set by the SBAS provider within the time-outs). */
const L1_CYCLE = [1, 2, 3, 26, 2, 3, 25, 2, 3, 18, 2, 3, 26, 2, 3, 9, 2, 3, 7, 2, 3, 10, 2, 3, 28, 2, 3, 12, 2, 3, 26, 2, 3, 17, 2, 63]
const DFMC_CYCLE = [31, 32, 32, 34, 32, 32, 34, 39, 32, 32, 34, 37, 32, 32, 34, 47, 32, 32, 34, 32]

export interface Broadcast {
  /** Second of the journey the message starts. */
  tS: number
  geo: string
  signal: SbasSignal
  type: number
  /** An alarm (a satellite set to "Do not use") rides in this message. */
  alarm?: string
}

/** The message a GEO broadcasts in a given second. The two GEOs are offset so they do not repeat each other. */
export function scheduledMessage(second: number, geoIndex: number, signal: SbasSignal): number {
  const cycle = signal === 'L1' ? L1_CYCLE : DFMC_CYCLE
  const i = (((Math.floor(second) + geoIndex * 7) % cycle.length) + cycle.length) % cycle.length
  return cycle[i]
}

/**
 * Time-outs: how long data may be used after it was last received, s, for precision
 * approach and APV (PA: LNAV/VNAV, LPV) and for en route, terminal and non-precision
 * approach (NPA) (Annex 10 Vol I App B Table B-94). `udrei` is the integrity data (UDREI,
 * Message Types 2–6, 24); the fast corrections themselves time out after I_fc, set by
 * the degradation factor in Message Type 7 (Table B-95), which the page does not model
 * separately.
 */
// TODO(expert-review): message time-outs: Annex 10 App B Table B-94 for L1 (RTCA DO-229 has the same table); the DFMC time-outs (ED-259) are to confirm.
export const TIMEOUTS_S = {
  udrei: { PA: 12, NPA: 18 },
  longTerm: { PA: 240, NPA: 360 },
  iono: { PA: 600, NPA: 600 },
} as const

/** The integrity alarm path: the master detects a fault, the alarm goes up to the GEO and down to the aircraft. */
// TODO(expert-review): detection and alarm latencies are illustrative; the requirement is the time to alert of Doc 9849 Table 2-1.
export const ALARM_LATENCY = { detectS: 2.5, uplinkS: 1.2 } as const

/** The first message second at which an alarm raised at `raisedS` is broadcast (the next whole second after uplink). */
export const alarmBroadcastS = (raisedS: number) => Math.ceil(raisedS + ALARM_LATENCY.detectS + ALARM_LATENCY.uplinkS)
