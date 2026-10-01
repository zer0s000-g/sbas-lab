/**
 * One moment of the SBAS world, seen from LAB201: which satellites are in view and
 * tracked, what each one's range error is made of, what the ground segment sends, and
 * the three receiver solutions (GPS alone, L1 SBAS, DFMC SBAS) on the same
 * measurements. Pure: the same inputs always give the same snapshot.
 */
import { lookAngles, type Geodetic, type Vec3 } from './geo'
import { ALL_SATS, satEcef, type SatDef } from './orbits'
import { broadcastModelSlantL1, interpolateGrid, piercePoint, scintillationLoss, verticalDelayL1, type PiercePoint } from './iono'
import { satErrors, tropoModelM, sigmaAirL1M, SIGMA_CLOCK_M, SIGMA_ORBIT_M, SIGMA_TROPO_VERTICAL_M, tropoMapping, IF_GAMMA, IF_NOISE_FACTOR, type FaultInjection } from './errors'
import { groundSolution, MASK_DEG, sigmaUdreM, UDREI_NOT_FOR_LPV, UDREI_NOT_MONITORED, type GroundSnapshot } from './groundSegment'
import { solveFix, type ApproachMode, type FixResult, type Measurement } from './receiver'
import { alarmBroadcastS, TIMEOUTS_S } from './messages'
import { OPERATIONS, type Operation } from './operations'
import { DEG } from './units'
import { START_LOCAL_HOUR } from './region'

export type SbasService = 'dfmc' | 'l1' | 'off'

export interface Conditions {
  seed: number
  startLocalHour: number
  storm: number
  scintillation: boolean
  /** Which SBAS service the aircraft uses: dual-frequency (L1/L5), L1 only, or none. */
  service: SbasService
  /** Both GEO signals lost from this time on (the "GEO signal lost" failure), s; null = received. */
  geoLostFromS: number | null
  offlineStations: readonly string[]
  fault: FaultInjection | null
  /** No GNSS at all (the "GPS jamming" failure). */
  jammed: boolean
}

export const NOMINAL: Conditions = {
  seed: 201,
  startLocalHour: START_LOCAL_HOUR,
  storm: 0,
  scintillation: false,
  service: 'dfmc',
  geoLostFromS: null,
  offlineStations: [],
  fault: null,
  jammed: false,
}

export interface SatView {
  id: string
  kind: SatDef['kind']
  ecef: Vec3
  azDeg: number
  elDeg: number
  /** Above the mask. */
  visible: boolean
  /** Visible and the signal is held (not lost to scintillation or jamming). */
  tracked: boolean
  pp: PiercePoint | null
  /** The parts of the L1 range error, m (GPS only). */
  parts: { clock: number; orbit: number; iono: number; tropo: number; multipath: number } | null
}

export interface ServiceState {
  /** SBAS data usable for approaches with vertical guidance / for en route to NPA. */
  paValid: boolean
  npaValid: boolean
  /** Seconds since the last SBAS message was received. */
  messageAgeS: number
  geosTracked: number
}

export interface Snapshot {
  tS: number
  sats: SatView[]
  ground: GroundSnapshot
  service: ServiceState
  abas: FixResult
  l1sbas: FixResult
  /** L1 SBAS restricted to satellites whose ionosphere comes from the grid (for vertical guidance). */
  l1sbasPa: FixResult
  dfmc: FixResult
  /** The solution the aircraft navigates with for its service choice. */
  sbasFix: FixResult
  sbasPaFix: FixResult
  /** A satellite the aircraft has been told not to use (the alarm has arrived). */
  alarmedSats: string[]
}

// TODO(expert-review): σ of the single-frequency broadcast-model ionospheric residual: τ_vert = 9 m at low magnetic latitudes (DO-229 Klobuchar variance), times the obliquity.
const TAU_VERT_ABAS_M = 9
const SIGMA_URA_M = Math.hypot(SIGMA_CLOCK_M, SIGMA_ORBIT_M)

/** Whether the aircraft has received the alarm for a satellite by time t. */
export function alarmReceived(fault: FaultInjection | null, satId: string, tS: number): boolean {
  if (!fault || fault.satId !== satId) return false
  return tS >= alarmBroadcastS(fault.startS) + 1
}

/** The ground segment's solution for a moment: the same for every receiver, so it can be shared. */
export const groundFor = (tS: number, c: Conditions): GroundSnapshot =>
  groundSolution({ tS, startLocalHour: c.startLocalHour, storm: c.storm, scintillation: c.scintillation, seed: c.seed, offline: c.offlineStations, fault: c.fault })

/** The SBAS world seen from a receiver. `ground` may pass in `groundFor(tS, c)` when many receivers share one moment. */
export function snapshot(tS: number, aircraft: Geodetic, c: Conditions, ground: GroundSnapshot = groundFor(tS, c)): Snapshot {
  const iono = { tS, startLocalHour: c.startLocalHour, storm: c.storm, scintillation: c.scintillation }
  const sats: SatView[] = []
  const abas: Measurement[] = []
  const l1: Measurement[] = []
  const l1Pa: Measurement[] = []
  const df: Measurement[] = []
  let geosTracked = 0
  const geoLost = c.geoLostFromS !== null && tS >= c.geoLostFromS
  const alarmed: string[] = []

  for (const sat of ALL_SATS) {
    const ecef = satEcef(sat, tS)
    const look = lookAngles(aircraft, ecef)
    const visible = !!look && look.elDeg >= MASK_DEG
    const pp = look && visible ? piercePoint(aircraft.latDeg, aircraft.lonDeg, look.azDeg, look.elDeg) : null
    const scint = sat.kind === 'gps' ? scintillationLoss(sat.id, pp, iono) : false
    const tracked = visible && !c.jammed && !scint && !(sat.kind === 'geo' && geoLost)
    const view: SatView = { id: sat.id, kind: sat.kind, ecef, azDeg: look?.azDeg ?? 0, elDeg: look?.elDeg ?? -90, visible, tracked, pp, parts: null }
    sats.push(view)
    if (sat.kind === 'geo') {
      if (tracked) geosTracked++
      continue
    }
    if (!look || !tracked || !pp) continue
    const el = look.elDeg
    const e = satErrors(sat.id, el, aircraft.hM, tS, c.seed, 1, c.fault)
    const ionoL1 = verticalDelayL1(pp.latDeg, pp.lonDeg, iono) * pp.obliquity
    const tropoResid = e.tropoM - tropoModelM(el, aircraft.hM)
    const sigTropo = SIGMA_TROPO_VERTICAL_M * tropoMapping(el)
    const sigAir = sigmaAirL1M(el)
    view.parts = { clock: e.clockM, orbit: e.orbitM, iono: ionoL1, tropo: e.tropoM, multipath: e.mpNoiseL1M }

    // GPS alone: broadcast ionospheric model.
    const ionoAbasResid = ionoL1 - broadcastModelSlantL1(ionoL1, pp.latDeg, pp.lonDeg, tS)
    abas.push({
      satId: sat.id,
      los: look.los,
      elDeg: el,
      errorM: e.clockM + e.orbitM + ionoAbasResid + tropoResid + e.mpNoiseL1M,
      sigmaM: Math.hypot(SIGMA_URA_M, TAU_VERT_ABAS_M * pp.obliquity, sigTropo, sigAir),
    })

    const corr = ground.corrections.get(sat.id)
    const aircraftDnu = alarmReceived(c.fault, sat.id, tS)
    if (aircraftDnu) alarmed.push(sat.id)
    if (!corr || corr.udrei >= UDREI_NOT_MONITORED || aircraftDnu) continue
    const clockOrbitResid = e.clockM + e.orbitM - corr.correctionM
    const sigUdre = sigmaUdreM(corr.udrei)

    // L1 SBAS: the grid where it is monitored, otherwise the broadcast model (not for vertical guidance).
    const grid = interpolateGrid(ground.grid, pp)
    const lpvOk = corr.udrei !== UDREI_NOT_FOR_LPV
    if (grid) {
      const m: Measurement = {
        satId: sat.id,
        los: look.los,
        elDeg: el,
        errorM: clockOrbitResid + (ionoL1 - grid.delayM * pp.obliquity) + tropoResid + e.mpNoiseL1M,
        sigmaM: Math.hypot(sigUdre, grid.sigmaM * pp.obliquity, sigTropo, sigAir),
      }
      l1.push(m)
      if (lpvOk) l1Pa.push(m)
    } else {
      l1.push({ satId: sat.id, los: look.los, elDeg: el, errorM: clockOrbitResid + ionoAbasResid + tropoResid + e.mpNoiseL1M, sigmaM: Math.hypot(sigUdre, TAU_VERT_ABAS_M * pp.obliquity, sigTropo, sigAir) })
    }

    // DFMC: ionosphere-free L1/L5 (the first-order delay cancels; multipath and noise are amplified).
    if (sat.l5 && lpvOk) {
      const ifMp = (IF_GAMMA * e.mpNoiseL1M - e.mpNoiseL5M) / (IF_GAMMA - 1)
      // The L5 delay is (f1/f5)² times the L1 delay; the combination removes both (only a tiny higher-order part remains).
      // TODO(expert-review): DFRE is modelled with the same bound as UDRE here; the DFREI table (ED-259) differs.
      df.push({ satId: sat.id, los: look.los, elDeg: el, errorM: clockOrbitResid + tropoResid + ifMp, sigmaM: Math.hypot(sigUdre, sigTropo, IF_NOISE_FACTOR * sigAir) })
    }
  }

  const lostFor = geoLost ? tS - (c.geoLostFromS ?? tS) : 0
  const anyGeo = geosTracked > 0 || lostFor < TIMEOUTS_S.fastCorrections.NPA
  const service: ServiceState = {
    paValid: c.service !== 'off' && !c.jammed && (geosTracked > 0 || lostFor < TIMEOUTS_S.fastCorrections.PA),
    npaValid: c.service !== 'off' && !c.jammed && anyGeo,
    messageAgeS: geosTracked > 0 ? 0 : lostFor,
    geosTracked,
  }
  const fixAbas = solveFix('abas', abas)
  const fixL1 = solveFix('l1sbas', l1)
  const fixL1Pa = solveFix('l1sbas', l1Pa, { pa: true })
  const fixDf = solveFix('dfmc', df, { pa: true })
  const sbasFix = c.service === 'dfmc' ? fixDf : c.service === 'l1' ? fixL1 : null
  const sbasPaFix = c.service === 'dfmc' ? fixDf : c.service === 'l1' ? fixL1Pa : null
  return { tS, sats, ground, service, abas: fixAbas, l1sbas: fixL1, l1sbasPa: fixL1Pa, dfmc: fixDf, sbasFix: service.npaValid ? sbasFix : null, sbasPaFix: service.paValid ? sbasPaFix : null, alarmedSats: alarmed }
}

export interface NavStatus {
  /** The solution in use: SBAS when it is valid, otherwise GPS alone. */
  source: 'sbas' | 'abas' | 'none'
  fix: FixResult
  /** Within the operation's alert limits. */
  ok: boolean
}

/** En route, terminal and non-precision navigation: SBAS when valid (Doc 9849 §4.3.1.5), otherwise ABAS (§4.3.4.3). */
export function navStatus(s: Snapshot, op: Operation): NavStatus {
  if (s.sbasFix && s.sbasFix.hplM <= op.halM) return { source: 'sbas', fix: s.sbasFix, ok: true }
  if (s.abas && !s.abas.alarm && s.abas.hplM <= op.halM) return { source: 'abas', fix: s.abas, ok: true }
  const fix = s.sbasFix ?? s.abas
  return { source: fix ? (fix === s.sbasFix ? 'sbas' : 'abas') : 'none', fix, ok: false }
}

/**
 * The approach mode the avionics annunciate: the highest level of service the signal
 * and the receiver support (Doc 9849 §4.3.2.5). LPV needs SBAS vertical guidance within
 * the procedure's alert limits (stored in the FAS data block, §4.3.3.2).
 */
export function approachMode(s: Snapshot, lpvOp: Operation = OPERATIONS.apv1): { mode: ApproachMode; fix: FixResult } {
  const pa = s.sbasPaFix
  if (pa && pa.vplM !== null && pa.hplM <= lpvOp.halM && pa.vplM <= (lpvOp.valM ?? 0)) return { mode: 'LPV', fix: pa }
  const vnav = OPERATIONS.lnavvnav
  if (pa && pa.vplM !== null && pa.hplM <= vnav.halM && pa.vplM <= (vnav.valM ?? 0)) return { mode: 'LNAV/VNAV', fix: pa }
  const npa = OPERATIONS.npa
  if (s.sbasFix && s.sbasFix.hplM <= npa.halM) return { mode: 'LNAV', fix: s.sbasFix }
  if (s.abas && !s.abas.alarm && s.abas.hplM <= npa.halM) return { mode: 'LNAV', fix: s.abas }
  return { mode: 'NONE', fix: s.sbasFix ?? s.abas }
}

/** Degrees between two ECEF directions, for the views. */
export const angleBetweenDeg = (a: Vec3, b: Vec3) => {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))
  return Math.acos(Math.max(-1, Math.min(1, d))) / DEG
}
