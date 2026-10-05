/**
 * The arrival traffic of each scenario's controller view (src/core/traffic): streams into
 * the destination, a few aircraft with illustrative callsigns and equipage, and the
 * conventional approach a controller can clear them to when GNSS cannot be used. The
 * streams, callsigns and equipage are illustrative (claim atc.traffic); the conventional
 * approach is named from the AIP, to confirm (claim atc.conventional-approach).
 */
import type { ScenarioId } from './id'
import type { ArrivalStream, Equipage } from '@/core/traffic'

export interface ScenarioTraffic {
  streams: readonly ArrivalStream[]
  aircraft: readonly { callsign: string; stream: string; equip: Equipage; offsetS: number }[]
  joinNm: number
  cycleS: number
  /** The conventional approach for the runway in use, e.g. "ILS RWY 04L". */
  conventional: string
  /** The place the controller names in a GNSS warning. */
  vicinity: string
}

export const SCENARIO_TRAFFIC: Readonly<Record<ScenarioId, ScenarioTraffic>> = {
  essp: {
    streams: [
      { id: 'west', name: 'WEST', fromBearingDeg: 250, entryNm: 34 },
      { id: 'south', name: 'SEA', fromBearingDeg: 175, entryNm: 34 },
      { id: 'north', name: 'NORTH', fromBearingDeg: 320, entryNm: 30 },
    ],
    aircraft: [
      { callsign: 'EDU311', stream: 'west', equip: 'sbas', offsetS: 0 },
      { callsign: 'SIM45', stream: 'south', equip: 'sbas', offsetS: 260 },
      { callsign: 'LAB202', stream: 'north', equip: 'gps', offsetS: 520 },
      { callsign: 'EDU77', stream: 'west', equip: 'conventional', offsetS: 780 },
      { callsign: 'SIM208', stream: 'south', equip: 'sbas', offsetS: 1040 },
    ],
    joinNm: 9,
    cycleS: 1300,
    conventional: 'ILS RWY 04L',
    vicinity: 'NICE',
  },
  indonesia: {
    streams: [
      { id: 'west', name: 'JAVA', fromBearingDeg: 280, entryNm: 34 },
      { id: 'north', name: 'NORTH', fromBearingDeg: 350, entryNm: 32 },
      { id: 'south', name: 'SEA', fromBearingDeg: 200, entryNm: 30 },
    ],
    aircraft: [
      { callsign: 'EDU311', stream: 'west', equip: 'sbas', offsetS: 0 },
      { callsign: 'SIM45', stream: 'north', equip: 'sbas', offsetS: 260 },
      { callsign: 'LAB202', stream: 'south', equip: 'gps', offsetS: 520 },
      { callsign: 'EDU77', stream: 'west', equip: 'conventional', offsetS: 780 },
      { callsign: 'SIM208', stream: 'north', equip: 'sbas', offsetS: 1040 },
    ],
    joinNm: 9,
    cycleS: 1300,
    conventional: 'ILS RWY 09',
    vicinity: 'BALI',
  },
}
