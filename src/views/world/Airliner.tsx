/**
 * A twin-engine airliner at true scale (about 37.6 m long, 35.8 m span), built from
 * code: a lathed fuselage, swept wings, tailplane and fin, two engines and the
 * landing gear. Authored in metres with the wheels at y = 0, nose toward +x. Lights
 * are the real ones: red on the left wingtip, green on the right, a red beacon, white
 * strobes, and landing lights in the air below 10 000 ft.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { col } from '@/stage/col'
import { FLIGHT_UNIT_M } from '../scales'
import { lampSprite } from './lampSprite'

export interface AirlinerGeos {
  body: THREE.BufferGeometry
  wing: THREE.BufferGeometry
  dark: THREE.BufferGeometry
  glass: THREE.BufferGeometry
  tail: THREE.BufferGeometry
  gear: THREE.BufferGeometry
}

const FUSE_Y = 3.5

function plan(points: [number, number][], thick: number) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  return g
}

function mergeAll(list: THREE.BufferGeometry[]) {
  // Every part is made non-indexed with the same attributes so they merge into one buffer.
  const parts = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k)
    if (!n.getAttribute('normal')) n.computeVertexNormals()
    return n
  })
  let count = 0
  for (const p of parts) count += p.getAttribute('position').count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  let o = 0
  for (const p of parts) {
    pos.set(p.getAttribute('position').array as Float32Array, o * 3)
    nor.set(p.getAttribute('normal').array as Float32Array, o * 3)
    o += p.getAttribute('position').count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.computeBoundingSphere()
  return out
}

export function makeAirlinerGeos(): AirlinerGeos {
  // Fuselage: radius along its length, tail at −19 m, nose at +18.6 m.
  const prof: [number, number][] = [
    [0.05, -19.2],
    [0.55, -18.6],
    [1.15, -16.8],
    [1.7, -13.8],
    [1.98, -10],
    [1.98, 12.2],
    [1.9, 14.2],
    [1.68, 15.9],
    [1.25, 17.4],
    [0.62, 18.3],
    [0.05, 18.65],
  ]
  const fuse = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  )
  fuse.rotateZ(-Math.PI / 2)
  fuse.translate(0, FUSE_Y, 0)
  // Wings: swept 25°, root chord 6.4 m, tip chord 1.6 m, 3° dihedral, low on the fuselage.
  const right = plan(
    [
      [3.6, 0],
      [-4.6, 16.9],
      [-6.2, 16.9],
      [-2.8, 0],
    ],
    0.38,
  )
  right.rotateX(Math.PI / 2)
  right.rotateX(-0.05)
  right.translate(0, FUSE_Y - 1.1, 0.9)
  const left = right.clone()
  left.scale(1, 1, -1)
  const flipped = left.index ? left.toNonIndexed() : left
  // Mirroring reverses the winding: swap two vertices of every triangle.
  const p = flipped.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i += 3) {
    const [x, y, z] = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)]
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2))
    p.setXYZ(i + 2, x, y, z)
  }
  flipped.computeVertexNormals()
  // Tailplane.
  const stabR = plan(
    [
      [-14.2, 0],
      [-17.6, 6.1],
      [-18.8, 6.1],
      [-18.4, 0],
    ],
    0.22,
  )
  stabR.rotateX(Math.PI / 2)
  stabR.translate(0, FUSE_Y + 0.6, 0.4)
  const stabL = stabR.clone()
  stabL.scale(1, 1, -1)
  const stabLf = stabL.index ? stabL.toNonIndexed() : stabL
  const sp = stabLf.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < sp.count; i += 3) {
    const [x, y, z] = [sp.getX(i + 1), sp.getY(i + 1), sp.getZ(i + 1)]
    sp.setXYZ(i + 1, sp.getX(i + 2), sp.getY(i + 2), sp.getZ(i + 2))
    sp.setXYZ(i + 2, x, y, z)
  }
  stabLf.computeVertexNormals()
  // Fin.
  const fin = plan(
    [
      [-12.6, 0],
      [-17.4, 6.4],
      [-19.0, 6.4],
      [-18.8, 0],
    ],
    0.32,
  )
  fin.translate(0, FUSE_Y + 1.4, -0.16)
  // Engines under the wings, with pylons.
  const engines: THREE.BufferGeometry[] = []
  for (const z of [-5.75, 5.75]) {
    const nac = new THREE.CylinderGeometry(1.05, 0.82, 4.3, 18, 1, false)
    nac.rotateZ(Math.PI / 2)
    nac.translate(2.2, FUSE_Y - 1.95, z)
    const pylon = new THREE.BoxGeometry(2.6, 0.9, 0.3)
    pylon.translate(1.4, FUSE_Y - 1.2, z)
    engines.push(nac, pylon)
  }
  // Windows and cockpit glazing.
  const band = new THREE.BoxGeometry(25, 0.32, 4.02)
  band.translate(-0.5, FUSE_Y + 0.55, 0)
  const cockpit = new THREE.BoxGeometry(1.4, 0.5, 2.6)
  cockpit.translate(16.4, FUSE_Y + 0.75, 0)
  // Landing gear: two main legs and the nose leg.
  const gear: THREE.BufferGeometry[] = []
  const leg = (x: number, z: number, len: number) => {
    const strut = new THREE.CylinderGeometry(0.14, 0.14, len, 8)
    strut.translate(x, 0.55 + len / 2, z)
    gear.push(strut)
    for (const dz of [-0.35, 0.35]) {
      const wheel = new THREE.CylinderGeometry(0.56, 0.56, 0.4, 14)
      wheel.rotateX(Math.PI / 2)
      wheel.translate(x, 0.56, z + dz)
      gear.push(wheel)
    }
  }
  leg(-1.4, -3.8, FUSE_Y - 1.6)
  leg(-1.4, 3.8, FUSE_Y - 1.6)
  leg(12.6, 0, FUSE_Y - 2.2)
  return {
    body: mergeAll([fuse]),
    wing: mergeAll([right, flipped, stabR, stabLf]),
    dark: mergeAll(engines),
    glass: mergeAll([band, cockpit]),
    tail: mergeAll([fin]),
    gear: mergeAll(gear),
  }
}

let shared: AirlinerGeos | null = null
/** One set of geometries for every airliner in the scene. */
export const airlinerGeos = () => (shared ??= makeAirlinerGeos())

export interface AirlinerHandle {
  /** Gear down or up. */
  gear: boolean
  /** Landing lights on. */
  landing: boolean
  /** Beacon and strobes on. */
  beacon: boolean
}

/**
 * One airliner. `state` is read every frame (mutate it from the caller's frame loop).
 * `blink` animates the beacon and strobes (off with reduced motion: steady lights).
 */
export function Airliner({ t, state, blink, night }: { t: ThemeTokens; state: AirlinerHandle; blink: boolean; night: { value: number } }) {
  const g = airlinerGeos()
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }),
      wing: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }),
      dark: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }),
      glass: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.2 }),
      tail: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }),
    }),
    [],
  )
  useLayoutEffect(() => {
    mats.body.color.copy(col(t, 'stage-paint'))
    mats.wing.color.copy(col(t, 'world-building'))
    mats.dark.color.copy(col(t, 'stage-metal'))
    mats.glass.color.copy(col(t, 'world-glazing'))
    mats.tail.color.copy(col(t, 'world-roof'))
  }, [mats, t])
  useLayoutEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const gearRef = useRef<THREE.Mesh>(null)

  // Lights: left nav (red), right nav (green), beacon top and bottom (red), wingtip strobes, landing lights.
  const lights = useMemo(() => {
    const pts = [
      [-4.9, FUSE_Y - 0.9, -17.8],
      [-4.9, FUSE_Y - 0.9, 17.8],
      [-2, FUSE_Y + 2.05, 0],
      [-2, FUSE_Y - 2.05, 0],
      [-5.3, FUSE_Y - 0.9, -17.6],
      [-5.3, FUSE_Y - 0.9, 17.6],
      [3.2, FUSE_Y - 1.2, -2.6],
      [3.2, FUSE_Y - 1.2, 2.6],
    ]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pts.length * 3), 3))
    const mat = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, map: lampSprite(), transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.02 })
    return new THREE.Points(geo, mat)
  }, [])
  useLayoutEffect(
    () => () => {
      lights.geometry.dispose()
      ;(lights.material as THREE.Material).dispose()
    },
    [lights],
  )
  const lampCols = useMemo(() => ({ red: col(t, 'lamp-red'), green: col(t, 'lamp-green'), white: col(t, 'lamp-white') }), [t])
  useFrame((st) => {
    if (gearRef.current) gearRef.current.visible = state.gear
    const c = lights.geometry.getAttribute('color') as THREE.BufferAttribute
    const time = st.clock.elapsedTime
    const boost = 1 + 2.2 * night.value
    const beaconOn = state.beacon && (!blink || time % 1.1 < 0.12)
    const strobeOn = state.beacon && !state.gear ? !blink || (time + 0.5) % 1.3 < 0.06 : false
    const set = (i: number, k: THREE.Color, on: boolean, gain = 1) => c.setXYZ(i, on ? k.r * boost * gain : 0, on ? k.g * boost * gain : 0, on ? k.b * boost * gain : 0)
    set(0, lampCols.red, state.beacon)
    set(1, lampCols.green, state.beacon)
    set(2, lampCols.red, beaconOn, 1.4)
    set(3, lampCols.red, beaconOn, 1.4)
    set(4, lampCols.white, strobeOn, 2)
    set(5, lampCols.white, strobeOn, 2)
    set(6, lampCols.white, state.landing, 1.6)
    set(7, lampCols.white, state.landing, 1.6)
    c.needsUpdate = true
  })
  const s = 1 / FLIGHT_UNIT_M
  return (
    <group scale={[s, s, s]}>
      <mesh geometry={g.body} material={mats.body} />
      <mesh geometry={g.wing} material={mats.wing} />
      <mesh geometry={g.dark} material={mats.dark} />
      <mesh geometry={g.glass} material={mats.glass} />
      <mesh geometry={g.tail} material={mats.tail} />
      <mesh ref={gearRef} geometry={g.gear} material={mats.dark} />
      <primitive object={lights} />
    </group>
  )
}
