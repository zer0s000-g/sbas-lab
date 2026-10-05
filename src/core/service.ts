/**
 * SBAS service provision, as an air navigation service provider and the SBAS service
 * provider see it: will LPV be available at an airport over the next hours, and what
 * NOTAM should be proposed if not (Doc 9849 §4.3.3.4.1; ESSP's NOTAM proposal service
 * predicts when an EGNOS service level will be unavailable at airports and proposes
 * NOTAMs to the NOTAM offices, EGNOS SoL SDD §3.4.4). The page proposes NOTAMs for APV-I
 * only, a simplification.
 *
 * The prediction runs the same deterministic SBAS world forward in time at the airport,
 * with the conditions it is given, so the forecast, the map and the cockpit always agree.
 * The service panel gives it only what is known in advance (a storm forecast, a planned
 * RIMS outage: scenarios/essp/provision FORECASTABLE); a sudden failure such as a lost
 * GEO is not in a forecast. A real prediction uses the almanac, the planned
 * outages and the service volume model; this one is the page's own model.
 */
import { approachMode, groundFor, snapshot, type Conditions } from './sbasWorld'
import { OPERATIONS, type OperationId } from './operations'
import { M_PER_FT } from './units'
import { isFiniteNumber } from './guard'
import type { Airport } from './sites'

export interface AvailabilitySample {
  /** Journey time, s. */
  tS: number
  /** LPV available within the operation's alert limits. */
  available: boolean
  hplM: number | null
  vplM: number | null
}

export interface Window {
  fromS: number
  toS: number
}

export interface Forecast {
  airportId: string
  op: OperationId
  samples: AvailabilitySample[]
  /** Periods of predicted unavailability (each from its first unavailable sample to the next available one). */
  outages: Window[]
  /** Share of samples available, 0..1. */
  availability: number
}

/** Height above the threshold the prediction is made at, ft: on final, near the decision height. */
export const FORECAST_HEIGHT_FT = 300

/**
 * LPV availability at an airport from `fromS` to `toS` (journey time), every `stepS`,
 * for an operation's alert limits (APV-I or LPV-200).
 */
export function forecastAt(airport: Airport, op: OperationId, fromS: number, toS: number, stepS: number, c: Conditions): Forecast {
  const samples: AvailabilitySample[] = []
  if (!(stepS > 0) || !isFiniteNumber(fromS) || !isFiniteNumber(toS) || toS < fromS) return { airportId: airport.id, op, samples, outages: [], availability: 0 }
  const where = { latDeg: airport.threshold.latDeg, lonDeg: airport.threshold.lonDeg, hM: (airport.elevationFt + FORECAST_HEIGHT_FT) * M_PER_FT }
  const n = Math.floor((toS - fromS) / stepS)
  for (let k = 0; k <= n; k++) {
    const tS = fromS + k * stepS
    const s = snapshot(tS, where, c, groundFor(tS, c))
    const am = approachMode(s, OPERATIONS[op])
    samples.push({ tS, available: am.mode === 'LPV', hplM: am.fix?.hplM ?? null, vplM: am.fix?.vplM ?? null })
  }
  return { airportId: airport.id, op, samples, outages: outagesOf(samples, stepS), availability: samples.filter((x) => x.available).length / Math.max(samples.length, 1) }
}

/** Runs of unavailable samples, as windows. */
export function outagesOf(samples: readonly AvailabilitySample[], stepS: number): Window[] {
  const out: Window[] = []
  let start: number | null = null
  for (const x of samples) {
    if (!x.available && start === null) start = x.tS
    if (x.available && start !== null) {
      out.push({ fromS: start, toS: x.tS })
      start = null
    }
  }
  if (start !== null && samples.length) out.push({ fromS: start, toS: samples[samples.length - 1].tS + stepS })
  return out
}

/** Clock time hh:mm (UTC) of a journey time, given the UTC hour at the start. */
export function utcClock(tS: number, startUtcHour: number): string {
  const m = Math.floor((((startUtcHour * 3600 + tS) / 60) % 1440 + 1440) % 1440)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`
}

export interface NotamProposal {
  /** Item A: the aerodrome. */
  a: string
  /** Items B and C: start and end, UTC (hhmm on the day of the flight; the page has no calendar date). */
  b: string
  c: string
  /** Item E: the text. */
  e: string
}

// TODO(expert-review): NOTAM proposal item E wording and the omitted Q line are illustrative; the format ESSP and the NOTAM offices agree is not reproduced.
/**
 * A proposed NOTAM for each predicted APV-I outage at the airport: items A (location),
 * B and C (validity) and E (text), as in the ICAO NOTAM format. The wording of item E
 * and the omitted Q line are illustrative, not the format ESSP and the NOTAM offices
 * agree on.
 */
export function notamProposals(f: Forecast, airport: Airport, procedure: string, provider: string, startUtcHour: number): NotamProposal[] {
  if (f.op !== 'apv1') return []
  return f.outages.map((w) => ({
    a: airport.id,
    b: utcClock(w.fromS, startUtcHour),
    c: utcClock(w.toS, startUtcHour),
    e: `${provider} APV-I SERVICE PREDICTED NOT AVBL. ${procedure} LPV MINIMA NOT AVBL.`,
  }))
}
