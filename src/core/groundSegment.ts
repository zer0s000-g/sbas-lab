/**
 * The SBAS ground segment (Doc 9849 §4.3.1.1): reference stations at surveyed
 * positions watch the satellites; the master station works out, for each satellite,
 * the clock and orbit correction and a bound on what is left (UDRE for L1, DFRE for
 * DFMC), sets faulty satellites to "Do Not Use" and satellites it cannot watch to
 * "Not Monitored" (§4.3.1.3), and, for L1 SBAS, builds the ionospheric grid (§4.3.1.4).
 */
import { geodeticToEcef, lookAngles } from './geo'
import { estimateIgps, igpKey, piercePoint, verticalDelayL1, type IgpEstimate, type IonoConditions, type IonoObservation } from './iono'
import { ALARM_LATENCY } from './messages'
import { GPS_SATS, satEcef, type SatDef } from './orbits'
import { REFERENCE_STATIONS, type Station } from './region'
import { satErrors, smoothGauss, satCode, type FaultInjection } from './errors'
import { hash2 } from './random'

/** Elevation mask for tracking, degrees. */
// TODO(expert-review): 5° mask angle for aircraft and reference receivers.
export const MASK_DEG = 5

// TODO(expert-review): UDREI table (RTCA DO-229, Table A-6): UDRE in metres; 14 = Not Monitored, 15 = Do Not Use.
export const UDRE_TABLE_M = [0.75, 1.0, 1.25, 1.75, 2.25, 3.0, 3.75, 4.5, 5.25, 6.0, 7.5, 15.0, 50.0, 150.0] as const
export const UDREI_NOT_MONITORED = 14
export const UDREI_DO_NOT_USE = 15
/** LP/LPV need UDREI ≠ 13 (Doc 9849 §4.3.1.3). */
export const UDREI_NOT_FOR_LPV = 13

export const udreIndex = (udreM: number) => {
  const i = UDRE_TABLE_M.findIndex((u) => u >= udreM)
  return i < 0 ? UDREI_NOT_MONITORED : i
}
/** σ of the residual clock and orbit error for a UDREI: UDRE bounds 99.9 % (3.29 σ). */
// TODO(expert-review): relation of σ_UDRE to UDRE (DO-229 tabulates σ²_UDRE per UDREI).
export const sigmaUdreM = (udrei: number) => (udrei >= UDREI_NOT_MONITORED ? Infinity : UDRE_TABLE_M[udrei] / 3.29)

export interface GroundConditions extends IonoConditions {
  seed: number
  /** Reference stations switched off (the "reference station offline" failure). */
  offline: readonly string[]
  fault: FaultInjection | null
}

export interface SatCorrection {
  satId: string
  /** Correction for clock + orbit along the line of sight, m (the aircraft subtracts it). */
  correctionM: number
  udrei: number
  /** How many reference stations see it. */
  seenBy: number
  status: 'ok' | 'not-monitored' | 'do-not-use'
}

export interface GroundSnapshot {
  corrections: Map<string, SatCorrection>
  grid: Map<string, IgpEstimate>
  gridList: IgpEstimate[]
  /** What each station measured: for the network map and the reference phase. */
  observations: { stationId: string; satId: string; elDeg: number; residualM: number }[]
  ionoObs: IonoObservation[]
}

export const activeStations = (offline: readonly string[]): Station[] => REFERENCE_STATIONS.filter((s) => !offline.includes(s.id))

/**
 * One master-station solution at time t. Its corrections estimate the true clock and
 * orbit error with a small estimation error that shrinks as more stations see the
 * satellite; a satellite seen by fewer than two stations is Not Monitored.
 */
export function groundSolution(c: GroundConditions): GroundSnapshot {
  const stations = activeStations(c.offline)
  const corrections = new Map<string, SatCorrection>()
  const observations: GroundSnapshot['observations'] = []
  const ionoObs: IonoObservation[] = []
  for (const sat of GPS_SATS) {
    const pos = satEcef(sat, c.tS)
    let seenBy = 0
    for (const st of stations) {
      const look = lookAngles(st.pos, pos)
      if (!look || look.elDeg < MASK_DEG) continue
      seenBy++
      const e = satErrors(sat.id, look.elDeg, st.pos.hM, c.tS, c.seed, satCode(st.id), c.fault)
      observations.push({ stationId: st.id, satId: sat.id, elDeg: look.elDeg, residualM: e.clockM + e.orbitM })
      const pp = piercePoint(st.pos.latDeg, st.pos.lonDeg, look.azDeg, look.elDeg)
      if (pp) {
        // Dual-frequency ground receivers measure the delay well; a little noise stays.
        const noise = smoothGauss(satCode(sat.id + st.id), c.tS, 30, 0.1, c.seed + 9)
        ionoObs.push({ latDeg: pp.latDeg, lonDeg: pp.lonDeg, delayM: verticalDelayL1(pp.latDeg, pp.lonDeg, c) + noise })
      }
    }
    corrections.set(sat.id, correctionFor(sat, seenBy, c))
  }
  const gridList = estimateIgps(ionoObs, c)
  const grid = new Map(gridList.map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
  return { corrections, grid, gridList, observations, ionoObs }
}

function correctionFor(sat: SatDef, seenBy: number, c: GroundConditions): SatCorrection {
  if (seenBy < 2) return { satId: sat.id, correctionM: 0, udrei: UDREI_NOT_MONITORED, seenBy, status: 'not-monitored' }
  // The truth the network sees (clock + orbit; the orbit part is taken along a typical line of sight).
  const truth = satErrors(sat.id, 45, 0, c.tS, c.seed, 0, null)
  const code = satCode(sat.id)
  const estErrSigma = 0.35 / Math.sqrt(seenBy)
  const estErr = smoothGauss(code, c.tS, 60, estErrSigma, c.seed + 5)
  let correctionM = truth.clockM + truth.orbitM + estErr
  const f = c.fault
  if (f && f.satId === sat.id && c.tS >= f.startS) {
    // Before detection the old correction goes on being sent; once detected, "Do Not Use".
    if (c.tS >= f.startS + ALARM_LATENCY.detectS) return { satId: sat.id, correctionM, udrei: UDREI_DO_NOT_USE, seenBy, status: 'do-not-use' }
  }
  // UDRE: a 99.9 % bound on what the correction leaves, larger when few stations see the satellite.
  const udre = 3.29 * Math.hypot(estErrSigma * 1.6, 0.18) * (seenBy >= 4 ? 1 : 1.4)
  // A satellite occasionally flagged as not good enough for LPV (UDREI 13) keeps the rule visible.
  const udrei = hash2(code, Math.floor(c.tS / 600), c.seed) < 0.02 ? UDREI_NOT_FOR_LPV : udreIndex(udre)
  correctionM = Number.isFinite(correctionM) ? correctionM : 0
  return { satId: sat.id, correctionM, udrei, seenBy, status: 'ok' }
}

/** ECEF positions of the ground stations, for the views. */
export const stationEcef = (s: Station) => geodeticToEcef(s.pos)
