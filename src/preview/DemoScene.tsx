/**
 * Stage 0 kit preview only (removed in Stage 3): a pen-plotted terrain table with
 * the destination runway, LAB201 on final inside its protection-level cylinder and
 * the alert-limit wireframe, and one GPS and one GEO wire. It exercises every part
 * of the stage kit. Loaded lazily, inside the three.js chunk.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { valueNoise } from '@/core/random'
import { M_PER_FT } from '@/core/units'
import { useReducedMotion } from '@/stores/prefs'
import { Callout3D } from '@/stage/Callout3D'
import { PenPlot } from '@/stage/PenPlot'
import { StudioFloor } from '@/stage/StudioFloor'
import { Wire3D, type WireHandle } from '@/stage/Wire3D'
import { col } from '@/stage/col'
import { hU, TABLE_ACROSS_NM, toU, vU } from '@/stage/scale'
import type { Quality } from '@/stage/types'
import { AIRCRAFT, demo, DEMO_HAL_M, DEMO_VAL_M, GEO_SAT, GPS_SAT, RUNWAY_LENGTH_M, RUNWAY_WIDTH_M, RWY_HALF_NM, THRESHOLD } from './demoState'

const SLAB = 0.5

/** Terrain height, ft, of the made-up archipelago at a table point (NM). Flat around the runway. */
export function terrainFt(x: number, y: number): number {
  const islands = [
    // The main island: the runway sits on its west coast, so the final approach is over the sea.
    { cx: 5, cy: 0.6, rx: 6.5, ry: 4.4, h: 1900 },
    { cx: -5.8, cy: 5.6, rx: 2.4, ry: 1.8, h: 900 },
    { cx: -4.5, cy: -6.2, rx: 2.8, ry: 2.0, h: 1200 },
  ]
  let h = -80
  for (const i of islands) {
    const d = Math.hypot((x - i.cx) / i.rx, (y - i.cy) / i.ry)
    const n = valueNoise(x * 0.55 + i.cx, y * 0.55 + i.cy, 7) * 0.7 + valueNoise(x * 1.7, y * 1.7, 3) * 0.3
    const mask = Math.max(0, 1 - d * d)
    h = Math.max(h, -80 + mask * (80 + i.h * n * mask))
  }
  // The airport: a flat apron around the runway, 30 ft above the sea.
  const flat = Math.max(Math.abs(y) / 0.6, (Math.abs(x) - RWY_HALF_NM) / 0.5)
  if (flat < 1) h = 30 + (h - 30) * flat * flat
  return h
}

function useTerrain(t: ThemeTokens) {
  const geo = useMemo(() => {
    const seg = 110
    const g = new THREE.PlaneGeometry(TABLE_ACROSS_NM, TABLE_ACROSS_NM, seg, seg)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const northNm = -pos.getZ(i)
      pos.setY(i, vU(terrainFt(x, northNm) * M_PER_FT))
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3))
    return g
  }, [])
  // Colour by height from the theme tokens; re-run when the theme changes.
  useLayoutEffect(() => {
    const low = col(t, 'stage-terrain')
    const high = col(t, 'stage-terrain-high')
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const c = geo.getAttribute('color') as THREE.BufferAttribute
    const top = vU(1900 * M_PER_FT)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, Math.max(0, pos.getY(i) / top))
      tmp.copy(low).lerp(high, Math.pow(k, 0.8))
      c.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    c.needsUpdate = true
  }, [geo, t])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return geo
}

/** Wireframe cylinder: two rims and eight verticals (the alert limit). */
function useAlGeometry(radius: number, halfHeight: number) {
  const geo = useMemo(() => {
    const pts: number[] = []
    const n = 48
    for (const y of [-halfHeight, halfHeight])
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        pts.push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius)
      }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      pts.push(Math.cos(a) * radius, -halfHeight, Math.sin(a) * radius, Math.cos(a) * radius, halfHeight, Math.sin(a) * radius)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [radius, halfHeight])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return geo
}

export default function DemoScene({ t }: { t: ThemeTokens; quality: Quality }) {
  const reduced = useReducedMotion()
  const c = useMemo(
    () => ({
      paint: col(t, 'stage-paint'),
      metal: col(t, 'stage-metal'),
      metalDark: col(t, 'stage-metal-dark'),
      water: col(t, 'stage-water'),
      signal: col(t, 'stage-signal'),
      brass: col(t, 'stage-brass'),
      line: col(t, 'stage-line'),
      green: col(t, 'lamp-green'),
      red: col(t, 'lamp-red'),
      white: col(t, 'lamp-white'),
    }),
    [t],
  )
  const terrain = useTerrain(t)
  const al = useAlGeometry(hU(DEMO_HAL_M), vU(DEMO_VAL_M))
  const pl = useRef<THREE.Mesh>(null)
  const gpsWire = useRef<WireHandle>(null)
  const geoWire = useRef<WireHandle>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const ac = useMemo(() => new THREE.Vector3(...AIRCRAFT), [])
  const geoV = useMemo(() => new THREE.Vector3(...GEO_SAT), [])

  // The final approach path from 8 NM to the threshold (3°), drawn as a thin line.
  const path = useMemo(() => {
    const far = toU(-RWY_HALF_NM - 8, 0, (8 * 1852 * Math.tan((3 * Math.PI) / 180)) / M_PER_FT + 50)
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...far), new THREE.Vector3(THRESHOLD[0], vU(50 * M_PER_FT), 0)])
    return g
  }, [])
  useLayoutEffect(() => () => path.dispose(), [path])

  useFrame(() => {
    // The cylinder follows the shared demo world, so it always agrees with the panels.
    if (pl.current) pl.current.scale.set(hU(demo.hplM), vU(demo.vplM), hU(demo.hplM))
    gpsWire.current?.set(GPS_SAT, AIRCRAFT)
    gpsWire.current?.setVisible(true)
    geoWire.current?.set(GEO_SAT, AIRCRAFT)
    geoWire.current?.setVisible(true)
    if (pulse.current) {
      // A correction travelling from the GEO to the aircraft. Slow motion stretches it;
      // with reduced motion the wire stays static and the pulse is hidden.
      pulse.current.visible = !reduced
      const period = demo.frozen ? 6 : 1.6
      const s = (demo.realS % period) / period
      pulse.current.position.copy(geoV).lerp(ac, s)
    }
  })

  const rwyLen = hU(RUNWAY_LENGTH_M)
  const rwyW = hU(RUNWAY_WIDTH_M)
  return (
    <group>
      <StudioFloor t={t} y={-SLAB - 0.02} shadowScale={26} />
      <PenPlot color={c.signal}>
        {/* The table: a slab with the terrain on top and the sea inside it. */}
        <mesh position={[0, -SLAB / 2 - 0.02, 0]}>
          <boxGeometry args={[TABLE_ACROSS_NM + 0.3, SLAB, TABLE_ACROSS_NM + 0.3]} />
          <meshStandardMaterial color={c.metalDark} roughness={0.8} metalness={0.1} />
        </mesh>
        <mesh geometry={terrain}>
          <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} userData={{ noPenPlot: true }}>
          <planeGeometry args={[TABLE_ACROSS_NM, TABLE_ACROSS_NM]} />
          <meshStandardMaterial color={c.water} roughness={0.7} metalness={0} transparent opacity={0.92} />
        </mesh>
        {/* Runway 09/27 */}
        <mesh position={[0, vU(30 * M_PER_FT) + 0.002, 0]}>
          <boxGeometry args={[rwyLen, 0.004, rwyW]} />
          <meshStandardMaterial color={c.metal} roughness={0.8} />
        </mesh>
      </PenPlot>

      {/* Runway lamps: green at the threshold, red at the far end, white approach lights. */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i}>
          <mesh position={[THRESHOLD[0], vU(30 * M_PER_FT) + 0.008, (i - 2) * (rwyW / 4)]}>
            <sphereGeometry args={[0.006, 8, 8]} />
            <meshBasicMaterial color={c.green} toneMapped={false} />
          </mesh>
          <mesh position={[-THRESHOLD[0], vU(30 * M_PER_FT) + 0.008, (i - 2) * (rwyW / 4)]}>
            <sphereGeometry args={[0.006, 8, 8]} />
            <meshBasicMaterial color={c.red} toneMapped={false} />
          </mesh>
          <mesh position={[THRESHOLD[0] - 0.05 - i * 0.07, vU(30 * M_PER_FT) + 0.008, 0]}>
            <sphereGeometry args={[0.006, 8, 8]} />
            <meshBasicMaterial color={c.white} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <lineSegments geometry={path}>
        <lineBasicMaterial color={c.paint} transparent opacity={0.55} />
      </lineSegments>

      {/* LAB201, to scale (a 37 m aircraft), with its protection level and alert limit. */}
      <group position={AIRCRAFT}>
        <mesh>
          <boxGeometry args={[hU(37), hU(4) * 3, hU(4)]} />
          <meshStandardMaterial color={c.paint} roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[hU(8), hU(1) * 3, hU(35)]} />
          <meshStandardMaterial color={c.paint} roughness={0.5} />
        </mesh>
        <mesh ref={pl} scale={[hU(12), vU(18), hU(12)]}>
          {/* Unit cylinder (radius 1, half-height 1), scaled to HPL and VPL every frame. */}
          <cylinderGeometry args={[1, 1, 2, 48, 1, true]} />
          <meshBasicMaterial color={c.signal} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <lineSegments geometry={al}>
          <lineBasicMaterial color={c.brass} transparent opacity={0.9} toneMapped={false} />
        </lineSegments>
      </group>

      {/* Satellites: GPS as a small box with panels, GEO as a diamond. */}
      <group position={GPS_SAT}>
        <mesh>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial color={c.metal} emissive={c.signal} emissiveIntensity={0.6} />
        </mesh>
        <mesh>
          <boxGeometry args={[1.1, 0.02, 0.22]} />
          <meshStandardMaterial color={c.signal} emissive={c.signal} emissiveIntensity={0.4} />
        </mesh>
      </group>
      <mesh position={GEO_SAT}>
        <octahedronGeometry args={[0.28]} />
        <meshStandardMaterial color={c.brass} emissive={c.brass} emissiveIntensity={0.5} />
      </mesh>

      <Wire3D ref={gpsWire} color={c.signal} px={2} opacity={0.85} />
      <Wire3D ref={geoWire} color={c.brass} px={2} dash={0.3} opacity={0.9} />
      <mesh ref={pulse}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={c.brass} toneMapped={false} />
      </mesh>

      <Callout3D position={AIRCRAFT} tone="signal">
        LAB201 · HPL/VPL
      </Callout3D>
      <Callout3D position={[AIRCRAFT[0], AIRCRAFT[1] + vU(DEMO_VAL_M), 0]} tone="brass" side="left">
        HAL {DEMO_HAL_M} m · VAL {DEMO_VAL_M} m
      </Callout3D>
      <Callout3D position={[THRESHOLD[0], 0.02, 0]} side="left" lead={18}>
        RWY 09
      </Callout3D>
      <Callout3D position={GPS_SAT} tone="signal">
        GPS satellite
      </Callout3D>
      <Callout3D position={GEO_SAT} tone="brass" side="left">
        GEO · SBAS broadcast
      </Callout3D>
    </group>
  )
}
