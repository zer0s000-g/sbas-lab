/**
 * The Flight view: LAB201 at true scale over the made-up archipelago, inside its
 * protection-level cylinder (glass, cyan) and the alert-limit wireframe (brass) of the
 * current operation. Signal rays point the true way to every satellite it tracks: solid
 * cyan for GPS, dashed brass for the SBAS GEOs. Truth is a cross, GPS alone a hollow
 * ring and SBAS a filled dot, their offsets drawn ×10. Loaded with the 3D chunk.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { DEPARTURE, DESTINATION, type Airport } from '@/core/region'
import { DEG, M_PER_FT } from '@/core/units'
import { operationFor } from '@/core/operations'
import { navStatus, approachMode } from '@/core/sbasWorld'
import { directionFor } from '@/journey/director'
import { getJourney, useJourneyState } from '@/journey/store'
import { Callout3D } from '@/stage/Callout3D'
import { PenPlot } from '@/stage/PenPlot'
import { Wire3D, type WireHandle } from '@/stage/Wire3D'
import { col } from '@/stage/col'
import type { Quality } from '@/stage/types'
import { ERROR_MARKER_SCALE, mToFlight, SKY_DOME_U, toFlight } from './scales'
import { aircraftFlight } from './shots'
import { ISLANDS, islandHeightFt, type Island } from './islands'

const MAX_RAYS = 14

function IslandMesh({ isl, t, segs }: { isl: Island; t: ThemeTokens; segs: number }) {
  const geo = useMemo(() => {
    const wNm = isl.rxNm * 2.4
    const hNm = isl.ryNm * 2.4
    const g = new THREE.PlaneGeometry(1, 1, segs, segs)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const e = isl.eastNm + pos.getX(i) * wNm
      const n = isl.northNm - pos.getZ(i) * hNm
      const [x, y, z] = toFlight(e, n, Math.max(islandHeightFt(isl, e, n), -60))
      pos.setXYZ(i, x, y, z)
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3))
    return g
  }, [isl, segs])
  useLayoutEffect(() => {
    const low = col(t, 'stage-terrain')
    const high = col(t, 'stage-terrain-high')
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const colr = geo.getAttribute('color') as THREE.BufferAttribute
    const top = (isl.peakFt * M_PER_FT) / 100
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, Math.max(0, pos.getY(i) / Math.max(top, 1e-3)))
      tmp.copy(low).lerp(high, Math.pow(k, 0.8))
      colr.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    colr.needsUpdate = true
  }, [geo, t, isl.peakFt])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  )
}

function Runway({ a, c, approachLights }: { a: Airport; c: Record<string, THREE.Color>; approachLights: boolean }) {
  const lenU = mToFlight(a.runwayLengthM)
  const wU = mToFlight(45)
  const thr = toFlight(a.thresholdEastNm, a.thresholdNorthNm, a.elevationFt)
  const y = thr[1] + 0.02
  const lamp = (x: number, z: number, color: THREE.Color, key: string) => (
    <mesh key={key} position={[x, y + 0.01, z]}>
      <sphereGeometry args={[0.03, 6, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
  return (
    <group>
      <mesh position={[thr[0] + lenU / 2, y, thr[2]]}>
        <boxGeometry args={[lenU, 0.02, wU]} />
        <meshStandardMaterial color={c.metal} roughness={0.8} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => lamp(thr[0], thr[2] + (i - 2) * (wU / 4), c.green, `g${i}`))}
      {Array.from({ length: 5 }, (_, i) => lamp(thr[0] + lenU, thr[2] + (i - 2) * (wU / 4), c.red, `r${i}`))}
      {approachLights && Array.from({ length: 9 }, (_, i) => lamp(thr[0] - 0.3 - i * 0.3, thr[2], c.white, `w${i}`))}
    </group>
  )
}

/** A simple airliner at true scale: 37 m long, 35 m span. */
function Airliner({ c }: { c: Record<string, THREE.Color> }) {
  return (
    <group>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.018, 0.37, 12]} />
        <meshStandardMaterial color={c.paint} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0.02, -0.005, 0]}>
        <boxGeometry args={[0.06, 0.006, 0.35]} />
        <meshStandardMaterial color={c.paint} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[-0.16, 0.004, 0]}>
        <boxGeometry args={[0.035, 0.004, 0.13]} />
        <meshStandardMaterial color={c.paint} roughness={0.4} />
      </mesh>
      <mesh position={[-0.16, 0.035, 0]}>
        <boxGeometry args={[0.045, 0.06, 0.004]} />
        <meshStandardMaterial color={c.paint} roughness={0.4} />
      </mesh>
      {/* Navigation lights: red left, green right (real lamp colours). */}
      <mesh position={[0.02, 0, -0.175]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshBasicMaterial color={c.red} toneMapped={false} />
      </mesh>
      <mesh position={[0.02, 0, 0.175]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshBasicMaterial color={c.green} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** A wire cylinder: two rims and eight verticals (the alert limit). Unit size, scaled per frame. */
function useUnitWireCylinder() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const n = 64
    for (const y of [-1, 1])
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2
        const a1 = ((i + 1) / n) * Math.PI * 2
        pts.push(Math.cos(a0), y, Math.sin(a0), Math.cos(a1), y, Math.sin(a1))
      }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      pts.push(Math.cos(a), -1, Math.sin(a), Math.cos(a), 1, Math.sin(a))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return geo
}

export default function FlightScene({ t, quality }: { t: ThemeTokens; quality: Quality }) {
  const engine = getJourney()
  const phase = useJourneyState(engine, (s) => s.phase)
  const c = useMemo(
    () => ({
      water: col(t, 'stage-water'),
      metal: col(t, 'stage-metal'),
      paint: col(t, 'stage-paint'),
      signal: col(t, 'stage-signal'),
      brass: col(t, 'stage-brass'),
      muted: col(t, 'stage-line'),
      green: col(t, 'lamp-green'),
      red: col(t, 'lamp-red'),
      white: col(t, 'lamp-white'),
    }),
    [t],
  )
  const wireCyl = useUnitWireCylinder()
  const acGroup = useRef<THREE.Group>(null)
  const plane = useRef<THREE.Group>(null)
  const pl = useRef<THREE.Mesh>(null)
  const al = useRef<THREE.LineSegments>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const abasMark = useRef<THREE.Mesh>(null)
  const sbasMark = useRef<THREE.Mesh>(null)
  const rays = useRef<(WireHandle | null)[]>([])
  const geoRays = useRef<(WireHandle | null)[]>([])
  const geoTips = useRef<(THREE.Group | null)[]>([])
  const alLabel = useRef<THREE.Group>(null)
  const op = operationFor(directionFor(phase).stage)

  useFrame((state) => {
    const a = engine.aircraft
    const ac = aircraftFlight(engine)
    const snap = engine.snapshot()
    acGroup.current?.position.set(...ac)
    if (plane.current) {
      plane.current.rotation.set(0, -(a.headingDeg - 90) * DEG, 0)
      // Nose up in the climb, down on the descent.
      const pitch = Math.atan2((a.vsFpm * M_PER_FT) / 60, Math.max((a.gsKt * 1852) / 3600, 1))
      plane.current.rotateZ(pitch)
    }
    // The fix the story shows: GPS alone until the first correction, then SBAS.
    const stage = directionFor(engine.state.phase).stage
    const op = operationFor(stage)
    let fix = snap.abas
    if (engine.sbasShown) fix = stage === 'final' ? approachMode(snap).fix : op ? navStatus(snap, op).fix : (snap.sbasFix ?? snap.abas)
    if (pl.current) {
      pl.current.visible = !!fix && Number.isFinite(fix.hplM)
      if (fix && Number.isFinite(fix.hplM)) {
        const r = Math.max(mToFlight(fix.hplM), 1e-3)
        const h = fix.vplM !== null ? Math.max(mToFlight(fix.vplM), 1e-3) : 0.002
        pl.current.scale.set(r, h, r)
      }
    }
    if (al.current) {
      al.current.visible = !!op
      if (op) {
        const r = mToFlight(op.halM)
        al.current.scale.set(r, op.valM !== null ? mToFlight(op.valM) : 0.002, r)
      }
    }
    if (alLabel.current && op) alLabel.current.position.set(mToFlight(op.halM), op.valM !== null ? mToFlight(op.valM) : 0, 0)
    // A glow on the aircraft so it can be found when the camera is far out (en route).
    if (beacon.current) {
      const d = state.camera.position.distanceTo(new THREE.Vector3(...ac))
      beacon.current.scale.setScalar(Math.max(d / 140, 0.02))
    }
    const place = (m: THREE.Mesh | null, f: typeof fix, show: boolean) => {
      if (!m) return
      m.visible = show && !!f
      if (f) m.position.set(mToFlight(f.errorEnu[0]) * ERROR_MARKER_SCALE, mToFlight(f.errorEnu[2]) * ERROR_MARKER_SCALE, -mToFlight(f.errorEnu[1]) * ERROR_MARKER_SCALE)
    }
    place(abasMark.current, snap.abas, true)
    place(sbasMark.current, snap.sbasFix, engine.sbasShown)
    // Signal rays toward the satellites (true directions).
    const used = new Set(fix?.used ?? [])
    let k = 0
    let g = 0
    for (const s of snap.sats) {
      if (!s.tracked) continue
      const el = s.elDeg * DEG
      const az = s.azDeg * DEG
      const dir: [number, number, number] = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
      const end: [number, number, number] = [ac[0] + dir[0] * SKY_DOME_U, ac[1] + dir[1] * SKY_DOME_U, ac[2] + dir[2] * SKY_DOME_U]
      if (s.kind === 'geo') {
        const w = geoRays.current[g]
        w?.set(ac, end)
        w?.setVisible(true)
        geoTips.current[g]?.position.set(...end)
        g++
      } else if (k < MAX_RAYS) {
        const w = rays.current[k++]
        w?.set(ac, end)
        w?.setVisible(true)
        w?.setOpacity(used.has(s.id) ? 0.75 : 0.2)
      }
    }
    for (; k < MAX_RAYS; k++) rays.current[k]?.setVisible(false)
    for (; g < 2; g++) {
      geoRays.current[g]?.setVisible(false)
      geoTips.current[g]?.position.set(0, -1e4, 0)
    }
  })

  const segs = quality === 'low' ? 48 : 84
  return (
    <group>
      {/* The sea. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color={c.water} roughness={0.75} metalness={0} />
      </mesh>
      <PenPlot color={c.signal} durationS={2.4}>
        {ISLANDS.map((isl) => (
          <IslandMesh key={isl.id} isl={isl} t={t} segs={isl.airport ? segs : Math.round(segs / 2)} />
        ))}
      </PenPlot>
      <Runway a={DEPARTURE} c={c} approachLights={false} />
      <Runway a={DESTINATION} c={c} approachLights />
      <group ref={acGroup}>
        <group ref={plane}>
          <Airliner c={c} />
        </group>
        <mesh ref={beacon}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color={c.signal} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={pl}>
          <cylinderGeometry args={[1, 1, 2, 48, 1, true]} />
          <meshBasicMaterial color={c.signal} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <lineSegments ref={al} geometry={wireCyl}>
          <lineBasicMaterial color={c.brass} transparent opacity={0.95} toneMapped={false} />
        </lineSegments>
        {/* Truth: a small cross at the aircraft. */}
        <mesh>
          <boxGeometry args={[0.12, 0.006, 0.006]} />
          <meshBasicMaterial color={c.paint} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.006, 0.006, 0.12]} />
          <meshBasicMaterial color={c.paint} toneMapped={false} />
        </mesh>
        {/* GPS alone: a hollow ring; SBAS: a filled dot. */}
        <mesh ref={abasMark} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[0.05, 0.008, 6, 24]} />
          <meshBasicMaterial color={c.muted} toneMapped={false} />
        </mesh>
        <mesh ref={sbasMark}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color={c.signal} toneMapped={false} />
        </mesh>
        <Callout3D position={[0, 0.06, 0]} tone="signal">
          LAB201 · HPL/VPL
        </Callout3D>
        {op && (
          <group ref={alLabel}>
            <Callout3D position={[0, 0, 0]} tone="brass" side="right">
              HAL {op.halM >= 1000 ? `${(op.halM / 1000).toFixed(1)} km` : `${Math.round(op.halM)} m`}
              {op.valM !== null ? ` · VAL ${op.valM} m` : ''}
            </Callout3D>
          </group>
        )}
      </group>
      {Array.from({ length: MAX_RAYS }, (_, i) => (
        <Wire3D key={i} ref={(h) => void (rays.current[i] = h)} color={c.signal} px={1.2} opacity={0.7} />
      ))}
      {[0, 1].map((i) => (
        <group key={i}>
          <Wire3D ref={(h) => void (geoRays.current[i] = h)} color={c.brass} px={1.6} dash={1.5} opacity={0.95} />
          <group ref={(m) => void (geoTips.current[i] = m)} position={[0, -1e4, 0]}>
            <mesh>
              <octahedronGeometry args={[0.8]} />
              <meshBasicMaterial color={c.brass} toneMapped={false} />
            </mesh>
            <Callout3D position={[0, 0, 0]} tone="brass" side={i === 0 ? 'left' : 'right'}>
              {i === 0 ? 'GEO-A' : 'GEO-B'} · SBAS
            </Callout3D>
          </group>
        </group>
      ))}
      <Callout3D position={toFlight(DESTINATION.thresholdEastNm, DESTINATION.thresholdNorthNm, DESTINATION.elevationFt)} side="left">
        RWY {DESTINATION.runway} · {DESTINATION.name}
      </Callout3D>
      <Callout3D position={toFlight(DEPARTURE.thresholdEastNm, DEPARTURE.thresholdNorthNm, DEPARTURE.elevationFt)} side="left">
        {DEPARTURE.name}
      </Callout3D>
    </group>
  )
}
