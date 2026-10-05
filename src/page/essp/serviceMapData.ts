/**
 * The service-area map of a real day, as the panel reads it: the packed file
 * scripts/data/build-service-map.mjs writes (src/data/servicemap), decoded once. Pure
 * except for the lazy loader at the end.
 */
import { unpackLevel, type MapSpec } from '@/core/serviceMap'
import { OPERATIONS, type OperationId } from '@/core/operations'

export interface MapStation {
  id: string
  name: string
  latDeg: number
  lonDeg: number
  /** Seconds of the day. */
  tS: number[]
  /** Real GPS-alone error, cm (vertical signed); null where no fix. */
  hErrCm: (number | null)[]
  vErrCm: (number | null)[]
  /** Packed SBAS protection levels at the station (serviceMap.packLevel). */
  hplPa: number[]
  vplPa: number[]
}

export interface RawServiceMap {
  day: string
  source: 'modelled' | 'egnos'
  spec: MapSpec
  stepS: number
  epochs: number
  layers: { hplPa: string; vplPa: string; npaOk: string }
  stations: MapStation[]
  rims: { id: string; latDeg: number; lonDeg: number }[]
}

export interface ServiceMap extends Omit<RawServiceMap, 'layers'> {
  points: { latDeg: number; lonDeg: number }[]
  nLat: number
  nLon: number
  hplPa: Uint8Array
  vplPa: Uint8Array
  npaOk: Uint8Array
  /** The grid point nearest a position (row-major from the south-west). */
  indexOf: (latDeg: number, lonDeg: number) => number
}

export const SERVICE_MAP_OPS: readonly { id: Extract<OperationId, 'cat1' | 'apv1' | 'npa'>; label: string }[] = [
  { id: 'cat1', label: 'LPV-200' },
  { id: 'apv1', label: 'APV-I' },
  { id: 'npa', label: 'NPA' },
]
export type MapOp = (typeof SERVICE_MAP_OPS)[number]['id']

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function decodeServiceMap(raw: RawServiceMap): ServiceMap {
  const { spec } = raw
  const nLat = Math.round((spec.lat1 - spec.lat0) / spec.stepDeg) + 1
  const nLon = Math.round((spec.lon1 - spec.lon0) / spec.stepDeg) + 1
  const points: ServiceMap['points'] = []
  for (let a = 0; a < nLat; a++) for (let o = 0; o < nLon; o++) points.push({ latDeg: spec.lat0 + a * spec.stepDeg, lonDeg: spec.lon0 + o * spec.stepDeg })
  const { layers, ...rest } = raw
  return {
    ...rest,
    points,
    nLat,
    nLon,
    hplPa: fromBase64(layers.hplPa),
    vplPa: fromBase64(layers.vplPa),
    npaOk: fromBase64(layers.npaOk),
    indexOf: (latDeg, lonDeg) => {
      const a = Math.min(nLat - 1, Math.max(0, Math.round((latDeg - spec.lat0) / spec.stepDeg)))
      const o = Math.min(nLon - 1, Math.max(0, Math.round((lonDeg - spec.lon0) / spec.stepDeg)))
      return a * nLon + o
    },
  }
}

/** Whether an operation is available at grid point k and epoch e (protection levels within the alert limits). */
export function availableAt(map: ServiceMap, k: number, e: number, op: MapOp): boolean {
  const i = e * map.points.length + k
  if (op === 'npa') return (map.npaOk[i >> 3] & (1 << (i & 7))) !== 0
  const h = unpackLevel(map.hplPa[i])
  const v = unpackLevel(map.vplPa[i])
  const o = OPERATIONS[op]
  return h !== null && v !== null && o.valM !== null && h <= o.halM && v <= o.valM
}

/** The share of the day an operation is available at grid point k. */
export function availabilityAt(map: ServiceMap, k: number, op: MapOp): number {
  let ok = 0
  for (let e = 0; e < map.epochs; e++) if (availableAt(map, k, e, op)) ok++
  return ok / map.epochs
}

/** The vertical protection level at grid point k and epoch e, m; null where there is no solution. */
export const vplAt = (map: ServiceMap, k: number, e: number) => unpackLevel(map.vplPa[e * map.points.length + k])

/** Seconds of day → "hh:mm UTC". */
export const utcLabel = (sod: number) => `${String(Math.floor(sod / 3600)).padStart(2, '0')}:${String(Math.floor((sod % 3600) / 60)).padStart(2, '0')} UTC`

let pending: Promise<ServiceMap> | null = null
/** The map of the day, loaded once on demand (a lazy chunk outside the first-load budget). */
export function loadServiceMap(): Promise<ServiceMap> {
  pending ??= import('@/data/servicemap/2026-09-30.json').then((m) => decodeServiceMap(m.default as unknown as RawServiceMap))
  pending.catch(() => {
    pending = null
  })
  return pending
}
