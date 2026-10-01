/**
 * Java, Madura and Bali at true scale, from views/terrain (the same surface the sea's
 * shallows, the camera and the ground shadow use): rice-field green on the coastal
 * plain, forest on the hills, bare rock on the volcano summits and sand at the shore,
 * mown grass on the levelled airfields and instanced trees around the airports.
 *
 * Two levels of detail: a coarse corridor along the route (cells of 1.2 NM, enough from
 * cruise level), and a fine patch around each airport (about 90 m cells) for the ground
 * and low-level phases. The corridor leaves a hole under each patch; a skirt hanging from
 * the patch edge hides the seam.
 */
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { hash2, valueNoise } from '@/core/random'
import { AIRPORT_LIST, runwayToLocalNm } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { col } from '@/stage/col'
import { anyAirfieldFlat, terrainFtAt } from '../terrain'
import { FLIGHT_UNIT_M, toFlight } from '../scales'

export interface NmRect {
  e0: number
  e1: number
  n0: number
  n1: number
}

/** Corridor cell size, NM. */
const CELL_NM = 1.2
/** The corridor along the route, local NM (multiples of the cell). */
export const CORRIDOR: NmRect = { e0: -300, e1: 300, n0: -120, n1: 126 }
const PATCH_CELLS = 10
const snap = (v: number) => Math.floor(v / CELL_NM) * CELL_NM

/** The fine patch around each airport: 12 NM square, centred on the runway, snapped to the corridor grid. */
export const TERRAIN_PATCHES: readonly (NmRect & { id: string })[] = AIRPORT_LIST.map((ap) => {
  const [ce, cn] = runwayToLocalNm(ap, ap.runwayLengthM / 2, ap.terminalSide * ((ap.parallelOffsetM ? Math.abs(ap.parallelOffsetM) : 0) / 2 + 400))
  const e0 = snap(ce - (PATCH_CELLS * CELL_NM) / 2)
  const n0 = snap(cn - (PATCH_CELLS * CELL_NM) / 2)
  return { id: ap.id, e0, e1: e0 + PATCH_CELLS * CELL_NM, n0, n1: n0 + PATCH_CELLS * CELL_NM }
})

/** How forested the ground is, 0..1 (the coastal plain is farmland, hills and slopes wooded, with patches). */
function forestK(e: number, n: number, hFt: number) {
  const patch = valueNoise(e * 2.3, n * 2.3, 41)
  return Math.min(1, Math.max(0, (hFt - 250) / 900 + (patch - 0.5) * 1.3))
}

const U = 1852 / FLIGHT_UNIT_M
const SKIRT_FT = 400

/**
 * A height-field grid over a rectangle: (nx+1)×(ny+1) vertices, cells for which `skip`
 * is true are left out, and an optional skirt hangs from the border.
 */
function gridGeometry(r: NmRect, nx: number, ny: number, skip: ((i: number, j: number) => boolean) | null, skirt: boolean) {
  const pos: number[] = []
  const idx: number[] = []
  const at = (i: number, j: number) => i * (ny + 1) + j
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= ny; j++) {
      const e = r.e0 + ((r.e1 - r.e0) * i) / nx
      const n = r.n0 + ((r.n1 - r.n0) * j) / ny
      pos.push(...toFlight(e, n, Math.max(terrainFtAt(e, n), -150)))
    }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      if (skip?.(i, j)) continue
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      // Wound so the face looks up (north is −z).
      idx.push(a, b, c, a, c, d)
    }
  if (skirt) {
    // The border, walked once around, and a copy of it lowered by SKIRT_FT.
    const ring: [number, number][] = []
    for (let i = 0; i < nx; i++) ring.push([i, 0])
    for (let j = 0; j < ny; j++) ring.push([nx, j])
    for (let i = nx; i > 0; i--) ring.push([i, ny])
    for (let j = ny; j > 0; j--) ring.push([0, j])
    const base = pos.length / 3
    for (const [i, j] of ring) {
      const k = at(i, j) * 3
      pos.push(pos[k], pos[k + 1] - (SKIRT_FT * M_PER_FT) / FLIGHT_UNIT_M, pos[k + 2])
    }
    for (let k = 0; k < ring.length; k++) {
      const k2 = (k + 1) % ring.length
      const top1 = at(...ring[k])
      const top2 = at(...ring[k2])
      // Both sides, so the skirt hides the seam from either side.
      idx.push(top1, base + k, top2, top2, base + k, base + k2, top1, top2, base + k, top2, base + k2, base + k)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3))
  return g
}

function paint(geo: THREE.BufferGeometry, t: ThemeTokens) {
  const sand = col(t, 'world-sand')
  const grass = col(t, 'world-grass')
  const forest = col(t, 'world-forest')
  const rock = col(t, 'world-rock')
  const mown = grass.clone().lerp(sand, 0.12)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute
  const colr = geo.getAttribute('color') as THREE.BufferAttribute
  const c = new THREE.Color()
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const e = pos.getX(i) / U
    const n = -pos.getZ(i) / U
    const h = (pos.getY(i) * FLIGHT_UNIT_M) / M_PER_FT
    const steep = 1 - nor.getY(i)
    // Natural ground: shore sand, farmland, forest, rock on steep slopes and high summits.
    c.copy(grass).lerp(forest, forestK(e, n, h))
    c.lerp(rock, Math.min(1, Math.max(0, (steep - 0.18) / 0.25, (h - 7500) / 1500)))
    c.lerp(sand, Math.min(1, Math.max(0, 1 - (h - 8) / 10)))
    // The levelled airfields are mown grass.
    const flat = anyAirfieldFlat(e, n)
    if (flat < 1) c.lerp(mown, Math.min(1, (1 - flat) * 3))
    const shade = 0.9 + 0.2 * valueNoise(e * 9, n * 9, 5)
    tmp.copy(c).multiplyScalar(shade)
    colr.setXYZ(i, tmp.r, tmp.g, tmp.b)
  }
  colr.needsUpdate = true
}

function TerrainMesh({ geo, t }: { geo: THREE.BufferGeometry; t: ThemeTokens }) {
  useLayoutEffect(() => paint(geo, t), [geo, t])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

function corridorGeometry() {
  const nx = Math.round((CORRIDOR.e1 - CORRIDOR.e0) / CELL_NM)
  const ny = Math.round((CORRIDOR.n1 - CORRIDOR.n0) / CELL_NM)
  const eps = 1e-6
  const skip = (i: number, j: number) => {
    const e = CORRIDOR.e0 + (i + 0.5) * CELL_NM
    const n = CORRIDOR.n0 + (j + 0.5) * CELL_NM
    return TERRAIN_PATCHES.some((p) => e > p.e0 + eps && e < p.e1 - eps && n > p.n0 + eps && n < p.n1 - eps)
  }
  return gridGeometry(CORRIDOR, nx, ny, skip, false)
}

/** Tree positions on forested ground around the airports: a jittered grid, thinned by the forest density. */
function treeMatrices(spacingM: number): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = []
  const step = spacingM / 1852
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  for (const p of TERRAIN_PATCHES) {
    const ce = (p.e0 + p.e1) / 2
    const cn = (p.n0 + p.n1) / 2
    for (let e = ce - 4; e <= ce + 4; e += step)
      for (let n = cn - 4; n <= cn + 4; n += step) {
        const j1 = hash2(Math.round(e / step), Math.round(n / step), 77)
        const j2 = hash2(Math.round(e / step), Math.round(n / step), 78)
        const pe = e + (j1 - 0.5) * step
        const pn = n + (j2 - 0.5) * step
        if (anyAirfieldFlat(pe, pn) < 1.15) continue
        const h = terrainFtAt(pe, pn)
        if (h < 14) continue
        if (hash2(Math.round(pe * 997), Math.round(pn * 991), 79) > forestK(pe, pn, h) * 0.95 + 0.08) continue
        // Keep trees off steep slopes: compare neighbours 30 m away.
        const d = 30 / 1852
        const slope = Math.abs(terrainFtAt(pe + d, pn) - h) + Math.abs(terrainFtAt(pe, pn + d) - h)
        if (slope > 70) continue
        const tall = 9 + j1 * 9
        const [x, y, z] = toFlight(pe, pn, h)
        s.set((3 + j2 * 2.5) / FLIGHT_UNIT_M, tall / FLIGHT_UNIT_M, (3 + j2 * 2.5) / FLIGHT_UNIT_M)
        q.setFromAxisAngle(yAxis, j1 * 6.28)
        out.push(m.clone().compose(new THREE.Vector3(x, y - 0.01, z), q, s))
      }
  }
  return out
}

function Trees({ t, count }: { t: ThemeTokens; count: 'all' | 'half' }) {
  const all = useMemo(() => treeMatrices(48), [])
  const { mesh, geo } = useMemo(() => {
    // A tree: a cone crown on a short trunk, unit height, base at 0.
    const crown = new THREE.ConeGeometry(1, 0.8, 7)
    crown.translate(0, 0.6, 0)
    const inst = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }), all.length)
    all.forEach((mm, i) => inst.setMatrixAt(i, mm))
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    return { mesh: inst, geo: crown }
  }, [all])
  useLayoutEffect(() => {
    ;(mesh.material as THREE.MeshStandardMaterial).color.copy(col(t, 'world-forest')).lerp(col(t, 'world-grass'), 0.15)
  }, [mesh, t])
  useLayoutEffect(() => {
    mesh.count = count === 'all' ? all.length : Math.floor(all.length / 2)
  }, [mesh, count, all])
  useLayoutEffect(
    () => () => {
      geo.dispose()
      ;(mesh.material as THREE.Material).dispose()
      mesh.dispose()
    },
    [mesh, geo],
  )
  return <primitive object={mesh} />
}

export function Terrain({ t, lowDetail }: { t: ThemeTokens; lowDetail: boolean }) {
  const corridor = useMemo(corridorGeometry, [])
  const patches = useMemo(() => TERRAIN_PATCHES.map((p) => ({ id: p.id, geo: gridGeometry(p, 240, 240, null, true) })), [])
  return (
    <group>
      <TerrainMesh geo={corridor} t={t} />
      {patches.map((p) => (
        <TerrainMesh key={p.id} geo={p.geo} t={t} />
      ))}
      <Trees t={t} count={lowDetail ? 'half' : 'all'} />
    </group>
  )
}
