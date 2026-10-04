/**
 * The flight view's ground data, built once per session from views/terrain and kept for
 * every later visit to the view: the height grids with their normals and the colour
 * weights of every vertex, the tree positions around the airports, and the sea's height
 * maps. Only plain arrays live here; the meshes and textures are made from them on each
 * visit (cheap) and disposed when the view closes.
 *
 * Two levels of detail: a coarse corridor along the route (cells of 1.2 NM, enough from
 * cruise level), and a fine patch around each airport (about 90 m cells) for the ground
 * and low-level phases. The corridor leaves a hole under each patch; a skirt hanging from
 * the patch edge hides the seam.
 */
import * as THREE from 'three'
import { hash2, valueNoise } from '@/core/random'
import { SCENARIO } from '@/scenarios/active'
import { AIRPORT_LIST, runwayToLocalNm } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { anyAirfieldFlat, seaHeightMap, terrainGridFt, type NmRect } from '../terrain'
import { FLIGHT_UNIT_M, toFlight } from '../scales'

export type { NmRect }

/** Corridor cell size, NM. */
const CELL_NM = 1.2
/** The corridor along the route, local NM (multiples of the cell). */
export const CORRIDOR: NmRect = SCENARIO.terrain.corridor
const PATCH_CELLS = 10
/** Grid cells across each airport patch. */
const PATCH_GRID = 240
const snap = (v: number) => Math.floor(v / CELL_NM) * CELL_NM

/** The fine patch around each airport: 12 NM square, centred on the runway, snapped to the corridor grid. */
export const TERRAIN_PATCHES: readonly (NmRect & { id: string })[] = AIRPORT_LIST.map((ap) => {
  const [ce, cn] = runwayToLocalNm(ap, ap.runwayLengthM / 2, ap.terminalSide * ((ap.parallelOffsetM ? Math.abs(ap.parallelOffsetM) : 0) / 2 + 400))
  const e0 = snap(ce - (PATCH_CELLS * CELL_NM) / 2)
  const n0 = snap(cn - (PATCH_CELLS * CELL_NM) / 2)
  return { id: ap.id, e0, e1: e0 + PATCH_CELLS * CELL_NM, n0, n1: n0 + PATCH_CELLS * CELL_NM }
})

/** How forested the ground is, 0..1 (the coastal plain is farmland, hills and slopes wooded, with patches). */
export function forestK(e: number, n: number, hFt: number) {
  const patch = valueNoise(e * 2.3, n * 2.3, 41)
  return Math.min(1, Math.max(0, (hFt - 250) / 900 + (patch - 0.5) * 1.3))
}

const U = 1852 / FLIGHT_UNIT_M
const SKIRT_FT = 400
/** The grids never go deeper than this (the sea hides everything below). */
const FLOOR_FT = -150

/** Colour weights per vertex, in this order (see `paintTerrain`). */
export const W_FOREST = 0
export const W_ROCK = 1
export const W_SAND = 2
export const W_MOWN = 3
export const W_SHADE = 4
export const WEIGHTS = 5

export interface GridData {
  position: Float32Array
  normal: Float32Array
  index: Uint32Array
  /** WEIGHTS numbers per vertex: how much forest, rock, sand and mown grass, and a shade. */
  weights: Float32Array
  sphere: THREE.Sphere
  /** Ground height of the grid vertices (no skirt), ft: (nx+1)×(ny+1), vertex (i, j) at i·(ny+1)+j. */
  heightFt: Float32Array
  rect: NmRect
  nx: number
  ny: number
}

/**
 * A height-field grid over a rectangle: (nx+1)×(ny+1) vertices, cells for which `skip`
 * is true are left out, and an optional skirt hangs from the border.
 */
function gridData(r: NmRect, nx: number, ny: number, skip: ((i: number, j: number) => boolean) | null, skirt: boolean): GridData {
  const at = (i: number, j: number) => i * (ny + 1) + j
  const ring: [number, number][] = []
  if (skirt) {
    // The border, walked once around (its copy lowered by SKIRT_FT is the skirt).
    for (let i = 0; i < nx; i++) ring.push([i, 0])
    for (let j = 0; j < ny; j++) ring.push([nx, j])
    for (let i = nx; i > 0; i--) ring.push([i, ny])
    for (let j = ny; j > 0; j--) ring.push([0, j])
  }
  const nGrid = (nx + 1) * (ny + 1)
  const position = new Float32Array((nGrid + ring.length) * 3)
  const heights = terrainGridFt(r, nx, ny, FLOOR_FT)
  const heightFt = new Float32Array(heights)
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= ny; j++) {
      const k = at(i, j)
      // views/scales toFlight, written out.
      position[k * 3] = (r.e0 + ((r.e1 - r.e0) * i) / nx) * U
      position[k * 3 + 1] = (heights[k] * M_PER_FT) / FLIGHT_UNIT_M
      position[k * 3 + 2] = -(r.n0 + ((r.n1 - r.n0) * j) / ny) * U
    }
  let cells = 0
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (!skip?.(i, j)) cells++
  const index = new Uint32Array(cells * 6 + ring.length * 12)
  let o = 0
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      if (skip?.(i, j)) continue
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      // Wound so the face looks up (north is −z): (a, b, c) and (a, c, d).
      index[o++] = a
      index[o++] = b
      index[o++] = c
      index[o++] = a
      index[o++] = c
      index[o++] = d
    }
  ring.forEach(([i, j], q) => {
    const k = at(i, j) * 3
    const s = (nGrid + q) * 3
    position[s] = position[k]
    position[s + 1] = position[k + 1] - (SKIRT_FT * M_PER_FT) / FLIGHT_UNIT_M
    position[s + 2] = position[k + 2]
  })
  for (let k = 0; k < ring.length; k++) {
    const k2 = (k + 1) % ring.length
    const top1 = at(...ring[k])
    const top2 = at(...ring[k2])
    const b1 = nGrid + k
    const b2 = nGrid + k2
    // Both sides, so the skirt hides the seam from either side.
    index.set([top1, b1, top2, top2, b1, b2, top1, top2, b1, top2, b2, b1], o)
    o += 12
  }
  const normal = vertexNormals(position, index)
  const sphere = new THREE.Sphere()
  boundingSphere(position, sphere)
  return { position, normal, index, weights: colourWeights(position, normal), sphere, heightFt, rect: r, nx, ny }
}

/** Vertex normals as three's computeVertexNormals makes them (face normals summed, then normalised), in one tight loop. */
function vertexNormals(position: Float32Array, index: Uint32Array): Float32Array {
  const nor = new Float32Array(position.length)
  const p = position
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3
    const b = index[t + 1] * 3
    const c = index[t + 2] * 3
    const cbx = p[c] - p[b]
    const cby = p[c + 1] - p[b + 1]
    const cbz = p[c + 2] - p[b + 2]
    const abx = p[a] - p[b]
    const aby = p[a + 1] - p[b + 1]
    const abz = p[a + 2] - p[b + 2]
    const nx = cby * abz - cbz * aby
    const ny = cbz * abx - cbx * abz
    const nz = cbx * aby - cby * abx
    nor[a] += nx
    nor[a + 1] += ny
    nor[a + 2] += nz
    nor[b] += nx
    nor[b + 1] += ny
    nor[b + 2] += nz
    nor[c] += nx
    nor[c + 1] += ny
    nor[c + 2] += nz
  }
  for (let v = 0; v < nor.length; v += 3) {
    const l = Math.sqrt(nor[v] * nor[v] + nor[v + 1] * nor[v + 1] + nor[v + 2] * nor[v + 2]) || 1
    nor[v] /= l
    nor[v + 1] /= l
    nor[v + 2] /= l
  }
  return nor
}

/** The bounding sphere three would compute: the box centre and the farthest vertex from it. */
function boundingSphere(position: Float32Array, out: THREE.Sphere) {
  const box = new THREE.Box3().setFromArray(position)
  box.getCenter(out.center)
  let r2 = 0
  for (let v = 0; v < position.length; v += 3) {
    const dx = position[v] - out.center.x
    const dy = position[v + 1] - out.center.y
    const dz = position[v + 2] - out.center.z
    r2 = Math.max(r2, dx * dx + dy * dy + dz * dz)
  }
  out.radius = Math.sqrt(r2)
}

/** Natural ground colours as weights (theme-free), from the height, slope and airfields. */
function colourWeights(position: Float32Array, normal: Float32Array): Float32Array {
  const count = position.length / 3
  const w = new Float32Array(count * WEIGHTS)
  for (let i = 0; i < count; i++) {
    const e = position[i * 3] / U
    const n = -position[i * 3 + 2] / U
    const h = (position[i * 3 + 1] * FLIGHT_UNIT_M) / M_PER_FT
    const steep = 1 - normal[i * 3 + 1]
    const o = i * WEIGHTS
    // Natural ground: shore sand, farmland, forest, rock on steep slopes and high summits
    // (all sand at and below the shore, so the rest is skipped there).
    const sand = Math.min(1, Math.max(0, 1 - (h - 8) / 10))
    w[o + W_SAND] = sand
    if (sand < 1) {
      w[o + W_FOREST] = forestK(e, n, h)
      w[o + W_ROCK] = Math.min(1, Math.max(0, (steep - 0.18) / 0.25, (h - 7500) / 1500))
    }
    // The levelled airfields are mown grass.
    const flat = anyAirfieldFlat(e, n)
    w[o + W_MOWN] = flat < 1 ? Math.min(1, (1 - flat) * 3) : 0
    w[o + W_SHADE] = 0.9 + 0.2 * valueNoise(e * 9, n * 9, 5)
  }
  return w
}

export interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * Vertex colours from the weights and the ground colours (linear RGB, as three.js keeps
 * them): grass, toward forest, then rock, sand and mown grass, times the shade.
 */
export function paintTerrain(weights: Float32Array, out: Float32Array, c: { sand: Rgb; grass: Rgb; forest: Rgb; rock: Rgb }) {
  const mown = { r: c.grass.r + (c.sand.r - c.grass.r) * 0.12, g: c.grass.g + (c.sand.g - c.grass.g) * 0.12, b: c.grass.b + (c.sand.b - c.grass.b) * 0.12 }
  const count = weights.length / WEIGHTS
  for (let i = 0; i < count; i++) {
    const o = i * WEIGHTS
    const f = weights[o + W_FOREST]
    const k = weights[o + W_ROCK]
    const s = weights[o + W_SAND]
    const m = weights[o + W_MOWN]
    const sh = weights[o + W_SHADE]
    let r = c.grass.r + (c.forest.r - c.grass.r) * f
    let g = c.grass.g + (c.forest.g - c.grass.g) * f
    let b = c.grass.b + (c.forest.b - c.grass.b) * f
    r += (c.rock.r - r) * k
    g += (c.rock.g - g) * k
    b += (c.rock.b - b) * k
    r += (c.sand.r - r) * s
    g += (c.sand.g - g) * s
    b += (c.sand.b - b) * s
    r += (mown.r - r) * m
    g += (mown.g - g) * m
    b += (mown.b - b) * m
    out[i * 3] = r * sh
    out[i * 3 + 1] = g * sh
    out[i * 3 + 2] = b * sh
  }
}

function corridorData() {
  const nx = Math.round((CORRIDOR.e1 - CORRIDOR.e0) / CELL_NM)
  const ny = Math.round((CORRIDOR.n1 - CORRIDOR.n0) / CELL_NM)
  // The cells under each patch, as index ranges.
  const holes = TERRAIN_PATCHES.map((p) => ({
    i0: Math.round((p.e0 - CORRIDOR.e0) / CELL_NM),
    i1: Math.round((p.e1 - CORRIDOR.e0) / CELL_NM),
    j0: Math.round((p.n0 - CORRIDOR.n0) / CELL_NM),
    j1: Math.round((p.n1 - CORRIDOR.n0) / CELL_NM),
  }))
  const skip = (i: number, j: number) => {
    for (const h of holes) if (i >= h.i0 && i < h.i1 && j >= h.j0 && j < h.j1) return true
    return false
  }
  return gridData(CORRIDOR, nx, ny, skip, false)
}

/** Ground height on a grid as drawn (its two triangles per cell), ft. */
function gridFtAt(g: GridData, e: number, n: number): number {
  const fx = Math.min(g.nx - 1e-9, Math.max(0, ((e - g.rect.e0) / (g.rect.e1 - g.rect.e0)) * g.nx))
  const fy = Math.min(g.ny - 1e-9, Math.max(0, ((n - g.rect.n0) / (g.rect.n1 - g.rect.n0)) * g.ny))
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const u = fx - i
  const v = fy - j
  const h = g.heightFt
  const s = g.ny + 1
  const ha = h[i * s + j]
  const hb = h[(i + 1) * s + j]
  const hc = h[(i + 1) * s + j + 1]
  const hd = h[i * s + j + 1]
  // Triangles (a, b, c) and (a, c, d), split along the a–c diagonal.
  return u >= v ? ha + (hb - ha) * u + (hc - hb) * v : ha + (hd - ha) * v + (hc - hd) * u
}


export interface TreeData {
  id: string
  /**
   * Instance matrices (16 numbers each), ordered so that the first half is every second
   * tree: drawing only the first half thins the forest evenly.
   */
  matrices: Float32Array
  count: number
}

/**
 * Tree positions on forested ground around one airport: a jittered grid, thinned by the
 * forest density, standing on the patch grid as it is drawn.
 */
function treeData(p: NmRect & { id: string }, g: GridData, spacingM: number): TreeData {
  const all: number[] = []
  const step = spacingM / 1852
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const v = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const ce = (p.e0 + p.e1) / 2
  const cn = (p.n0 + p.n1) / 2
  for (let e = ce - 4; e <= ce + 4; e += step)
    for (let n = cn - 4; n <= cn + 4; n += step) {
      const j1 = hash2(Math.round(e / step), Math.round(n / step), 77)
      const j2 = hash2(Math.round(e / step), Math.round(n / step), 78)
      const pe = e + (j1 - 0.5) * step
      const pn = n + (j2 - 0.5) * step
      if (anyAirfieldFlat(pe, pn) < 1.15) continue
      const h = gridFtAt(g, pe, pn)
      if (h < 14) continue
      if (hash2(Math.round(pe * 997), Math.round(pn * 991), 79) > forestK(pe, pn, h) * 0.95 + 0.08) continue
      // Keep trees off steep slopes: compare neighbours 30 m away.
      const d = 30 / 1852
      const slope = Math.abs(gridFtAt(g, pe + d, pn) - h) + Math.abs(gridFtAt(g, pe, pn + d) - h)
      if (slope > 70) continue
      const tall = 9 + j1 * 9
      const [x, y, z] = toFlight(pe, pn, h)
      s.set((3 + j2 * 2.5) / FLIGHT_UNIT_M, tall / FLIGHT_UNIT_M, (3 + j2 * 2.5) / FLIGHT_UNIT_M)
      q.setFromAxisAngle(yAxis, j1 * 6.28)
      m.compose(v.set(x, y - 0.01, z), q, s)
      for (const k of m.elements) all.push(k)
    }
  // Even trees first, then odd ones.
  const count = all.length / 16
  const half = Math.ceil(count / 2)
  const matrices = new Float32Array(all.length)
  for (let i = 0; i < count; i++) {
    const to = i % 2 === 0 ? i / 2 : half + (i - 1) / 2
    for (let k = 0; k < 16; k++) matrices[to * 16 + k] = all[i * 16 + k]
  }
  return { id: p.id, matrices, count }
}

export interface SeaMap {
  rect: NmRect
  data: Uint8Array
  width: number
  height: number
}

// Built pieces, kept for the session.
let corridorGrid: GridData | null = null
let corridorSea: SeaMap | null = null
const patchGrids = new Map<string, GridData>()
const patchTrees = new Map<string, TreeData>()
const patchSeas = new Map<string, SeaMap>()

const patchOf = (id: string) => TERRAIN_PATCHES.find((p) => p.id === id) ?? TERRAIN_PATCHES[0]

/** The corridor grid (built on first use). */
export const terrainCorridor = () => (corridorGrid ??= corridorData())

/** One airport's patch grid (built on first use). */
export function terrainPatch(id: string): GridData {
  let g = patchGrids.get(id)
  if (!g) patchGrids.set(id, (g = gridData(patchOf(id), PATCH_GRID, PATCH_GRID, null, true)))
  return g
}

/** The trees around one airport (built on first use). */
export function terrainTrees(id: string): TreeData {
  let t = patchTrees.get(id)
  if (!t) patchTrees.set(id, (t = treeData(patchOf(id), terrainPatch(id), 48)))
  return t
}

/** The sea's height map along the whole corridor, 2048 px across (built on first use). */
export const seaCorridor = () => (corridorSea ??= { rect: CORRIDOR, ...seaHeightMap(CORRIDOR, 2048) })

/** The sea's detailed height map around one airport, 512 px across, about 43 m a pixel (built on first use). */
export function seaPatch(id: string): SeaMap {
  let m = patchSeas.get(id)
  if (!m) patchSeas.set(id, (m = { rect: patchOf(id), ...seaHeightMap(patchOf(id), 512) }))
  return m
}

const builtAround = (id: string) => patchGrids.has(id) && patchTrees.has(id) && patchSeas.has(id)

// The airport the view opens at is built at once; the others a piece at a time when the
// browser is idle, so opening the view never blocks for long. The views subscribe to
// hear when another airport is ready.
const listeners = new Set<() => void>()
let ready: readonly string[] = []
const queue: (() => void)[] = []
let pending = false

/** The airports built so far, as a list that stays the same object until it changes. */
function currentReady() {
  const now = TERRAIN_PATCHES.map((p) => p.id).filter(builtAround)
  if (now.length !== ready.length) ready = now
  return ready
}

function refreshReady() {
  const before = ready
  if (currentReady() !== before) for (const l of listeners) l()
}

function whenIdle(f: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(f, { timeout: 400 })
  else setTimeout(f, 16)
}

function runNext() {
  const job = queue.shift()
  job?.()
  refreshReady()
  if (queue.length) whenIdle(runNext)
  else pending = false
}

/** Build the corridor and everything around one airport now (idempotent; safe during a render: it tells no one). */
export function buildGroundAt(id: string) {
  terrainCorridor()
  seaCorridor()
  terrainPatch(id)
  terrainTrees(id)
  seaPatch(id)
}

/** Queue the airports not built yet for idle time (call from an effect). */
export function buildRestWhenIdle() {
  if (pending) return
  for (const p of TERRAIN_PATCHES)
    if (!builtAround(p.id))
      queue.push(
        () => terrainPatch(p.id),
        () => terrainTrees(p.id),
        () => seaPatch(p.id),
      )
  if (!queue.length) return
  pending = true
  whenIdle(runNext)
}

/** The airports whose ground is built (a stable list until another is ready). */
export const builtAirports = currentReady

export function subscribeBuilt(cb: () => void) {
  listeners.add(cb)
  return () => void listeners.delete(cb)
}
