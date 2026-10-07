/**
 * Camera shots for each view and camera intent. Moving shots read the engine every
 * frame (the chase camera behind LAB201, a shot framing a moving satellite), so the
 * camera and the scene always show the same moment. No three.js here.
 */
import { geodeticToEcef, localToGeodetic } from '@/core/geo'
import { OPERATIONS } from '@/core/operations'
import { satEcef, GEO_SATS, ALL_SATS } from '@/core/orbits'
import { REGION, STATIONS } from '@/core/region'
import { DEG, M_PER_FT, M_PER_NM } from '@/core/units'
import type { JourneyEngine } from '@/journey/engine'
import { directionFor, stageAt, type CameraIntent, type ViewId } from '@/journey/director'
import { operationFor } from '@/core/operations'
import type { Shot } from '@/stage/types'
import { ecefToSpace, FLIGHT_UNIT_M, mToFlight, toFlight, type V3 } from './scales'
import { airportToLocalNm, localNmToAirport, nearestLayout } from './airports'
import { terrainFtAt } from './terrain'

const U_PER_NM = M_PER_NM / FLIGHT_UNIT_M

export type CameraButton = 'follow' | 'overview' | 'zoom'

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => scl(a, 1 / Math.max(len(a), 1e-9))
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** LAB201 in space-view units. */
export function aircraftSpace(e: JourneyEngine): V3 {
  const a = e.aircraft
  return ecefToSpace(geodeticToEcef(localToGeodetic(REGION, a.eastNm, a.northNm, a.altFt * M_PER_FT)))
}

/** LAB201 in flight-view units. */
export const aircraftFlight = (e: JourneyEngine): V3 => toFlight(e.aircraft.eastNm, e.aircraft.northNm, e.aircraft.altFt)

/** The satellite the errors phase looks at: the first one LAB201 uses. */
export function focusSatId(e: JourneyEngine): string {
  const s = e.snapshot()
  return s.abas?.used[0] ?? 'G01'
}

/** The alert-limit radius the flight camera must fit, m (the operation of the current phase). */
export function alRadiusM(e: JourneyEngine): number {
  const op = operationFor(stageAt(e.state.phase, e.aircraft.wp))
  return op?.halM ?? OPERATIONS.apv1.halM
}

function spaceShot(e: JourneyEngine, intent: CameraIntent): Shot {
  const base = { snapKey: 'space', near: 0.01, far: 120, fov: 32 }
  const track = (): { position: V3; target: V3 } => {
    const ac = aircraftSpace(e)
    const up = unit(ac)
    // A sideways axis along the local east, for an oblique view.
    const east = unit(cross([0, 1, 0], up))
    const t = e.worldS
    // Frame a line from LAB201 to a satellite side-on, far enough back to fit it and the Earth.
    const sideOn = (far: V3, fit: number) => {
      const line: V3 = [far[0] - ac[0], far[1] - ac[1], far[2] - ac[2]]
      // Centred a little toward LAB201, so the Earth side stays in the middle of the view.
      const mid = add(ac, scl(line, 0.28))
      let n = cross(line, up)
      if (len(n) < 1e-6) n = east
      const d = (len(line) * fit) / (2 * Math.tan(16 * DEG))
      return { position: add(add(mid, scl(unit(n), d)), scl(up, d * 0.18)), target: mid }
    }
    if (intent === 'satellite') {
      const sat = ALL_SATS.find((s) => s.id === focusSatId(e)) ?? ALL_SATS[0]
      return sideOn(ecefToSpace(satEcef(sat, t)), 1.25)
    }
    // QZS-3, at 127°E, stands almost overhead the middle of Indonesia.
    if (intent === 'uplink' || intent === 'broadcast') return sideOn(ecefToSpace(satEcef(GEO_SATS[0], t)), 1.2)
    // The constellation: far out, the region in front, the whole GPS shell in frame.
    return { position: add(scl(up, 9.5), add(scl(east, 7), [0, 3.5, 0])), target: scl(up, 0.6) }
  }
  return { ...base, ...track(), track }
}

/** Keep a camera point at least `clearM` above the ground or the sea (scene units in and out). */
function aboveGround(p: V3, clearM: number): V3 {
  const groundFt = Math.max(0, terrainFtAt(p[0] / U_PER_NM, -p[2] / U_PER_NM))
  return [p[0], Math.max(p[1], mToFlight(groundFt * M_PER_FT + clearM)), p[2]]
}

const smooth = (k: number) => {
  const x = Math.min(1, Math.max(0, k))
  return x * x * (3 - 2 * x)
}

function flightShot(e: JourneyEngine, intent: CameraIntent | CameraButton): Shot {
  // Near plane at a quarter of the camera's distance to its target (at least 5 m): every
  // shot keeps the aircraft and its cylinders well beyond it, and the depth buffer
  // keeps land, sea and runway apart out to the far plane.
  const base = { snapKey: 'flight', near: 0.05, nearFrac: 0.25, far: 3500, fov: 34 }
  const m = mToFlight
  const track = (): { position: V3; target: V3 } => {
    const a = e.aircraft
    const ac = aircraftFlight(e)
    const h = a.headingDeg * DEG
    const fwd: V3 = [Math.sin(h), 0, -Math.cos(h)]
    const side: V3 = [Math.cos(h), 0, Math.sin(h)]
    const l = nearestLayout(a.eastNm, a.northNm)
    const [ra, rr] = localNmToAirport(l.airport, a.eastNm, a.northNm)
    const nearField = Math.abs(rr) < 2500 && ra > l.startM - 3000 && ra < l.endM + 3000
    const aglFt = a.altFt - l.airport.elevationFt
    if (intent === 'overview' && (a.onGround || (nearField && aglFt < 800))) {
      // The airport: from the runway side, along the apron, with LAB201 in front of the
      // terminal, the parked airliners and the tower, and the runway on the other side.
      // Tracks the aircraft as it taxis or rolls out.
      const terminal = Math.sign(l.stands[0]?.r ?? 1)
      const at = (da: number, dr: number, hM: number): V3 => {
        const [en, nn] = airportToLocalNm(l.airport, ra + da, rr + dr)
        return toFlight(en, nn, l.airport.elevationFt + hM / M_PER_FT)
      }
      return { position: aboveGround(at(-400, -terminal * 170, 135), 40), target: at(90, terminal * 45, 0) }
    }
    if (intent === 'overview') {
      // In the air: far enough out to see the whole alert-limit ring.
      const d = Math.min(Math.max(2.6 * m(alRadiusM(e)), 1.5), 95)
      return { position: aboveGround(add(ac, add(add(scl(fwd, -d), scl(side, d * 0.35)), [0, d * 0.42, 0])), 30), target: add(ac, scl(fwd, d * 0.25)) }
    }
    if (intent === 'zoom') {
      // Close on the protection cylinder: slightly behind, to the right, a little above,
      // looking a little ahead so the runway stays in view on final.
      const r = Math.max(m(alRadiusM(e)), 0.4)
      return { position: aboveGround(add(ac, add(add(scl(fwd, -3.4 * r), scl(side, 2 * r)), [0, 1.1 * r, 0])), 8), target: add(ac, scl(fwd, r * 0.8)) }
    }
    // Follow: a low chase camera on the ground, rising to a high chase in the air that
    // shows the sea, the clouds and the coast ahead.
    const k = smooth(aglFt / 1500)
    const back = m(95 + k * 230)
    const right = m(26 + k * 95)
    const up = m(24 + k * 95)
    const ahead = m(70 + k * 150)
    const down = m(-4 + k * 40)
    return {
      position: aboveGround(add(ac, add(add(scl(fwd, -back), scl(side, right)), [0, up, 0])), 12),
      target: add(add(ac, scl(fwd, ahead)), [0, -down, 0]),
    }
  }
  return { ...base, ...track(), track }
}

/** The shot for a view and a camera choice. "auto" uses the director's intent for the phase. */
export function shotFor(e: JourneyEngine, view: ViewId, camera: CameraButton | 'auto'): Shot {
  const intent = camera === 'auto' ? directionFor(e.state.phase).camera : camera
  if (view === 'space') return spaceShot(e, camera === 'auto' ? intent : camera === 'zoom' ? 'satellite' : camera === 'overview' ? 'constellation' : 'broadcast')
  return flightShot(e, intent === 'constellation' || intent === 'satellite' || intent === 'uplink' || intent === 'broadcast' || intent === 'ground' ? 'follow' : intent)
}

/** Ground stations in space-view units, for the orbit view. */
export const stationsSpace = () => STATIONS.map((s) => ({ ...s, space: ecefToSpace(geodeticToEcef(s.pos)) }))
