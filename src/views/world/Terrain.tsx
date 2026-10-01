/**
 * The made-up islands at true scale: sand at the shore, mown grass on the levelled
 * airfield, grassland rising into forest, and bare rock on steep slopes and peaks,
 * with instanced trees on the forested ground. Heights come from views/islands, the
 * same function the network map and the sea's shallows use.
 */
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { hash2, valueNoise } from '@/core/random'
import { M_PER_FT } from '@/core/units'
import { col } from '@/stage/col'
import { ISLANDS, airfieldFlat, islandHeightFt, type Island } from '../islands'
import { FLIGHT_UNIT_M, toFlight } from '../scales'

/** How forested the ground is, 0..1 (low hills grassy, higher slopes wooded, with patches). */
function forestK(e: number, n: number, hFt: number) {
  const patch = valueNoise(e * 2.3, n * 2.3, 41)
  return Math.min(1, Math.max(0, (hFt - 60) / 260 + (patch - 0.5) * 1.3))
}

function IslandMesh({ isl, t, segs }: { isl: Island; t: ThemeTokens; segs: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, segs, segs)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const e = isl.eastNm + pos.getX(i) * isl.rxNm * 2.5
      const n = isl.northNm - pos.getZ(i) * isl.ryNm * 2.5
      const [x, y, z] = toFlight(e, n, Math.max(islandHeightFt(isl, e, n), -70))
      pos.setXYZ(i, x, y, z)
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3))
    return g
  }, [isl, segs])
  useLayoutEffect(() => {
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
    const U = 1852 / FLIGHT_UNIT_M
    for (let i = 0; i < pos.count; i++) {
      const e = pos.getX(i) / U
      const n = -pos.getZ(i) / U
      const h = (pos.getY(i) * FLIGHT_UNIT_M) / M_PER_FT
      const steep = 1 - nor.getY(i)
      // Natural ground: shore sand, grass, forest, rock on steep or high ground.
      c.copy(grass).lerp(forest, forestK(e, n, h))
      c.lerp(rock, Math.min(1, Math.max(0, (steep - 0.12) / 0.2, (h - 1150) / 400)))
      c.lerp(sand, Math.min(1, Math.max(0, 1 - (h - 6) / 10)))
      // The levelled airfield is mown grass.
      const flat = airfieldFlat(isl, e, n)
      if (flat < 1) c.lerp(mown, Math.min(1, (1 - flat) * 3))
      const shade = 0.9 + 0.2 * valueNoise(e * 9, n * 9, 5)
      tmp.copy(c).multiplyScalar(shade)
      colr.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    colr.needsUpdate = true
  }, [geo, t, isl])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

/** Tree positions on forested ground: a jittered grid, thinned by the forest density. */
function treeMatrices(spacingM: number): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = []
  const step = spacingM / 1852
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  for (const isl of ISLANDS) {
    for (let e = isl.eastNm - isl.rxNm; e <= isl.eastNm + isl.rxNm; e += step)
      for (let n = isl.northNm - isl.ryNm; n <= isl.northNm + isl.ryNm; n += step) {
        const j1 = hash2(Math.round(e / step), Math.round(n / step), 77)
        const j2 = hash2(Math.round(e / step), Math.round(n / step), 78)
        const pe = e + (j1 - 0.5) * step
        const pn = n + (j2 - 0.5) * step
        const h = islandHeightFt(isl, pe, pn)
        if (h < 14 || airfieldFlat(isl, pe, pn) < 1.15) continue
        // Keep trees off steep slopes: compare neighbours 30 m away.
        const d = 30 / 1852
        const slope = Math.abs(islandHeightFt(isl, pe + d, pn) - h) + Math.abs(islandHeightFt(isl, pe, pn + d) - h)
        if (slope > 70) continue
        if (hash2(Math.round(pe * 997), Math.round(pn * 991), 79) > forestK(pe, pn, h) * 0.95) continue
        const tall = 9 + j1 * 9
        const [x, y, z] = toFlight(pe, pn, h)
        s.set(((3 + j2 * 2.5) / FLIGHT_UNIT_M) * 1, tall / FLIGHT_UNIT_M, ((3 + j2 * 2.5) / FLIGHT_UNIT_M) * 1)
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), j1 * 6.28)
        out.push(m.clone().compose(new THREE.Vector3(x, y - 0.01, z), q, s))
      }
  }
  return out
}

function Trees({ t, count }: { t: ThemeTokens; count: 'all' | 'half' }) {
  const all = useMemo(() => treeMatrices(42), [])
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
  return (
    <group>
      {ISLANDS.map((isl) => (
        <IslandMesh key={isl.id} isl={isl} t={t} segs={isl.airport ? 300 : 110} />
      ))}
      <Trees t={t} count={lowDetail ? 'half' : 'all'} />
    </group>
  )
}
