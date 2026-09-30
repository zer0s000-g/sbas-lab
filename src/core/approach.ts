/**
 * The RNP approach to LPV minima at the destination: its final approach segment (FAS)
 * data block, protected by a CRC so the avionics can detect any change to the data
 * (Doc 9849 §4.3.2.7), the approach channel number the crew can enter (§4.3.2.9), and
 * the lateral and vertical deviations the CDI shows.
 */
import { M_PER_FT, M_PER_NM, DEG } from './units'
import { DESTINATION, MADE_UP } from './region'
import { OPERATIONS, type OperationId } from './operations'
import { isFiniteNumber } from './guard'

export interface FasDataBlock {
  operationType: number
  sbasProvider: string
  airportId: string
  runway: string
  /** 0 = APV-I, 1 = LPV-200 style (Category I). */
  performanceDesignator: number
  referencePathId: string
  /** Landing threshold point, local NM, and height above the ellipsoid, m. */
  ltpEastNm: number
  ltpNorthNm: number
  ltpHeightM: number
  courseDeg: number
  tchFt: number
  gpaDeg: number
  courseWidthM: number
  halM: number
  valM: number
}

// TODO(expert-review): FAS data block field set and the course width at threshold (105 m typical) follow RTCA DO-229 / Annex 10 Appendix B.
export function makeFasDataBlock(op: OperationId = 'apv1'): FasDataBlock {
  const o = OPERATIONS[op]
  return {
    operationType: 0,
    sbasProvider: 'FICTIONAL-SBAS',
    airportId: DESTINATION.id,
    runway: DESTINATION.runway,
    performanceDesignator: op === 'cat1' ? 1 : 0,
    referencePathId: 'R09A',
    ltpEastNm: DESTINATION.thresholdEastNm,
    ltpNorthNm: DESTINATION.thresholdNorthNm,
    ltpHeightM: DESTINATION.elevationFt * M_PER_FT,
    courseDeg: DESTINATION.runwayCourseDeg,
    tchFt: 50,
    gpaDeg: 3,
    courseWidthM: 105,
    halM: o.halM,
    valM: o.valM ?? 0,
  }
}

/** The SBAS approach channel of the made-up procedure (SBAS channels are five digits). */
// TODO(expert-review): SBAS channel number range (40 000–99 999).
export const APPROACH_CHANNEL = 54201
export const APPROACH_NOTE = `RNP RWY ${DESTINATION.runway} at ${DESTINATION.name}, ${MADE_UP}`

// TODO(expert-review): the FAS data block CRC is a 32-bit CRC (CRC-32Q, polynomial 0x814141AB, per RTCA DO-229).
const CRC_POLY = 0x814141ab

/** CRC-32Q over bytes (MSB first, no reflection, zero initial value). */
export function crc32q(bytes: Uint8Array): number {
  let crc = 0
  for (const b of bytes) {
    crc ^= b << 24
    for (let i = 0; i < 8; i++) crc = crc & 0x80000000 ? ((crc << 1) ^ CRC_POLY) >>> 0 : (crc << 1) >>> 0
  }
  return crc >>> 0
}

/** A stable byte encoding of the block's fields (the real block is bit-packed; this keeps the same idea). */
export function encodeFas(b: FasDataBlock): Uint8Array {
  const text = [b.operationType, b.sbasProvider, b.airportId, b.runway, b.performanceDesignator, b.referencePathId, b.ltpEastNm.toFixed(6), b.ltpNorthNm.toFixed(6), b.ltpHeightM.toFixed(2), b.courseDeg.toFixed(3), b.tchFt.toFixed(1), b.gpaDeg.toFixed(2), b.courseWidthM.toFixed(1), b.halM.toFixed(1), b.valM.toFixed(1)].join('|')
  return new TextEncoder().encode(text)
}

export const fasCrc = (b: FasDataBlock) => crc32q(encodeFas(b))

/** The avionics accept the block only when its CRC matches. */
export const fasValid = (b: FasDataBlock, crc: number) => fasCrc(b) === crc

export interface Deviations {
  /** Distance to the threshold along the course, m (negative once past it). */
  alongTrackM: number
  /** Right of course positive, m. */
  crossTrackM: number
  /** Height above the glide path, m (positive = high). */
  aboveGlidePathM: number
  /** Deviations as a share of full scale, −1..1 (clamped), for the CDI. */
  lateralFs: number
  verticalFs: number
  /** Height above the threshold, ft. */
  heightAboveThresholdFt: number
}

/**
 * Deviations of a position from the final approach path. Lateral full scale is the
 * course width at the threshold, splaying with distance; vertical full scale is a
 * quarter of the glide path angle.
 */
// TODO(expert-review): lateral splay (±2° cap) and vertical full-scale (±0.25 GPA) definitions for LPV deviations.
export function deviations(b: FasDataBlock, eastNm: number, northNm: number, altFt: number): Deviations | null {
  if (![eastNm, northNm, altFt].every(isFiniteNumber)) return null
  const c = b.courseDeg * DEG
  const dx = (eastNm - b.ltpEastNm) * M_PER_NM
  const dy = (northNm - b.ltpNorthNm) * M_PER_NM
  // Along-track: distance before the threshold (course direction is the direction of flight).
  const alongTrackM = -(dx * Math.sin(c) + dy * Math.cos(c))
  const crossTrackM = dx * Math.cos(c) - dy * Math.sin(c)
  const heightM = altFt * M_PER_FT - b.ltpHeightM
  const gpa = b.gpaDeg * DEG
  const pathHeightM = b.tchFt * M_PER_FT + Math.max(alongTrackM, 0) * Math.tan(gpa)
  const aboveGlidePathM = heightM - pathHeightM
  const lateralHalfWidth = Math.min(b.courseWidthM + Math.max(alongTrackM, 0) * Math.tan(2 * DEG) * 0.5, 1852)
  const distance = Math.max(alongTrackM, 30)
  const verticalHalfAngle = 0.25 * gpa
  const clampFs = (v: number) => Math.max(-1, Math.min(1, v))
  return {
    alongTrackM,
    crossTrackM,
    aboveGlidePathM,
    lateralFs: clampFs(crossTrackM / lateralHalfWidth),
    verticalFs: clampFs(Math.atan2(aboveGlidePathM, distance) / verticalHalfAngle),
    heightAboveThresholdFt: heightM / M_PER_FT,
  }
}

/** Decision altitude of the made-up LPV procedure, ft above mean sea level (a 250 ft decision height here). */
// TODO(expert-review): the LPV decision height is procedure-specific; 250 ft is illustrative (SBAS CAT I can reach 200 ft, Doc 9849 §4.3.3.3).
export const DECISION_HEIGHT_FT = 250
export const DECISION_ALTITUDE_FT = DESTINATION.elevationFt + DECISION_HEIGHT_FT
