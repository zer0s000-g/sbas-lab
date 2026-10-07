/**
 * Service-area maps on real GPS orbits. For a grid of user positions and a set of
 * epochs, the GPS satellites come from the real broadcast ephemeris of the day
 * (./ephemeris); the SBAS corrections come from a corrections source:
 * - "modelled": the page's ground-segment model on the real geometry. The reference
 *   network is the list of RIMS sites passed in; UDRE grows when few of them see a
 *   satellite (groundSegment.udreForSeenByM), and the ionospheric grid is estimated from
 *   the model ionosphere at their pierce points (iono.estimateIgps). Labelled modelled.
 * - real EGNOS messages, when a recording of the day is supplied (scripts/data).
 * Each grid point gets the protection levels of an SBAS receiver for approaches with
 * vertical guidance (K_H 6.0, K_V 5.33) and for non-precision approach (K_H 6.18), from
 * the same receiver code as the journey (receiver.solveFix). Pure.
 */
import { lookAngles, type Geodetic, type Vec3 } from './geo'
import { pickEphemeris, satState } from './ephemeris'
import type { GpsEphemeris } from './rinex'
import { MASK_DEG, sigmaUdreM, udreForSeenByM, udreIndex, UDREI_NOT_MONITORED, usableForPa } from './groundSegment'
import { estimateIgps, GIVEI_NOT_MONITORED, interpolateGrid, igpKey, piercePoint, sigmaIonoNoSbasM, verticalDelayL1, IGP_SPACING_DEG, type Igp, type IgpEstimate, type IonoConditions, type IonoObservation } from './iono'
import { sigmaAirL1M, SIGMA_TROPO_VERTICAL_M, tropoMapping } from './errors'
import { solveFix, type Measurement } from './receiver'
import { slotSystem, type DecoderState } from './sbasDecode'
import { TIMEOUTS_S } from './messages'

export interface RealSat {
  prn: number
  ecef: Vec3
}

/** The healthy GPS satellites at absolute GPS time t, from the broadcast ephemeris. */
export function realSatsAt(ephs: readonly GpsEphemeris[], tAbsS: number): RealSat[] {
  const out: RealSat[] = []
  for (let prn = 1; prn <= 32; prn++) {
    const e = pickEphemeris(ephs, prn, tAbsS)
    if (e) out.push({ prn, ecef: satState(e, tAbsS).ecef })
  }
  return out
}

export interface ModelledGround {
  /** PRN → UDREI. */
  udrei: Map<number, number>
  grid: Map<string, IgpEstimate>
}

/**
 * The IGPs over a box, laid out as in the broadcast IGP bands (./sbasDecode): 5° apart up
 * to 60° of latitude, 10° apart in longitude between 60° and 85° (bands 9 and 10).
 */
export function igpsOver(box: { lat0: number; lat1: number; lon0: number; lon1: number }): Igp[] {
  const out: Igp[] = []
  for (let lat = box.lat0; lat <= box.lat1; lat += IGP_SPACING_DEG)
    for (let lon = box.lon0; lon <= box.lon1; lon += IGP_SPACING_DEG) {
      if (Math.abs(lat) > 60 && lon % (2 * IGP_SPACING_DEG) !== 0) continue
      out.push({ latDeg: lat, lonDeg: lon })
    }
  return out
}

/**
 * The modelled master-station solution on real geometry: which satellites the reference
 * network monitors and with what UDRE, and the ionospheric grid it estimates.
 */
export function modelledGround(sats: readonly RealSat[], rims: readonly Geodetic[], iono: IonoConditions, igps: readonly Igp[]): ModelledGround {
  const udrei = new Map<number, number>()
  const obs: IonoObservation[] = []
  for (const s of sats) {
    let seenBy = 0
    for (const st of rims) {
      const look = lookAngles(st, s.ecef)
      if (!look || look.elDeg < MASK_DEG) continue
      seenBy++
      const pp = piercePoint(st.latDeg, st.lonDeg, look.azDeg, look.elDeg)
      if (pp) obs.push({ latDeg: pp.latDeg, lonDeg: pp.lonDeg, delayM: verticalDelayL1(pp.latDeg, pp.lonDeg, iono) })
    }
    udrei.set(s.prn, seenBy < 2 ? UDREI_NOT_MONITORED : udreIndex(udreForSeenByM(seenBy)))
  }
  const grid = new Map(estimateIgps(obs, iono, igps).map((g) => [igpKey(g.latDeg, g.lonDeg), g]))
  return { udrei, grid }
}

export interface PointLevels {
  /** Protection levels for approaches with vertical guidance; null when no PA solution. */
  hplPaM: number | null
  vplPaM: number | null
  /** Horizontal protection level for non-precision approach; null when no solution. */
  hplNpaM: number | null
  nPa: number
}

/** Whether a satellite with this UDREI may be used for vertical guidance (the journey's rule, ./groundSegment). */
export { usableForPa }


/** The protection levels at one user position. */
export function levelsAt(user: Geodetic, sats: readonly RealSat[], ground: ModelledGround): PointLevels {
  const pa: Measurement[] = []
  const npa: Measurement[] = []
  for (const s of sats) {
    const ui = ground.udrei.get(s.prn)
    if (ui === undefined || ui >= UDREI_NOT_MONITORED) continue
    const look = lookAngles(user, s.ecef)
    if (!look || look.elDeg < MASK_DEG) continue
    const pp = piercePoint(user.latDeg, user.lonDeg, look.azDeg, look.elDeg)
    if (!pp) continue
    const sigUdre = sigmaUdreM(ui)
    const sigTropo = SIGMA_TROPO_VERTICAL_M * tropoMapping(look.elDeg)
    const sigAir = sigmaAirL1M(look.elDeg)
    const grid = interpolateGrid(ground.grid, pp)
    const id = `G${String(s.prn).padStart(2, '0')}`
    if (grid) {
      const m: Measurement = { satId: id, los: look.los, elDeg: look.elDeg, errorM: 0, sigmaM: Math.hypot(sigUdre, grid.sigmaM * pp.obliquity, sigTropo, sigAir) }
      npa.push(m)
      if (usableForPa(ui)) pa.push(m)
    } else {
      // Outside the grid: the broadcast-model bound, as in the journey (iono.sigmaIonoNoSbasM). The map
      // carries no broadcast-model delay, so only its F_pp·τ_vert term applies.
      npa.push({ satId: id, los: look.los, elDeg: look.elDeg, errorM: 0, sigmaM: Math.hypot(sigUdre, sigmaIonoNoSbasM(pp), sigTropo, sigAir) })
    }
  }
  const fPa = solveFix('l1sbas', pa, { pa: true })
  const fNpa = solveFix('l1sbas', npa)
  return { hplPaM: fPa?.hplM ?? null, vplPaM: fPa?.vplM ?? null, hplNpaM: fNpa?.hplM ?? null, nPa: pa.length }
}

export interface MapSpec {
  lat0: number
  lat1: number
  lon0: number
  lon1: number
  stepDeg: number
}

/** The grid points of a map, row by row from the south-west corner. */
export function gridPoints(spec: MapSpec): Geodetic[] {
  const out: Geodetic[] = []
  for (let lat = spec.lat0; lat <= spec.lat1 + 1e-9; lat += spec.stepDeg) for (let lon = spec.lon0; lon <= spec.lon1 + 1e-9; lon += spec.stepDeg) out.push({ latDeg: lat, lonDeg: lon, hM: 0 })
  return out
}

/**
 * Packs a protection level into one byte: 0.5 m steps to 100 m, then 5 m steps to
 * 365 m; 254 = beyond that, 255 = no solution. Enough for the approach alert limits the
 * packed layers are compared with (NPA's 556 m is a separate bit layer).
 */
export function packLevel(m: number | null): number {
  if (m === null || !Number.isFinite(m)) return 255
  if (m < 100) return Math.max(0, Math.round(m * 2))
  return Math.min(254, 200 + Math.round((m - 100) / 5))
}

/** The inverse of packLevel (the upper edge of the step, so a bound stays a bound); null for 255, Infinity for 254. */
export function unpackLevel(b: number): number | null {
  if (b === 255) return null
  if (b === 254) return Infinity
  return b < 200 ? (b + 0.5) / 2 : 100 + (b - 200) * 5 + 2.5
}

/**
 * The same picture from real SBAS messages: the decoder's state (./sbasDecode) at second
 * `nowS` turned into UDREIs by GPS PRN and an ionospheric grid. Data older than its
 * time-out for approaches with vertical guidance is dropped (messages.TIMEOUTS_S: the
 * UDREI from when it was last received, in any of Message Types 2–6 and 24; the grid).
 * The map uses only the UDREIs, not the correction values. Not applied yet (claim
 * `servicemap.egnos-real`): the fast corrections' own time-out and degradation (Message
 * Type 7) and the degradation parameters of Message Type 10.
 */
export function groundFromDecoder(state: DecoderState, nowS: number, udreiTimeoutS: number = TIMEOUTS_S.udrei.PA, gridTimeoutS: number = TIMEOUTS_S.iono.PA): ModelledGround {
  const udrei = new Map<number, number>()
  state.maskBits.forEach((bit, slot) => {
    const sys = slotSystem(bit)
    const f = state.fast.get(slot)
    if (sys.system !== 'GPS' || !f || nowS - f.udreiTS > udreiTimeoutS) return
    udrei.set(sys.prn, f.udrei)
  })
  const grid = new Map<string, IgpEstimate>()
  for (const g of state.grid.values()) {
    if (nowS - g.tS > gridTimeoutS) continue
    grid.set(igpKey(g.latDeg, g.lonDeg), { latDeg: g.latDeg, lonDeg: g.lonDeg, delayM: g.delayM ?? 0, givei: g.delayM === null ? GIVEI_NOT_MONITORED : g.givei })
  }
  return { udrei, grid }
}
