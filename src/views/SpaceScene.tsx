/**
 * The Space view: the Earth to scale with its continents (Natural Earth 1:110m, and
 * 1:50m over Indonesia), the GPS constellation and the Michibiki SBAS GEOs where the
 * engine says they are, the ionosphere shell, the SBAS ground sites with an uplink beam
 * from each uplink station to its GEO, and the
 * signals LAB201 receives: a solid cyan wire from each GPS satellite it tracks and a
 * dashed brass wire from each GEO (design.md §2 "SBAS meanings"). Loaded with the 3D chunk.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { GPS_SATS, GEO_SATS, geoLabel, satEcef, GPS_RADIUS_M, GPS_PERIOD_S, type SatDef } from '@/core/orbits'
import { IONO_SHELL_HEIGHT_M } from '@/core/iono'
import { DIP_EQUATOR_TABLE, REGION, localSolarHour } from '@/core/region'
import { toThreeStyle } from '@/lib/color'
import { decodeRings, type CoastData } from './geo/coast'
import { indonesia } from './geo/indonesia.data'
import { world } from './geo/world.data'
import { DEG, WGS84_A_M, WGS84_OMEGA_E_RAD_S } from '@/core/units'
import { getJourney, useJourneyState } from '@/journey/store'
import { useReducedMotion } from '@/stores/prefs'
import { Callout3D } from '@/stage/Callout3D'
import { Wire3D, type WireHandle } from '@/stage/Wire3D'
import { col } from '@/stage/col'
import type { Quality } from '@/stage/types'
import { ecefToSpace, SAT_GLYPH_U, type V3 } from './scales'
import { aircraftSpace, focusSatId, stationsSpace } from './shots'

const earthVertex = `
  varying vec3 vDir;
  void main(){
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// Every edge width is kept above zero and every asin/atan argument is clamped (design.md §9 shader rules).
const earthFragment = `
  uniform vec3 uSun; uniform vec3 uOcean; uniform vec3 uLand; uniform vec3 uNight; uniform vec3 uLine; uniform vec3 uBrass;
  uniform float uDip[25]; uniform sampler2D uLandMask;
  varying vec3 vDir;
  // Latitude of the magnetic equator (core/region dipEquatorLatDeg): linear between 15° table points.
  float dipLat(float lonDeg){
    float l = clamp((lonDeg + 180.0) / 15.0, 0.0, 23.999);
    int i = int(floor(l));
    float f = l - float(i);
    float a = 0.0; float b = 0.0;
    for (int k = 0; k < 24; k++) { if (k == i) { a = uDip[k]; b = uDip[k + 1]; } }
    return mix(a, b, f);
  }
  void main(){
    vec3 d = normalize(vDir);
    float lat = asin(clamp(d.y, -1.0, 1.0));
    float lon = atan(-d.z, d.x);
    float day = smoothstep(-0.12, 0.3, dot(d, uSun));
    vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5);
    float land = texture2D(uLandMask, uv).a;
    vec3 surface = mix(uOcean, uLand, land);
    vec3 base = mix(uNight + uLand * land * 0.12, surface, day);
    float stepR = radians(15.0);
    float w = max(fwidth(lat), 1e-4);
    float gLat = abs(fract(lat / stepR + 0.5) - 0.5) * stepR;
    float gLon = abs(fract(lon / stepR + 0.5) - 0.5) * stepR * max(cos(lat), 0.0);
    float line = 1.0 - smoothstep(0.0, w * 1.3, min(gLat, gLon));
    float mag = 1.0 - smoothstep(0.0, w * 1.6, abs(lat - radians(dipLat(degrees(lon)))));
    vec3 c = mix(base, uLine, line * 0.28);
    c = mix(c, uBrass, mag * 0.55);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

const MAX_GPS_WIRES = 14

/**
 * The continents as an alpha mask in an equirectangular texture (longitude across,
 * latitude up), drawn once from the coastline data: the coarse world, then Indonesia in
 * more detail so Java, Bali and the smaller islands show.
 */
function landMask(t: ThemeTokens): THREE.CanvasTexture {
  const W = 2048
  const H = 1024
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  g.fillStyle = toThreeStyle(t['stage-terrain'])
  const draw = (d: CoastData) => {
    g.beginPath()
    for (const r of decodeRings(d)) {
      for (let i = 0; i < r.length; i += 2) {
        const x = ((r[i] + 180) / 360) * W
        const y = ((90 - r[i + 1]) / 180) * H
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
    }
    g.fill('evenodd')
  }
  draw(world)
  // Clear the detailed box first, so its coastline replaces the coarse one.
  const b = indonesia.box
  g.clearRect(((b.lon0 + 180) / 360) * W, ((90 - b.lat1) / 180) * H, ((b.lon1 - b.lon0) / 360) * W, ((b.lat1 - b.lat0) / 180) * H)
  draw(indonesia)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  tex.flipY = true
  return tex
}

/** The Sun's direction in space-view units: over the equator (an equinox), at the longitude where it is noon. */
function sunDir(tS: number, startHour: number): THREE.Vector3 {
  const h = localSolarHour(tS, REGION.origin.lonDeg, startHour)
  const lon = (REGION.origin.lonDeg + (12 - h) * 15) * DEG
  return new THREE.Vector3(Math.cos(lon), 0, -Math.sin(lon))
}

function useOrbitRings() {
  const geo = useMemo(() => {
    const pts: number[] = []
    const planes = new Map<string, SatDef>()
    for (const s of GPS_SATS) if (s.plane && !planes.has(s.plane)) planes.set(s.plane, s)
    for (const s of planes.values()) {
      // At t = 0 the Earth-fixed and inertial frames agree; the group then turns with the Earth.
      const n = 128
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * GPS_PERIOD_S
        const t1 = ((i + 1) / n) * GPS_PERIOD_S
        const a = inertial(s, t0)
        const b = inertial(s, t1)
        pts.push(...a, ...b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  return geo
}

/** A satellite's position in the inertial frame at orbit time t (the Earth rotation taken out). */
function inertial(s: SatDef, t: number): V3 {
  const [x, y, z] = satEcef(s, t)
  const th = WGS84_OMEGA_E_RAD_S * t
  return ecefToSpace([x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th), z])
}

export default function SpaceScene({ t, quality }: { t: ThemeTokens; quality: Quality }) {
  const engine = getJourney()
  const phase = useJourneyState(engine, (s) => s.phase)
  const reduced = useReducedMotion()
  const c = useMemo(
    () => ({
      ocean: col(t, 'stage-water'),
      land: col(t, 'stage-terrain'),
      night: col(t, 'stage-bg'),
      line: col(t, 'stage-line'),
      signal: col(t, 'stage-signal'),
      brass: col(t, 'stage-brass'),
      metal: col(t, 'stage-metal'),
      glass: col(t, 'stage-glass'),
      paint: col(t, 'stage-paint'),
      alert: col(t, 'stage-alert'),
    }),
    [t],
  )
  const mask = useMemo(() => landMask(t), [t])
  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
        uniforms: {
          uSun: { value: new THREE.Vector3(1, 0, 0) },
          uOcean: { value: c.ocean.clone().multiplyScalar(1.6) },
          uLand: { value: c.land.clone() },
          uNight: { value: c.night.clone().lerp(c.ocean, 0.35) },
          uLine: { value: c.line },
          uBrass: { value: c.brass },
          uDip: { value: [...DIP_EQUATOR_TABLE] },
          uLandMask: { value: mask },
        },
      }),
    [c, mask],
  )
  useLayoutEffect(
    () => () => {
      earthMat.dispose()
      mask.dispose()
    },
    [earthMat, mask],
  )
  const rings = useOrbitRings()
  const ringGroup = useRef<THREE.Group>(null)
  const gpsRefs = useRef<(THREE.Mesh | null)[]>([])
  const geoRefs = useRef<(THREE.Mesh | null)[]>([])
  const gpsWires = useRef<(WireHandle | null)[]>([])
  const geoWires = useRef<(WireHandle | null)[]>([])
  const uplinkWires = useRef<(WireHandle | null)[]>([])
  const pulse = useRef<THREE.Mesh>(null)
  const acRef = useRef<THREE.Group>(null)
  const focusRef = useRef<THREE.Group>(null)
  const geoLabelRefs = useRef<(THREE.Group | null)[]>([])
  const stations = useMemo(() => stationsSpace(), [])
  // Each GEO's uplink station (core/region: one GUS per GEO).
  const uplinks = useMemo(() => GEO_SATS.map((g) => stations.find((s) => s.kind === 'gus' && s.geoId === g.id)!), [stations])
  const satGeo = useMemo(() => new THREE.BoxGeometry(SAT_GLYPH_U, SAT_GLYPH_U, SAT_GLYPH_U), [])
  const panelGeo = useMemo(() => new THREE.BoxGeometry(SAT_GLYPH_U * 3.2, SAT_GLYPH_U * 0.12, SAT_GLYPH_U * 0.8), [])
  const geoGeo = useMemo(() => new THREE.OctahedronGeometry(SAT_GLYPH_U * 1.5), [])
  const matUsed = useMemo(() => new THREE.MeshBasicMaterial({ color: c.signal, toneMapped: false }), [c])
  const matIdle = useMemo(() => new THREE.MeshBasicMaterial({ color: c.metal }), [c])
  const matGeo = useMemo(() => new THREE.MeshBasicMaterial({ color: c.brass, toneMapped: false }), [c])
  useLayoutEffect(
    () => () => {
      for (const d of [satGeo, panelGeo, geoGeo, matUsed, matIdle, matGeo]) d.dispose()
    },
    [satGeo, panelGeo, geoGeo, matUsed, matIdle, matGeo],
  )

  useFrame((state) => {
    const tS = engine.worldS
    const snap = engine.snapshot()
    const phase = engine.state.phase
    const ac = aircraftSpace(engine)
    earthMat.uniforms.uSun.value.copy(sunDir(tS, engine.conditions().startLocalHour))
    if (ringGroup.current) ringGroup.current.rotation.y = -WGS84_OMEGA_E_RAD_S * tS
    acRef.current?.position.set(...ac)
    const nav = engine.sbasShown ? (snap.sbasFix ?? snap.abas) : snap.abas
    const used = new Set(nav?.used ?? [])
    const tracked = new Map(snap.sats.map((s) => [s.id, s]))
    let w = 0
    GPS_SATS.forEach((sat, i) => {
      const p = ecefToSpace(satEcef(sat, tS))
      const m = gpsRefs.current[i]
      if (m) {
        m.position.set(...p)
        m.material = used.has(sat.id) ? matUsed : matIdle
      }
      const v = tracked.get(sat.id)
      if (v?.tracked && w < MAX_GPS_WIRES) {
        const wire = gpsWires.current[w++]
        wire?.set(p, ac)
        wire?.setVisible(true)
        wire?.setOpacity(used.has(sat.id) ? 0.9 : 0.25)
      }
    })
    for (; w < MAX_GPS_WIRES; w++) gpsWires.current[w]?.setVisible(false)
    const focus = focusSatId(engine)
    const fs = GPS_SATS.find((s) => s.id === focus)
    if (fs && focusRef.current) {
      focusRef.current.position.set(...ecefToSpace(satEcef(fs, tS)))
      focusRef.current.visible = phase === 'errors'
    }
    GEO_SATS.forEach((g, i) => {
      const p = ecefToSpace(satEcef(g, tS))
      geoRefs.current[i]?.position.set(...p)
      geoLabelRefs.current[i]?.position.set(...p)
      const tr = tracked.get(g.id)?.tracked ?? false
      const wire = geoWires.current[i]
      wire?.set(p, ac)
      wire?.setVisible(tr && (engine.sbasShown || phase === 'broadcast'))
    })
    const geoA = ecefToSpace(satEcef(GEO_SATS[0], tS))
    GEO_SATS.forEach((g, i) => {
      const w = uplinkWires.current[i]
      w?.set(uplinks[i].space, ecefToSpace(satEcef(g, tS)))
      w?.setVisible(phase === 'uplink' || phase === 'broadcast')
    })
    const uplink = uplinks[0]
    // A message travelling: up to the GEO in the uplink phase, down to LAB201 in the broadcast phase.
    if (pulse.current) {
      const moving = phase === 'uplink' || phase === 'broadcast' || phase === 'errors'
      pulse.current.visible = moving && !reduced
      if (moving) {
        const f = (state.clock.elapsedTime % 2.4) / 2.4
        const from = phase === 'uplink' ? new THREE.Vector3(...uplink.space) : phase === 'errors' && fs ? new THREE.Vector3(...ecefToSpace(satEcef(fs, tS))) : new THREE.Vector3(...geoA)
        const to = phase === 'uplink' ? new THREE.Vector3(...geoA) : new THREE.Vector3(...ac)
        pulse.current.position.copy(from).lerp(to, f)
      }
    }
  })

  const shellR = 1 + IONO_SHELL_HEIGHT_M / WGS84_A_M
  const storm = engine.conditions().storm > 0
  const segs = quality === 'low' ? 48 : 96
  return (
    <group>
      <mesh material={earthMat}>
        <sphereGeometry args={[1, segs, segs / 2]} />
      </mesh>
      {/* The ionosphere: a thin glass shell 350 km up; a storm makes it more visible, never red. */}
      <mesh>
        <sphereGeometry args={[shellR, segs, segs / 2]} />
        <meshBasicMaterial color={c.glass} transparent opacity={storm ? 0.16 : 0.07} depthWrite={false} side={THREE.FrontSide} />
      </mesh>
      <group ref={ringGroup}>
        <lineSegments geometry={rings}>
          <lineBasicMaterial color={c.line} transparent opacity={0.16} depthWrite={false} />
        </lineSegments>
      </group>
      {GPS_SATS.map((s, i) => (
        <mesh key={s.id} ref={(m) => void (gpsRefs.current[i] = m)} geometry={satGeo} material={matIdle}>
          <mesh geometry={panelGeo} material={matIdle} />
        </mesh>
      ))}
      {GEO_SATS.map((g, i) => (
        <mesh key={g.id} ref={(m) => void (geoRefs.current[i] = m)} geometry={geoGeo} material={matGeo} />
      ))}
      {Array.from({ length: MAX_GPS_WIRES }, (_, i) => (
        <Wire3D key={i} ref={(h) => void (gpsWires.current[i] = h)} color={c.signal} px={1.4} opacity={0.9} />
      ))}
      {GEO_SATS.map((g, i) => (
        <Wire3D key={g.id} ref={(h) => void (geoWires.current[i] = h)} color={c.brass} px={1.6} dash={0.12} opacity={0.95} />
      ))}
      {GEO_SATS.map((g, i) => (
        <Wire3D key={`up-${g.id}`} ref={(h) => void (uplinkWires.current[i] = h)} color={c.brass} px={1.6} dash={0.12} opacity={0.95} />
      ))}
      <mesh ref={pulse} visible={false}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={c.brass} toneMapped={false} />
      </mesh>
      {stations.map((s) => (
        <mesh key={s.id} position={s.space} rotation={[0, 0, 0]}>
          {s.kind === 'rims' ? <tetrahedronGeometry args={[0.01]} /> : <boxGeometry args={[0.014, 0.014, 0.014]} />}
          <meshBasicMaterial color={c.brass} toneMapped={false} />
        </mesh>
      ))}
      <group ref={acRef}>
        <mesh>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshBasicMaterial color={c.paint} toneMapped={false} />
        </mesh>
        <Callout3D position={[0, 0, 0]} tone="signal">
          LAB201
        </Callout3D>
      </group>
      <group ref={focusRef} visible={false}>
        <Callout3D position={[0, 0, 0]} tone="signal" side="left" hidden={phase !== 'errors'}>
          Satellite {focusSatId(engine)}
        </Callout3D>
      </group>
      {GEO_SATS.map((g, i) => (
        <group key={g.id} ref={(m) => void (geoLabelRefs.current[i] = m)}>
          <Callout3D position={[0, 0, 0]} tone="brass" side={i === 0 ? 'left' : 'right'}>
            {geoLabel(g)} · SBAS
          </Callout3D>
        </group>
      ))}
      <Callout3D position={[0, shellR * 0.72, -shellR * 0.72]}>Ionosphere · 350 km</Callout3D>
      <Callout3D position={[GPS_RADIUS_M / WGS84_A_M, 0.4, 0]}>GPS orbits · 20 200 km</Callout3D>
    </group>
  )
}
