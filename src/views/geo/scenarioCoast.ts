/**
 * The active scenario's coastlines, loaded on demand (ScenarioDef's loaders). They are
 * the bulk of a scenario and only lazily loaded views draw them, so they never ride with
 * the first page load, and only the active scenario's are ever downloaded.
 *
 * No top-level await: an awaited import in a module splits the build's shared code into
 * many small chunks. The views wait for the data instead: the map and the globe with
 * React's `use`, the terrain through its lazy loaders (`loadTerrainCoast`).
 */
import { SCENARIO } from '@/scenarios/active'
import type { CoastData } from './coast'

/** A loader that downloads once, and again after a failure. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null
  return () =>
    (p ??= load().catch((error: unknown) => {
      p = null
      throw error
    }))
}

/** The network map's land outlines. */
export const mapLand = once(() => SCENARIO.map.land())
/** The globe's detailed land over the coarse world. */
export const globeDetail = once(() => SCENARIO.globeDetail())

let terrainCoast: CoastData | null = null
/** The coastline views/terrain is built on: resolves once `terrainCoastData` can be called. */
export const loadTerrainCoast = once(() => SCENARIO.terrain.coast().then((d) => void (terrainCoast = d)))

/** The terrain's coastline. Only after `loadTerrainCoast` has resolved (the 3D views' loaders wait for it). */
export function terrainCoastData(): CoastData {
  if (!terrainCoast) throw new Error('views/terrain was used before loadTerrainCoast() resolved')
  return terrainCoast
}
