/**
 * One set of units and constants for the whole app (CLAUDE.md "one set of units").
 * - GNSS: metres and seconds, positions in ECEF on WGS-84.
 * - The flight: NM, ft, kt and true degrees.
 * Everything converts at the edges with the functions below. Each constant is defined
 * here once and imported everywhere else.
 */

// ---------------------------------------------------------------------------
// Physical and geodetic constants
// ---------------------------------------------------------------------------

/** Speed of light in vacuum, m/s (exact by definition of the metre). */
export const C_M_S = 299_792_458

/** WGS-84 semi-major axis, m (NIMA TR8350.2). */
export const WGS84_A_M = 6_378_137.0
/** WGS-84 flattening (NIMA TR8350.2). */
export const WGS84_F = 1 / 298.257223563
/** WGS-84 semi-minor axis, m (derived from a and f). */
export const WGS84_B_M = WGS84_A_M * (1 - WGS84_F)
/** WGS-84 first eccentricity squared (derived from f). */
export const WGS84_E2 = WGS84_F * (2 - WGS84_F)
/** WGS-84 Earth rotation rate, rad/s (NIMA TR8350.2; IS-GPS-200 uses 7.2921151467e-5 for orbits). */
export const WGS84_OMEGA_E_RAD_S = 7.292115e-5
/** Earth gravitational constant used by GPS orbit computations, m³/s² (IS-GPS-200). */
export const GPS_MU_M3_S2 = 3.986005e14

/** GPS L1 carrier frequency, Hz (IS-GPS-200; SBAS GEOs broadcast on the same L1). */
export const GPS_L1_HZ = 1575.42e6
/** GPS L5 carrier frequency, Hz (IS-GPS-705; used by dual-frequency multi-constellation SBAS). */
export const GPS_L5_HZ = 1176.45e6

// ---------------------------------------------------------------------------
// Flight units
// ---------------------------------------------------------------------------

/** International nautical mile, m (exact). */
export const M_PER_NM = 1852
/** International foot, m (exact). */
export const M_PER_FT = 0.3048
export const FT_PER_NM = M_PER_NM / M_PER_FT
/** One knot, m/s. */
export const M_S_PER_KT = M_PER_NM / 3600

export const nmToM = (nm: number) => nm * M_PER_NM
export const mToNm = (m: number) => m / M_PER_NM
export const ftToM = (ft: number) => ft * M_PER_FT
export const mToFt = (m: number) => m / M_PER_FT
export const ktToMs = (kt: number) => kt * M_S_PER_KT
export const msToKt = (ms: number) => ms / M_S_PER_KT

// ---------------------------------------------------------------------------
// Angles and small helpers
// ---------------------------------------------------------------------------

export const DEG = Math.PI / 180
export const degToRad = (deg: number) => deg * DEG
export const radToDeg = (rad: number) => rad / DEG

/** Wrap an angle to [0, 360) degrees. */
export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360
/** Wrap an angle to (-180, 180] degrees. */
export function wrap180(deg: number): number {
  const w = wrap360(deg)
  return w > 180 ? w - 360 : w
}

/** Clamp v to [lo, hi]. NaN stays NaN, so a bad input is never hidden as a limit. */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Linear interpolation from a (t = 0) to b (t = 1). */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
