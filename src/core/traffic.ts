/**
 * Arrival traffic around LAB201's destination, for the controller's view: a few
 * illustrative aircraft on fixed arrival streams that join the final approach and land,
 * over and over. Pure and deterministic: positions are a function of the journey's world
 * time only (one world, one clock), so the traffic freezes with the world in slow motion
 * and a jump to a phase shows the same picture as playing up to it. Distances in NM,
 * altitudes in ft, speeds in kt (CLAUDE.md units).
 *
 * The streams, callsigns and equipage are illustrative, labelled so on screen; what each
 * aircraft can fly comes from the same SBAS world as LAB201 (sbasWorld.snapshot).
 */
import { DEG, FT_PER_NM } from './units'

export type Equipage = 'sbas' | 'gps' | 'conventional'

export interface ArrivalStream {
  id: string
  /** Name shown on the scope (e.g. a fix or a sector). */
  name: string
  /** True bearing from the landing threshold to where the stream enters the scope, °. */
  fromBearingDeg: number
  /** Distance from the threshold where it enters, NM. */
  entryNm: number
}

export interface TrafficSpec {
  /** Landing threshold in the local frame, NM, its elevation, ft, and the final approach course, ° true. */
  threshold: { eastNm: number; northNm: number; elevationFt: number }
  finalCourseDeg: number
  /** Where streams join the final, NM before the threshold. */
  joinNm: number
  /** Glide path angle, °, and threshold crossing height, ft: the destination's FAS data block. */
  gpaDeg: number
  tchFt: number
  streams: readonly ArrivalStream[]
  aircraft: readonly { callsign: string; stream: string; equip: Equipage; offsetS: number }[]
  /** Each aircraft lands and comes back every cycle, s. */
  cycleS: number
}

export interface TrafficAircraft {
  callsign: string
  equip: Equipage
  stream: string
  eastNm: number
  northNm: number
  altFt: number
  gsKt: number
  trackDeg: number
  /** Distance to the threshold along its path, NM. */
  toGoNm: number
  onFinal: boolean
}

const SPEED_KT = { arrival: 220, final: 140 }
const ENTRY_ALT_FT = 9000
/**
 * Each arrival reaches the join this far below the glide path (rounded down to a whole
 * hundred feet), holds that altitude and captures the path from below, as LAB201 does
 * (core/flight). Illustrative.
 */
const JOIN_BELOW_PATH_FT = 100

/** Glide path altitude at a distance before the threshold, ft (the FAS data block's TCH and angle). */
export const trafficGlidePathFt = (spec: TrafficSpec, toGoNm: number) =>
  spec.threshold.elevationFt + spec.tchFt + Math.max(toGoNm, 0) * FT_PER_NM * Math.tan(spec.gpaDeg * DEG)

/** The altitude each arrival levels at before the join, ft: below the glide path there. */
export const joinAltFt = (spec: TrafficSpec) => Math.floor((trafficGlidePathFt(spec, spec.joinNm) - JOIN_BELOW_PATH_FT) / 100) * 100

interface Leg {
  from: [number, number]
  to: [number, number]
  lengthNm: number
  kt: number
  final: boolean
}

function legsFor(spec: TrafficSpec, st: ArrivalStream): Leg[] {
  const back = (spec.finalCourseDeg + 180) * DEG
  const t: [number, number] = [spec.threshold.eastNm, spec.threshold.northNm]
  const join: [number, number] = [t[0] + spec.joinNm * Math.sin(back), t[1] + spec.joinNm * Math.cos(back)]
  const b = st.fromBearingDeg * DEG
  const entry: [number, number] = [t[0] + st.entryNm * Math.sin(b), t[1] + st.entryNm * Math.cos(b)]
  const len = (a: [number, number], c: [number, number]) => Math.hypot(c[0] - a[0], c[1] - a[1])
  return [
    { from: entry, to: join, lengthNm: len(entry, join), kt: SPEED_KT.arrival, final: false },
    { from: join, to: t, lengthNm: spec.joinNm, kt: SPEED_KT.final, final: true },
  ]
}

/** The traffic at world time t (s). Aircraft between landing and their next entry are not on the scope. */
export function trafficAt(spec: TrafficSpec, tS: number): TrafficAircraft[] {
  if (!Number.isFinite(tS)) return []
  const out: TrafficAircraft[] = []
  for (const a of spec.aircraft) {
    const st = spec.streams.find((s) => s.id === a.stream)
    if (!st) continue
    const legs = legsFor(spec, st)
    const local = ((((tS + a.offsetS) % spec.cycleS) + spec.cycleS) % spec.cycleS) / 3600
    let tH = local
    let flownNm = 0
    const total = legs.reduce((s, l) => s + l.lengthNm, 0)
    const joinFt = joinAltFt(spec)
    for (const leg of legs) {
      const legH = leg.lengthNm / leg.kt
      if (tH <= legH) {
        const f = (tH * leg.kt) / leg.lengthNm
        const e = leg.from[0] + (leg.to[0] - leg.from[0]) * f
        const n = leg.from[1] + (leg.to[1] - leg.from[1]) * f
        const toGo = total - flownNm - tH * leg.kt
        // On final: level at the join altitude until the glide path comes down to it, then on the path.
        const altFt = leg.final ? Math.min(joinFt, trafficGlidePathFt(spec, toGo)) : joinFt + (ENTRY_ALT_FT - joinFt) * (1 - f)
        out.push({
          callsign: a.callsign,
          equip: a.equip,
          stream: st.id,
          eastNm: e,
          northNm: n,
          altFt: Math.round(altFt),
          gsKt: leg.kt,
          trackDeg: ((Math.atan2(leg.to[0] - leg.from[0], leg.to[1] - leg.from[1]) / DEG) % 360 + 360) % 360,
          toGoNm: toGo,
          onFinal: leg.final,
        })
        break
      }
      tH -= legH
      flownNm += leg.lengthNm
    }
  }
  return out
}

/** The controller's instructions the view offers. */
export type AtcInstruction = 'gnss-unreliable' | 'sbas-unavailable' | 'clear-conventional' | 'hold' | 'no-action'

/**
 * What the arrival picture calls for: the instructions a controller may rightly give,
 * from what the aircraft can fly now.
 * - No GNSS for anyone (interference): warn "GNSS reported unreliable" and clear
 *   aircraft to a conventional approach.
 * - SBAS aircraft below LPV while GNSS still works: "SBAS unavailable" for LPV. They may
 *   still fly the RNP approach to LNAV/VNAV or LNAV minima (Doc 9613 5.3.4.7.2), so a
 *   conventional approach is offered, not required; both are right calls.
 * - Only a GPS-only aircraft cannot fly its approach: clear it to a conventional approach.
 * - Otherwise nothing to do. Holding delays everyone and is never the first answer when
 *   an ILS is available.
 */
export function expectedInstructions(picture: readonly { equip: Equipage; mode: 'LPV' | 'LNAV/VNAV' | 'LNAV' | 'NONE' }[]): AtcInstruction[] {
  const gnss = picture.filter((p) => p.equip !== 'conventional')
  if (gnss.length && gnss.every((p) => p.mode === 'NONE')) return ['gnss-unreliable', 'clear-conventional']
  if (picture.some((p) => p.equip === 'sbas' && p.mode !== 'LPV')) return ['sbas-unavailable', 'clear-conventional']
  if (picture.some((p) => p.equip === 'gps' && p.mode === 'NONE')) return ['clear-conventional']
  return ['no-action']
}
