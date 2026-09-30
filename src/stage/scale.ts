import { M_PER_FT, M_PER_NM } from '@/core/units'

/**
 * Approach-table scale, kept free of three.js so the page can build its honesty
 * label without loading the 3D chunk (design.md §6: "Table 20 NM across · heights ×3 ·
 * protection cylinders to scale with the runway"). The orbit view has its own scale:
 * metre-scale and Earth-scale scenes never share one set of scene units.
 */
export const TABLE_ACROSS_NM = 20
/** Scene units per NM across the table. */
export const U_PER_NM = 1
/** Heights are drawn this many times taller than true scale. */
export const HEIGHT_EXAGGERATION = 3

/** Horizontal metres to scene units (true scale). */
export const hU = (m: number) => (m / M_PER_NM) * U_PER_NM
/** Vertical metres to scene units (×HEIGHT_EXAGGERATION). */
export const vU = (m: number) => hU(m) * HEIGHT_EXAGGERATION

/** Table point (NM east, NM north) and altitude (ft) to scene units; north is -z. */
export const toU = (eastNm: number, northNm: number, altFt = 0): [number, number, number] => [
  eastNm * U_PER_NM,
  vU(altFt * M_PER_FT),
  -northNm * U_PER_NM,
]

export const APPROACH_HONESTY = `Table ${TABLE_ACROSS_NM} NM across · heights ×${HEIGHT_EXAGGERATION} · protection cylinders to scale with the runway`
