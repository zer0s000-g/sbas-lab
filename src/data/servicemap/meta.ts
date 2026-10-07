/**
 * The grid spacing and time step of the shipped service-area map (claim servicemap.method).
 * scripts/data/build-service-map.mjs writes them into the data file; the claims test
 * (tests/content/claims.test.ts) checks that every map in this folder agrees, so the claim
 * can bind its values here without loading the data.
 */
export const SERVICE_MAP_GRID_DEG = 2
export const SERVICE_MAP_STEP_S = 600
