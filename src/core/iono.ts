/**
 * The ionosphere, worldwide, with what matters near the magnetic equator (the AirNav
 * Indonesia scenario) and at mid-latitudes (the ESSP-SAS scenario over southern France).
 *
 * What the model shows (Doc 9849 §5.2.1):
 * - the delay depends on the density of ionised particles, which follows the sun
 *   (§5.2.1.1–5.2.1.2), so it peaks in the early afternoon;
 * - near the equator, bands of dense ionisation form about 15° north and south of the
 *   magnetic equator, and narrow depleted "bubbles" grow in them after local sunset
 *   and last into the night (§5.2.1.5). The magnetic equator runs north of Indonesia,
 *   so Java and Bali lie under the southern band;
 * - scintillation occurs in patches, affects only a few satellites at a time, and
 *   affects every GNSS frequency (§5.2.1.3–5.2.1.4).
 * The numbers (TEC levels, band widths, bubble sizes) are illustrative, chosen so the
 * effects are visible; they are not measurements.
 *
 * Geometry: a thin-shell model with ionospheric pierce points and the obliquity
 * factor, as used by SBAS receivers.
 */
import { DEG, GPS_L1_HZ, WGS84_A_M, clamp } from './units'
import { hash2, valueNoise } from './random'
import { START_LOCAL_HOUR, localSolarHour, magLatDeg } from './region'
import { SCENARIO } from '@/scenarios/active'

// TODO(expert-review): 350 km thin-shell height and the pierce-point formulas follow RTCA DO-229 (Appendix A); confirm the edition.
export const IONO_SHELL_HEIGHT_M = 350e3
/** Slant delay per TECU at L1, m: 40.3 · 10^16 / f² (first-order ionospheric group delay). */
export const L1_M_PER_TECU = (40.3e16) / GPS_L1_HZ ** 2

export interface IonoConditions {
  /** Journey time, s. */
  tS: number
  /** Local solar hour at the journey start (changes the whole day's timeline). */
  startLocalHour: number
  /** Ionospheric storm strength 0..1 (0 = quiet). */
  storm: number
  /** Force the post-sunset bubbles and scintillation, whatever the hour (the "scintillation" failure). */
  scintillation: boolean
}

export const QUIET: Omit<IonoConditions, 'tS'> = { startLocalHour: START_LOCAL_HOUR, storm: 0, scintillation: false }

export interface PiercePoint {
  latDeg: number
  lonDeg: number
  /** Obliquity factor: slant delay = vertical delay × F. */
  obliquity: number
}

/** Ionospheric pierce point of a line of sight (receiver lat/lon, satellite az/el). Null below the horizon or for bad input. */
export function piercePoint(latDeg: number, lonDeg: number, azDeg: number, elDeg: number): PiercePoint | null {
  if (![latDeg, lonDeg, azDeg, elDeg].every(Number.isFinite) || elDeg <= 0) return null
  const re = WGS84_A_M
  const e = elDeg * DEG
  const a = azDeg * DEG
  const phi = latDeg * DEG
  const ratio = (re / (re + IONO_SHELL_HEIGHT_M)) * Math.cos(e)
  const psi = Math.PI / 2 - e - Math.asin(ratio)
  const latPp = Math.asin(clamp(Math.sin(phi) * Math.cos(psi) + Math.cos(phi) * Math.sin(psi) * Math.cos(a), -1, 1))
  const lonPp = lonDeg * DEG + Math.asin(clamp((Math.sin(psi) * Math.sin(a)) / Math.max(Math.cos(latPp), 1e-9), -1, 1))
  const obliquity = 1 / Math.sqrt(Math.max(1 - ratio * ratio, 1e-9))
  return { latDeg: latPp / DEG, lonDeg: lonPp / DEG, obliquity }
}

/** Between local sunset and just after midnight the equatorial bubbles can form (Doc 9849 §5.2.1.4). */
export function isPostSunset(localHour: number): boolean {
  return localHour >= 19 || localHour < 0.5
}

/** How strongly bubbles are present at this hour, 0..1 (they grow after sunset and fade after midnight). */
function bubbleSeason(localHour: number): number {
  if (localHour >= 19) return clamp((localHour - 19) / 1, 0, 1)
  if (localHour < 0.5) return clamp((0.5 - localHour) / 0.5, 0, 1)
  return 0
}

/**
 * Depletion 0..1 at a pierce point: narrow bands elongated north–south along the
 * magnetic meridian, drifting slowly east.
 */
export function bubbleDepletion(latDeg: number, lonDeg: number, tS: number, strength: number): number {
  if (!(strength > 0)) return 0
  const magLat = magLatDeg(latDeg, lonDeg)
  // Confined to the low-latitude bands.
  const latShape = Math.exp(-((Math.abs(magLat) - 8) ** 2) / (2 * 7 ** 2))
  // Bubbles repeat every ~3.5° of longitude, drift ~0.05° per minute, each ~0.6° wide.
  const drift = (tS / 60) * 0.05
  const x = (lonDeg - drift) / 3.5
  const cell = Math.floor(x)
  const f = x - cell
  const present = hash2(cell, 7, 11) > 0.35 ? 1 : 0
  const centre = 0.3 + 0.4 * hash2(cell, 3, 5)
  const width = 0.6 / 3.5
  const across = Math.exp(-((f - centre) ** 2) / (2 * (width / 2) ** 2))
  return clamp(strength * present * across * latShape, 0, 1)
}

/** Vertical total electron content at a pierce point, TECU. Illustrative model (see the file comment). */
export function verticalTec(latDeg: number, lonDeg: number, c: IonoConditions): number {
  if (![latDeg, lonDeg, c.tS].every(Number.isFinite)) return Number.NaN
  const h = localSolarHour(c.tS, lonDeg, c.startLocalHour)
  // Day side: rises after sunrise, peaks near 14:00, stays raised into the evening.
  const day = Math.max(0, Math.cos((Math.PI * (h - 14)) / 13))
  const magLat = magLatDeg(latDeg, lonDeg)
  // The equatorial anomaly: dense bands ~15° either side of the magnetic equator, a trough over it.
  const band = (m: number) => Math.exp(-((magLat - m) ** 2) / (2 * 4.5 ** 2))
  const evening = h >= 17 && h <= 23.5 ? 1.35 : 1
  const anomaly = 0.8 + (band(15) + band(-15)) * 0.9 * evening
  // Gentle large-scale texture so neighbouring pierce points differ.
  const texture = 0.9 + 0.2 * valueNoise(latDeg / 6, lonDeg / 6 + c.tS / 7200, 3)
  let tec = (6 + 42 * day) * anomaly * texture
  tec *= 1 + 1.6 * clamp(c.storm, 0, 1)
  const bubbles = Math.max(bubbleSeason(h), c.scintillation ? 1 : 0)
  tec *= 1 - 0.75 * bubbleDepletion(latDeg, lonDeg, c.tS, bubbles)
  return Math.max(0, tec)
}

/** Vertical ionospheric delay at L1, m. */
export const verticalDelayL1 = (latDeg: number, lonDeg: number, c: IonoConditions) => verticalTec(latDeg, lonDeg, c) * L1_M_PER_TECU

/** Delay on another frequency: the first-order delay scales with 1/f². */
export const delayAt = (delayL1M: number, freqHz: number) => delayL1M * (GPS_L1_HZ / freqHz) ** 2

/**
 * The GPS broadcast (single-frequency ABAS) ionospheric correction. Doc 9849 §5.2.1.6:
 * the simple broadcast model reduces the ionospheric error by a factor of about two.
 */
export function broadcastModelSlantL1(trueSlantL1M: number, latDeg: number, lonDeg: number, tS: number): number {
  const wobble = 0.85 + 0.3 * valueNoise(latDeg / 9, lonDeg / 9 + tS / 5400, 17)
  return 0.5 * trueSlantL1M * wobble
}

/**
 * τ_vert, the vertical σ of the broadcast-model ionospheric residual, by the geographic
 * latitude of the pierce point φ_pp (Annex 10 Vol I App B 3.5.5.6.3.2): 9 m for
 * |φ_pp| ≤ 20°, 4.5 m for 20° < |φ_pp| ≤ 55°, 6 m beyond. m.
 */
export function tauVertNoSbasM(ppLatDeg: number): number {
  const a = Math.abs(ppLatDeg)
  return a <= 20 ? 9 : a <= 55 ? 4.5 : 6
}

/**
 * σ of the ionospheric error when no SBAS ionospheric correction is applied (the GPS
 * broadcast model), along the line of sight, m: the larger of T_iono/5 and F_pp·τ_vert,
 * where T_iono is the broadcast model's slant delay estimate and F_pp the obliquity
 * (Annex 10 Vol I App B 3.5.5.6.3.2, for an SBAS receiver outside the ionospheric
 * grid). Pass T_iono = 0 where it is not known.
 */
// TODO(expert-review): σ of the single-frequency broadcast-model ionospheric residual follows Annex 10 App B 3.5.5.6.3.2 (an SBAS receiver without SBAS ionospheric corrections); applying it to GPS alone (ABAS RAIM) is the page's choice.
export function sigmaIonoNoSbasM(pp: PiercePoint, tIonoSlantM = 0): number {
  const t = Number.isFinite(tIonoSlantM) ? Math.abs(tIonoSlantM) : 0
  return Math.max(t / 5, pp.obliquity * tauVertNoSbasM(pp.latDeg))
}

/**
 * Scintillation loss of lock: in the evening (or when forced), a line of sight whose
 * pierce point crosses a bubble can lose the signal for a while. Affects L1 and L5
 * alike (Doc 9849 §5.2.1.3).
 */
export function scintillationLoss(satId: string, pp: PiercePoint | null, c: IonoConditions): boolean {
  if (!pp) return false
  const h = localSolarHour(c.tS, pp.lonDeg, c.startLocalHour)
  const strength = Math.max(bubbleSeason(h), c.scintillation ? 1 : 0)
  if (strength <= 0) return false
  const depletion = bubbleDepletion(pp.latDeg, pp.lonDeg, c.tS, strength)
  if (depletion < 0.25) return false
  // Losses are short and repeat: re-drawn every 20 s per satellite.
  let code = 0
  for (let i = 0; i < satId.length; i++) code = (code * 31 + satId.charCodeAt(i)) >>> 0
  return hash2(code, Math.floor(c.tS / 20), 23) < depletion * 0.9
}

// ---------------------------------------------------------------------------
// The SBAS ionospheric grid (L1 SBAS)
// ---------------------------------------------------------------------------

// TODO(expert-review): 5°×5° IGP spacing at low and mid latitudes (RTCA DO-229, IGP bands).
export const IGP_SPACING_DEG = 5

export interface Igp {
  latDeg: number
  lonDeg: number
}

/** The IGPs over the scenario's service area (Indonesia: 90–145°E, 20°S–15°N; Europe: 25°W–40°E, 25–55°N). */
export const IGP_BOX = SCENARIO.igpBox
export const IGPS: readonly Igp[] = (() => {
  const out: Igp[] = []
  for (let lat = IGP_BOX.lat0; lat <= IGP_BOX.lat1; lat += IGP_SPACING_DEG) for (let lon = IGP_BOX.lon0; lon <= IGP_BOX.lon1; lon += IGP_SPACING_DEG) out.push({ latDeg: lat, lonDeg: lon })
  return out
})()

export const igpKey = (latDeg: number, lonDeg: number) => `${latDeg},${lonDeg}`

// TODO(expert-review): GIVEI table (RTCA DO-229, Table A-17): GIVE values in metres; 15 = "not monitored".
export const GIVE_TABLE_M = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.6, 4.5, 6.0, 15.0, 45.0] as const
export const GIVEI_NOT_MONITORED = 15

/** The smallest GIVEI whose GIVE is at least the needed bound, or "not monitored". */
export function giveIndex(giveM: number): number {
  if (!Number.isFinite(giveM) || giveM < 0) return GIVEI_NOT_MONITORED
  const i = GIVE_TABLE_M.findIndex((g) => g >= giveM)
  return i < 0 ? GIVEI_NOT_MONITORED : i
}

/** σ of the grid vertical error for a GIVEI: GIVE bounds 99.9 % (3.29 σ). Infinity when not monitored. */
// TODO(expert-review): relation between GIVE and σ_GIVE (DO-229 lists σ²_GIVE per GIVEI).
export const sigmaGiveM = (givei: number) => (givei >= GIVEI_NOT_MONITORED ? Infinity : GIVE_TABLE_M[givei] / 3.29)

export interface IgpEstimate {
  latDeg: number
  lonDeg: number
  /** Broadcast vertical delay at L1, m. */
  delayM: number
  givei: number
}

/** A vertical delay measured by the ground network at a pierce point. */
export interface IonoObservation {
  latDeg: number
  lonDeg: number
  delayM: number
}

const PP_RADIUS_DEG = 9
let weightScratch = new Float64Array(256)

/**
 * The master station's grid: each IGP's delay is a distance-weighted mean of the
 * network's pierce-point measurements nearby; its GIVE grows with how much those
 * measurements disagree (a gradient the grid cannot follow), and after sunset in the
 * equatorial bands it is inflated for bubbles the network cannot see. An IGP with too
 * few measurements nearby is "not monitored".
 */
export function estimateIgps(obs: readonly IonoObservation[], c: IonoConditions, igps: readonly Igp[] = IGPS): IgpEstimate[] {
  // Runs for every snapshot (each frame of a moving view), so it allocates nothing per
  // measurement: the weights go into one shared scratch array.
  if (weightScratch.length < obs.length) weightScratch = new Float64Array(obs.length)
  const weights = weightScratch
  return igps.map((igp) => {
    let wSum = 0
    let dSum = 0
    let nNear = 0
    const cosLat = Math.cos(igp.latDeg * DEG)
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i]
      const dLat = o.latDeg - igp.latDeg
      const dLon = (o.lonDeg - igp.lonDeg) * cosLat
      const dist2 = dLat * dLat + dLon * dLon
      if (dist2 > PP_RADIUS_DEG * PP_RADIUS_DEG) {
        weights[i] = 0
        continue
      }
      const w = 1 / (1 + dist2)
      weights[i] = w
      wSum += w
      dSum += w * o.delayM
      nNear++
    }
    if (nNear < 3 || !(wSum > 0)) return { ...igp, delayM: 0, givei: GIVEI_NOT_MONITORED }
    const mean = dSum / wSum
    let varSum = 0
    for (let i = 0; i < obs.length; i++) if (weights[i] > 0) varSum += weights[i] * (obs[i].delayM - mean) ** 2
    const spread = Math.sqrt(varSum / wSum)
    const h = localSolarHour(c.tS, igp.lonDeg, c.startLocalHour)
    const magLat = Math.abs(magLatDeg(igp.latDeg, igp.lonDeg))
    // After sunset in the equatorial bands, bubbles smaller than the station spacing can hide
    // between the measurements: the threat term makes the grid too uncertain for vertical
    // guidance (Doc 9849 §5.2.1.5).
    // TODO(expert-review): threat-model sizes are illustrative.
    // In daytime the bands' steep gradients also call for margin, so single-frequency vertical
    // guidance near the equator has low availability (Doc 9849 §4.3.1.4, §5.2.1.5).
    const inBands = magLat < 22
    const threat = !inBands ? 0 : isPostSunset(h) || c.scintillation ? 20 : 7.5
    const stormThreat = 14 * clamp(c.storm, 0, 1)
    // GIVE is a 99.9 % bound: base term, gradient term, and the threat terms.
    const give = Math.hypot(0.9, 3.3 * spread, threat, stormThreat)
    return { ...igp, delayM: mean, givei: giveIndex(give) }
  })
}

/**
 * Receiver interpolation of the grid at a pierce point (bilinear over the four IGPs
 * around it). Null when any of them is not monitored or missing: the satellite then
 * cannot be used for approaches with vertical guidance.
 */
export function interpolateGrid(grid: ReadonlyMap<string, IgpEstimate>, pp: PiercePoint): { delayM: number; sigmaM: number } | null {
  const lat0 = Math.floor(pp.latDeg / IGP_SPACING_DEG) * IGP_SPACING_DEG
  const lon0 = Math.floor(pp.lonDeg / IGP_SPACING_DEG) * IGP_SPACING_DEG
  const corners = [
    grid.get(igpKey(lat0, lon0)),
    grid.get(igpKey(lat0, lon0 + IGP_SPACING_DEG)),
    grid.get(igpKey(lat0 + IGP_SPACING_DEG, lon0)),
    grid.get(igpKey(lat0 + IGP_SPACING_DEG, lon0 + IGP_SPACING_DEG)),
  ]
  if (corners.some((c) => !c || c.givei >= GIVEI_NOT_MONITORED)) return null
  const x = (pp.lonDeg - lon0) / IGP_SPACING_DEG
  const y = (pp.latDeg - lat0) / IGP_SPACING_DEG
  const w = [(1 - x) * (1 - y), x * (1 - y), (1 - x) * y, x * y]
  let delay = 0
  let variance = 0
  corners.forEach((c, i) => {
    delay += w[i] * c!.delayM
    variance += w[i] * sigmaGiveM(c!.givei) ** 2
  })
  return { delayM: delay, sigmaM: Math.sqrt(variance) }
}
