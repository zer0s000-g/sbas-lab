/**
 * The terrain of Java, Madura and Bali in the AirNav Indonesia scenario: the main
 * volcanoes as cones at their summits (approximate positions and heights, metres above
 * sea level); heights between the summits are procedural (views/terrain).
 */
import type { Peak } from '../types'

const P = (name: string, latDeg: number, lonDeg: number, heightM: number): Peak => ({ name, latDeg, lonDeg, heightM })

// Summits, approximate positions and heights (metres above sea level).
export const PEAKS: readonly Peak[] = [
  P('Salak', -6.72, 106.73, 2211),
  P('Gede-Pangrango', -6.78, 106.97, 3019),
  P('Tangkuban Perahu', -6.77, 107.6, 2084),
  P('Papandayan', -7.32, 107.73, 2665),
  P('Cikuray', -7.32, 107.86, 2821),
  P('Ciremai', -6.89, 108.4, 3078),
  P('Slamet', -7.24, 109.21, 3428),
  P('Sindoro', -7.3, 109.99, 3136),
  P('Sumbing', -7.38, 110.07, 3371),
  P('Merbabu', -7.45, 110.43, 3145),
  P('Merapi', -7.54, 110.45, 2930),
  P('Muria', -6.62, 110.88, 1602),
  P('Lawu', -7.63, 111.19, 3265),
  P('Wilis', -7.81, 111.76, 2563),
  P('Kelud', -7.93, 112.31, 1731),
  P('Arjuno', -7.76, 112.59, 3339),
  P('Bromo-Tengger', -7.94, 112.95, 2329),
  P('Semeru', -8.11, 112.92, 3676),
  P('Argopuro', -7.97, 113.57, 3088),
  P('Raung', -8.12, 114.04, 3332),
  P('Ijen', -8.06, 114.24, 2769),
  P('Batukaru', -8.33, 115.09, 2276),
  P('Batur', -8.24, 115.38, 1717),
  P('Agung', -8.34, 115.51, 3031),
  P('Rinjani', -8.41, 116.46, 3726),
]
