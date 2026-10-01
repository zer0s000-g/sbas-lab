/**
 * The sky: a dome around the camera, deep blue overhead fading to the hazy horizon,
 * with the sun disc and, when the sun is low, a warm glow on its side. Its horizon
 * colour is the fog colour, so the sea and distant islands fade into it seamlessly.
 */
import { useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SkyState } from './skyState'

const vertex = `
  varying vec3 vDir;
  void main(){
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p;
  }`

const fragment = `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uDusk; uniform vec3 uSunCol; uniform vec3 uSun;
  uniform float uDuskK; uniform float uDay;
  varying vec3 vDir;
  void main(){
    vec3 d = vDir / max(length(vDir), 1e-4);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(up, 0.55));
    float s = dot(d, uSun);
    float toward = clamp(s, 0.0, 1.0);
    // Sunrise and sunset: a warm band on the sun's side of the horizon.
    float band = pow(1.0 - up, 6.0) * pow(toward, 3.0) * uDuskK;
    c = mix(c, uDusk, clamp(band, 0.0, 1.0));
    // Sun: a soft halo and a disc (only above the horizon).
    float above = clamp(uSun.y * 8.0 + 0.5, 0.0, 1.0);
    c += uSunCol * (pow(toward, 64.0) * 0.35 + pow(toward, 900.0) * 0.6) * above * max(uDay, 0.25);
    c += uSunCol * clamp((s - 0.99965) / 0.00015, 0.0, 1.0) * 3.0 * above;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export function Sky({ sky, radius }: { sky: SkyState; radius: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uDusk: { value: new THREE.Color() },
          uSunCol: { value: new THREE.Color() },
          uSun: { value: new THREE.Vector3(0, 1, 0) },
          uDuskK: { value: 0 },
          uDay: { value: 1 },
        },
      }),
    [],
  )
  useLayoutEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    const u = mat.uniforms
    u.uZenith.value.copy(sky.zenith)
    u.uHorizon.value.copy(sky.horizon)
    u.uDusk.value.copy(sky.sunColor).lerp(sky.horizon, 0.2)
    u.uSunCol.value.copy(sky.sunColor)
    u.uSun.value.copy(sky.sun)
    u.uDuskK.value = sky.dusk
    u.uDay.value = sky.day
  })
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 48, 24), [radius])
  useLayoutEffect(() => () => geo.dispose(), [geo])
  // The dome rides with the camera (moved just before it is drawn), so it is always the far backdrop.
  const follow = (m: THREE.Mesh | null) => {
    if (!m) return
    m.onBeforeRender = (_r, _s, camera) => {
      m.position.copy(camera.position)
      m.updateMatrixWorld()
    }
  }
  return <mesh ref={follow} geometry={geo} material={mat} renderOrder={-10} frustumCulled={false} />
}
