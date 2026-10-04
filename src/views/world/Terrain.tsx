/**
 * Java, Madura and Bali at true scale, from views/terrain (the same surface the sea's
 * shallows, the camera and the ground shadow use): rice-field green on the coastal
 * plain, forest on the hills, bare rock on the volcano summits and sand at the shore,
 * mown grass on the levelled airfields and instanced trees around the airports.
 *
 * The grids, colour weights and tree positions come from world/terrainData, built once
 * per session; this component only makes the meshes from them (and frees them when the
 * view closes). A theme change repaints the vertex colours, nothing else.
 */
import { Fragment, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { col } from '@/stage/col'
import { paintTerrain, terrainCorridor, terrainPatch, terrainTrees, type GridData, type Rgb, type TreeData } from './terrainData'

interface GroundColours {
  sand: Rgb
  grass: Rgb
  forest: Rgb
  rock: Rgb
}

function TerrainMesh({ data, colours }: { data: GridData; colours: GroundColours }) {
  // Its own geometry over the session's arrays: the GPU buffers are freed on unmount, the arrays kept.
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.position.length), 3))
    g.setIndex(new THREE.BufferAttribute(data.index, 1))
    g.boundingSphere = data.sphere.clone()
    return g
  }, [data])
  useLayoutEffect(() => {
    const c = geo.getAttribute('color') as THREE.BufferAttribute
    paintTerrain(data.weights, c.array as Float32Array, colours)
    c.needsUpdate = true
  }, [geo, data, colours])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

/** The trees around one airport: their own instanced mesh, so each airport is culled on its own. */
function Trees({ data, crown, mat, half }: { data: TreeData; crown: THREE.BufferGeometry; mat: THREE.Material; half: boolean }) {
  const mesh = useMemo(() => {
    const inst = new THREE.InstancedMesh(crown, mat, data.count)
    ;(inst.instanceMatrix.array as Float32Array).set(data.matrices)
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    return inst
  }, [data, crown, mat])
  useLayoutEffect(() => {
    // The matrices are stored every second tree first, so half the count thins the forest evenly.
    mesh.count = half ? Math.ceil(data.count / 2) : data.count
  }, [mesh, half, data])
  useLayoutEffect(() => () => mesh.dispose(), [mesh])
  return <primitive object={mesh} />
}

/** The tokens a set of colours is read from, as one string: memos keyed on it survive theme switches that leave them unchanged. */
const tokenKey = (t: ThemeTokens, names: (keyof ThemeTokens)[]) => names.map((n) => String(t[n])).join('|')

const linear = (c: THREE.Color): Rgb => ({ r: c.r, g: c.g, b: c.b })

export function Terrain({ t, lowDetail, airports }: { t: ThemeTokens; lowDetail: boolean; airports: readonly string[] }) {
  const groundKey = tokenKey(t, ['world-sand', 'world-grass', 'world-forest', 'world-rock'])
  const colours = useMemo<GroundColours>(
    () => ({ sand: linear(col(t, 'world-sand')), grass: linear(col(t, 'world-grass')), forest: linear(col(t, 'world-forest')), rock: linear(col(t, 'world-rock')) }),
    // Keyed on the token values, not the tokens object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groundKey],
  )
  const { crown, treeMat } = useMemo(() => {
    // A tree: a cone crown, unit height, base at 0.
    const crown = new THREE.ConeGeometry(1, 0.8, 7)
    crown.translate(0, 0.6, 0)
    return { crown, treeMat: new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }) }
  }, [])
  useLayoutEffect(() => {
    treeMat.color.setRGB(colours.forest.r, colours.forest.g, colours.forest.b).lerp(new THREE.Color(colours.grass.r, colours.grass.g, colours.grass.b), 0.15)
  }, [treeMat, colours])
  useLayoutEffect(
    () => () => {
      crown.dispose()
      treeMat.dispose()
    },
    [crown, treeMat],
  )
  return (
    <group>
      <TerrainMesh data={terrainCorridor()} colours={colours} />
      {airports.map((id) => (
        <Fragment key={id}>
          <TerrainMesh data={terrainPatch(id)} colours={colours} />
          <Trees data={terrainTrees(id)} crown={crown} mat={treeMat} half={lowDetail} />
        </Fragment>
      ))}
    </group>
  )
}
