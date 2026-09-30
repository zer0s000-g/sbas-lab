/**
 * Scene scales for the two 3D views, kept free of three.js so the page can build its
 * honesty labels and camera shots before the 3D chunk loads. Each view has its own
 * units (design.md pitfalls: metre-scale and Earth-scale scenes never share units).
 *
 * - Space view: 1 unit = the Earth's equatorial radius. ECEF z (north pole) is scene up.
 * - Flight view: 1 unit = 100 m, true scale in every direction.
 */
import type { Vec3 } from '@/core/geo'
import { M_PER_FT, M_PER_NM, WGS84_A_M } from '@/core/units'

export type V3 = [number, number, number]

// ---------------------------------------------------------------------------
// Space view
// ---------------------------------------------------------------------------

export const SPACE_UNIT_M = WGS84_A_M
/** ECEF (m) to space-view units: x → x, z (north) → up, y → −z. */
export const ecefToSpace = ([x, y, z]: Vec3): V3 => [x / SPACE_UNIT_M, z / SPACE_UNIT_M, -y / SPACE_UNIT_M]
/** Satellite glyphs are drawn this size (scene units): hundreds of kilometres across, so not to scale. */
export const SAT_GLYPH_U = 0.045

export const spaceHonesty = (speed: number, frozen: boolean) =>
  `Earth and orbits to scale · satellites drawn far larger than life · ${frozen ? 'world frozen' : `time ×${speed}`}`

// ---------------------------------------------------------------------------
// Flight view
// ---------------------------------------------------------------------------

export const FLIGHT_UNIT_M = 100
const U_PER_NM = M_PER_NM / FLIGHT_UNIT_M
/** Local NM east/north and altitude in ft to flight-view units (north is −z). */
export const toFlight = (eastNm: number, northNm: number, altFt: number): V3 => [eastNm * U_PER_NM, (altFt * M_PER_FT) / FLIGHT_UNIT_M, -northNm * U_PER_NM]
/** Metres to flight-view units. */
export const mToFlight = (m: number) => m / FLIGHT_UNIT_M
/** Position errors are a few metres, far smaller than the aircraft: their markers are drawn this many times larger. */
export const ERROR_MARKER_SCALE = 10
/** Signal rays point the true way to each satellite but stop at this distance, units (the satellites are 20 000 km away). */
export const SKY_DOME_U = 60

export const FLIGHT_HONESTY = `Terrain, aircraft and protection cylinders to scale · signal directions true, distances not · position errors drawn ×${ERROR_MARKER_SCALE}`
export const NETWORK_HONESTY = 'Region map · stations made up for this fictional region · to scale'
