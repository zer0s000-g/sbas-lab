/**
 * The terrain along the ESSP-SAS route, from Toulouse to Nice: a few summits as cones
 * (approximate positions and heights, metres above sea level) over procedural hills
 * (views/terrain). Simplified: not survey data.
 */
import type { Peak } from '../types'

const P = (name: string, latDeg: number, lonDeg: number, heightM: number): Peak => ({ name, latDeg, lonDeg, heightM })

// TODO(expert-review): summit positions and heights are approximate (terrain is illustrative scenery, not survey data).
export const PEAKS: readonly Peak[] = [
  P('Pic de Nore', 43.42, 2.46, 1211),
  P('Mont Aigoual', 44.12, 3.58, 1567),
  P('Pic Saint-Loup', 43.78, 3.81, 658),
  P('Mont Ventoux', 44.17, 5.28, 1909),
  P('Sainte-Victoire', 43.53, 5.6, 1011),
  P('Sainte-Baume', 43.33, 5.76, 1148),
  P('Massif des Maures', 43.28, 6.39, 780),
  P('Esterel', 43.5, 6.86, 618),
  P('Cheiron', 43.82, 6.95, 1778),
  P('Mont Agel', 43.77, 7.41, 1148),
]
