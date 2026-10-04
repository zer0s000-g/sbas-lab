/**
 * Fair-weather tropical cumulus along the route: soft puffs from about 2 800 ft (higher
 * over the hills, so they sit on the volcano flanks rather than inside them), placed at
 * random for the scene, not a weather forecast, and kept clear of both airports and the
 * final approach. LAB201
 * cruises above them. One draw call: camera-facing puffs from an instanced quad. Puffs
 * fade out close to the camera so the view never whites out when it passes through one.
 */
import { useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { hash2 } from '@/core/random'
import { AIRPORT_LIST, DESTINATION, localNmToRunway } from '@/core/region'
import { M_PER_NM } from '@/core/units'
import { terrainFtAt } from '../terrain'
import { col } from '@/stage/col'
import { toFlight } from '../scales'
import type { SkyState } from './skyState'

const vertex = `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec3 iPos; attribute float iSize; attribute float iSeed;
  varying vec2 vUv; varying float vNear; varying float vSeed;
  void main(){
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 w = iPos + (right * position.x + up * position.y * 0.62) * iSize;
    vec4 mvPosition = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv; vSeed = iSeed;
    float d = length(w - cameraPosition);
    vNear = clamp((d - 1.5) / 4.0, 0.0, 1.0);
    #include <fog_vertex>
  }`

const fragment = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uLit; uniform vec3 uShade; uniform float uDay;
  varying vec2 vUv; varying float vNear; varying float vSeed;
  void main(){
    vec2 q = vUv * 2.0 - 1.0;
    // A lumpy puff: a disc with a few bumps on its edge, flat at the base.
    float ang = atan(q.y, abs(q.x) < 1e-4 ? 1e-4 : q.x);
    float edge = 0.78 + 0.12 * sin(ang * 3.0 + vSeed * 6.0) + 0.07 * sin(ang * 7.0 + vSeed * 13.0);
    float r = length(q) / max(edge, 0.2);
    float a = clamp((1.0 - r) / 0.35, 0.0, 1.0);
    a *= clamp((q.y + 0.75) / 0.25, 0.0, 1.0);
    a *= vNear * 0.9;
    if (a < 0.01) discard;
    vec3 c = mix(uShade, uLit, clamp(vUv.y * 1.1, 0.0, 1.0)) * (0.22 + 0.78 * uDay);
    gl_FragColor = vec4(c, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`

/** Puff centres (scene units), sizes and seeds: clusters on a jittered 9 NM grid along the route. */
function cloudField() {
  const pos: number[] = []
  const size: number[] = []
  const seed: number[] = []
  for (let gx = -33; gx <= 33; gx++)
    for (let gy = -13; gy <= 13; gy++) {
      if (hash2(gx, gy, 301) > 0.5) continue
      const ce = gx * 9 + (hash2(gx, gy, 302) - 0.5) * 7
      const cn = gy * 9 + (hash2(gx, gy, 303) - 0.5) * 7
      if (AIRPORT_LIST.some((a) => Math.hypot(ce - a.thresholdEastNm, cn - a.thresholdNorthNm) < 11)) continue
      // Not on the final approach course into the destination (22 NM out, 4 NM either side).
      const [along, right] = localNmToRunway(DESTINATION, ce, cn)
      if (along > -22 * M_PER_NM && along < 0 && Math.abs(right) < 4 * M_PER_NM) continue
      const n = 5 + Math.floor(hash2(gx, gy, 304) * 6)
      const base = Math.max(2800 + hash2(gx, gy, 305) * 600, terrainFtAt(ce, cn) + 1500)
      for (let k = 0; k < n; k++) {
        const e = ce + (hash2(gx * 31 + k, gy, 306) - 0.5) * 1.6
        const nn = cn + (hash2(gx, gy * 31 + k, 307) - 0.5) * 1.1
        const s = 3 + hash2(gx + k, gy - k, 308) * 4.5
        const [x, y, z] = toFlight(e, nn, base + s * 120 + hash2(k, gx + gy, 309) * 500)
        pos.push(x, y, z)
        size.push(s)
        seed.push(hash2(gx * 7 + k, gy * 5, 310))
      }
    }
  return { pos, size, seed }
}

export function Clouds({ t, sky }: { t: ThemeTokens; sky: SkyState }) {
  const { mesh, mat, geo } = useMemo(() => {
    const f = cloudField()
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.getAttribute('position'))
    geo.setAttribute('uv', base.getAttribute('uv'))
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(f.pos), 3))
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(new Float32Array(f.size), 1))
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(new Float32Array(f.seed), 1))
    geo.instanceCount = f.size.length
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      fog: true,
      transparent: true,
      depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uDay: { value: 1 } }]),
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 8
    return { mesh, mat, geo }
  }, [])
  useLayoutEffect(() => {
    mat.uniforms.uLit.value.copy(col(t, 'world-cloud'))
    mat.uniforms.uShade.value.copy(col(t, 'world-cloud-shade'))
  }, [mat, t])
  useLayoutEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame(() => {
    mat.uniforms.uDay.value = sky.day
  })
  return <primitive object={mesh} />
}
