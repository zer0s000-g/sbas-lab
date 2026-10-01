/**
 * The Flight view: LAB201 at true scale in a real-looking world, at the journey's local
 * time of day: the sky and sun, the sea with its shallows and surf, Java, Madura and Bali
 * with their coastline, plains and volcanoes, both airports with their runways,
 * taxiways, terminals and lights, and fair-weather clouds. Around the aircraft: its
 * protection-level cylinder (glass, cyan) and the alert-limit wireframe (brass) of the
 * current operation. Signal rays point the true way to every satellite it tracks: solid
 * cyan for GPS, dashed brass for the SBAS GEOs. Truth is a cross, GPS alone a hollow
 * ring and SBAS a filled dot, their offsets drawn ×10. Loaded with the 3D chunk.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { DEPARTURE, DESTINATION, nearestAirport } from '@/core/region'
import { GEO_SATS, geoLabel } from '@/core/orbits'
import { DEG, M_PER_FT } from '@/core/units'
import { operationFor } from '@/core/operations'
import { navStatus, approachMode } from '@/core/sbasWorld'
import { directionFor } from '@/journey/director'
import { getJourney, useJourneyState } from '@/journey/store'
import { useReducedMotion } from '@/stores/prefs'
import { Callout3D } from '@/stage/Callout3D'
import { Wire3D, type WireHandle } from '@/stage/Wire3D'
import { col } from '@/stage/col'
import type { Quality } from '@/stage/types'
import { BALI, JAKARTA } from './airports'
import { ERROR_MARKER_SCALE, mToFlight, SKY_DOME_U } from './scales'
import { aircraftFlight } from './shots'
import { AirportModel } from './world/AirportModel'
import { Airliner, type AirlinerHandle } from './world/Airliner'
import { Clouds } from './world/Clouds'
import { GroundShadow } from './world/GroundShadow'
import { Ocean } from './world/Ocean'
import { Sky } from './world/Sky'
import { Terrain } from './world/Terrain'
import { newSkyState, raToWorld, skyPalette, updateSky } from './world/skyState'

const MAX_RAYS = 14
/** Camera far plane in this view (shots.ts), scene units: the sky dome sits just inside it. */
const FAR_U = 3500

/** A wire cylinder: two rims and eight verticals (the alert limit). Unit size, scaled per frame. */
function useUnitWireCylinder() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const n = 96
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
  const reduced = useReducedMotion()
  const c = useMemo(
    () => ({
      paint: col(t, 'stage-paint'),
      signal: col(t, 'stage-signal'),
      brass: col(t, 'stage-brass'),
      muted: col(t, 'stage-line'),
      groundTint: col(t, 'world-grass').lerp(col(t, 'world-sea-deep'), 0.5),
      night: col(t, 'world-sky-night-horizon').lerp(col(t, 'world-sky-horizon'), 0.35),
    }),
    [t],
  )
  const palette = useMemo(() => skyPalette(t), [t])
  const sky = useMemo(newSkyState, [])
  const night = useMemo(() => ({ value: 0 }), [])
  const lab201 = useMemo<AirlinerHandle>(() => ({ gear: true, landing: false, beacon: true }), [])
  const lastTick = useRef(-1)

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
  const fog = useRef<THREE.Fog>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sunTarget = useMemo(() => new THREE.Object3D(), [])
  const op = operationFor(directionFor(phase).stage)

  // The sky first, so everything drawn this frame sees the same time of day.
  useFrame((_s, dt) => {
    updateSky(sky, palette, engine.worldS, engine.conditions().startLocalHour)
    // Waves and blinking lights move only while the world does.
    if (engine.tick !== lastTick.current && !reduced) sky.motionS += Math.min(dt, 0.1)
    lastTick.current = engine.tick
    night.value = 1 - sky.day
    const ac = aircraftFlight(engine)
    if (fog.current) {
      // The air is clearer from above: the haze reaches further the higher the aircraft (FL330: about 250 km).
      fog.current.color.copy(sky.horizon)
      fog.current.near = 40 + Math.max(0, ac[1]) * 4
      fog.current.far = 750 + Math.max(0, ac[1]) * 17
    }
    sunTarget.position.set(...ac)
    sunTarget.updateMatrixWorld()
    if (sun.current) {
      sun.current.position.set(ac[0] + sky.sun.x * 50, ac[1] + sky.sun.y * 50, ac[2] + sky.sun.z * 50)
      sun.current.color.copy(sky.sunColor)
      sun.current.intensity = 2.6 * sky.day * Math.min(1, Math.max(0, sky.sun.y * 4))
    }
    if (hemi.current) {
      // Daylight from the sky; at night a dim, cool moonlight-level fill so the land stays readable.
      hemi.current.color.copy(c.night).lerp(sky.zenith.clone().lerp(sky.horizon, 0.5), sky.day)
      hemi.current.groundColor.copy(c.groundTint)
      hemi.current.intensity = 0.5 + 0.75 * sky.day
    }
  }, -1)

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
    const fieldFt = nearestAirport(a.eastNm, a.northNm).elevationFt
    const agl = a.altFt - fieldFt
    lab201.gear = a.onGround || agl < (a.vsFpm < 0 ? 2500 : 400)
    lab201.landing = a.altFt < 10000 && (!a.onGround || a.gsKt > 30)
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
    // A glow on the aircraft so it can be found when the camera is far out.
    if (beacon.current) {
      const d = state.camera.position.distanceTo(new THREE.Vector3(...ac))
      beacon.current.visible = d > 12
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
    const geoSeen = new Set<number>()
    for (const s of snap.sats) {
      if (!s.tracked) continue
      const el = s.elDeg * DEG
      const az = s.azDeg * DEG
      const dir: [number, number, number] = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
      const end: [number, number, number] = [ac[0] + dir[0] * SKY_DOME_U, ac[1] + dir[1] * SKY_DOME_U, ac[2] + dir[2] * SKY_DOME_U]
      if (s.kind === 'geo') {
        // Each GEO keeps its own ray and label.
        const g = GEO_SATS.findIndex((x) => x.id === s.id)
        const w = geoRays.current[g]
        w?.set(ac, end)
        w?.setVisible(true)
        geoTips.current[g]?.position.set(...end)
        geoSeen.add(g)
      } else if (k < MAX_RAYS) {
        const w = rays.current[k++]
        w?.set(ac, end)
        w?.setVisible(true)
        w?.setOpacity(used.has(s.id) ? 0.8 : 0.25)
      }
    }
    for (; k < MAX_RAYS; k++) rays.current[k]?.setVisible(false)
    for (let g = 0; g < GEO_SATS.length; g++) {
      if (geoSeen.has(g)) continue
      geoRays.current[g]?.setVisible(false)
      geoTips.current[g]?.position.set(0, -1e4, 0)
    }
  })

  const blink = !reduced
  const arrThr = raToWorld(BALI, 0, 0, 0)
  const depThr = raToWorld(JAKARTA, 0, 0, 0)
  return (
    <group>
      <fog ref={fog} attach="fog" args={[sky.horizon, 40, 750]} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} target={sunTarget} />
      <primitive object={sunTarget} />
      <Sky sky={sky} radius={FAR_U * 0.86} />
      <Ocean t={t} sky={sky} size={FAR_U * 2.2} />
      <Terrain t={t} lowDetail={quality === 'low'} />
      <AirportModel l={JAKARTA} t={t} sky={sky} engine={engine} blink={blink} />
      <AirportModel l={BALI} t={t} sky={sky} engine={engine} blink={blink} />
      <Clouds t={t} sky={sky} />
      <GroundShadow t={t} sky={sky} engine={engine} />
      <group ref={acGroup}>
        <group ref={plane}>
          <Airliner t={t} state={lab201} blink={blink} night={night} />
        </group>
        <mesh ref={beacon}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color={c.signal} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={pl} renderOrder={9}>
          <cylinderGeometry args={[1, 1, 2, 64, 1, true]} />
          <meshBasicMaterial color={c.signal} transparent opacity={0.24} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <lineSegments ref={al} geometry={wireCyl} renderOrder={9}>
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
        <Callout3D position={[0, 0.12, 0]} tone="signal">
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
        <Wire3D key={i} ref={(h) => void (rays.current[i] = h)} color={c.signal} px={1.4} opacity={0.8} />
      ))}
      {GEO_SATS.map((geo, i) => (
        <group key={geo.id}>
          <Wire3D ref={(h) => void (geoRays.current[i] = h)} color={c.brass} px={1.8} dash={1.5} opacity={0.95} />
          <group ref={(m) => void (geoTips.current[i] = m)} position={[0, -1e4, 0]}>
            <mesh>
              <octahedronGeometry args={[0.8]} />
              <meshBasicMaterial color={c.brass} toneMapped={false} />
            </mesh>
            <Callout3D position={[0, 0, 0]} tone="brass" side={i === 0 ? 'left' : 'right'}>
              {geoLabel(geo)} · SBAS
            </Callout3D>
          </group>
        </group>
      ))}
      <Callout3D position={arrThr} side="left">
        RWY {DESTINATION.runway} · {DESTINATION.city} {DESTINATION.id}
      </Callout3D>
      <Callout3D position={depThr} side="left">
        RWY {DEPARTURE.runway} · {DEPARTURE.city} {DEPARTURE.id}
      </Callout3D>
    </group>
  )
}
