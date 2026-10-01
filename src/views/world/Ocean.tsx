/**
 * The sea at true sea level: deep blue offshore, turquoise over the shallows and a
 * line of surf at the coast (read from a small height map of the islands), small
 * waves, the sky reflected at grazing angles and the sun's glint. Wave detail fades
 * out wherever it would be smaller than a pixel, so the far sea never shimmers.
 * The plane follows the camera; everything else is computed per pixel.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { col } from '@/stage/col'
import { ISLANDS, islandHeightFt } from '../islands'
import { toFlight } from '../scales'
import type { SkyState } from './skyState'

const vertex = `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`

const fragment = `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam;
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform vec3 uSun;
  uniform float uDay; uniform float uTime;
  uniform sampler2D uDepth; uniform vec4 uRect;
  varying vec3 vWorld;

  // Slope of one wave train (the gradient of a sine), faded out well before it gets
  // near the pixel size, so distant water is smooth instead of crawling.
  vec2 waveSlope(vec2 p, vec2 dir, float lambda, float slope, float speed, float px){
    float k = 6.2831853 / lambda;
    float fade = clamp(1.6 - px / (lambda * 0.18), 0.0, 1.0);
    return dir * (slope * fade * cos(dot(p, dir) * k + uTime * speed));
  }

  void main(){
    vec2 p = vWorld.xz;
    float px = max(length(fwidth(p)), 1e-5);
    // Nine trains in uneven directions and lengths (60 m down to 4 m): no visible pattern.
    vec2 g = waveSlope(p, vec2(0.83, 0.55), 0.61, 0.045, 0.80, px)
           + waveSlope(p, vec2(-0.37, 0.93), 0.47, 0.040, 0.95, px)
           + waveSlope(p, vec2(0.97, -0.24), 0.29, 0.038, 1.20, px)
           + waveSlope(p, vec2(0.21, 0.98), 0.23, 0.034, 1.40, px)
           + waveSlope(p, vec2(-0.71, 0.70), 0.17, 0.030, 1.70, px)
           + waveSlope(p, vec2(0.58, 0.81), 0.13, 0.028, 1.90, px)
           + waveSlope(p, vec2(0.93, 0.36), 0.083, 0.026, 2.40, px)
           + waveSlope(p, vec2(-0.12, 0.99), 0.061, 0.024, 2.80, px)
           + waveSlope(p, vec2(0.44, -0.90), 0.041, 0.022, 3.30, px);
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

    // Water depth from the island height map (ft, the open sea is 80 ft deep here).
    vec2 uv = (p - uRect.xy) / uRect.zw;
    float h = -80.0 + texture2D(uDepth, clamp(uv, 0.0, 1.0)).r * 100.0;
    float shallow = clamp((h + 55.0) / 55.0, 0.0, 1.0);
    vec3 water = mix(uDeep, uShallow, shallow * shallow);
    water *= 0.18 + 0.82 * uDay;

    vec3 v = cameraPosition - vWorld;
    v /= max(length(v), 1e-5);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 r = reflect(-v, n);
    vec3 skyR = mix(uHorizon, uZenith, pow(clamp(r.y, 0.0, 1.0), 0.55));
    vec3 c = mix(water, skyR, fres * 0.85);

    // Sun glint: sharp up close, a broad glitter far away where waves are sub-pixel.
    vec3 hv = uSun + v;
    hv /= max(length(hv), 1e-5);
    float shin = mix(900.0, 60.0, clamp(px / 0.6, 0.0, 1.0));
    float above = clamp(uSun.y * 6.0, 0.0, 1.0);
    c += uSunCol * pow(clamp(dot(n, hv), 0.0, 1.0), shin) * above * (1.2 + shin / 400.0) * uDay;

    // Surf on the shoreline, only where it is wider than a pixel.
    float surf = clamp(1.0 - abs(h + 3.0) / 6.0, 0.0, 1.0) * clamp(1.0 - px / 0.5, 0.0, 1.0);
    surf *= 0.65 + 0.35 * sin(dot(p, vec2(3.1, 2.3)) * 9.0 + uTime * 0.8);
    c = mix(c, uFoam * (0.25 + 0.75 * uDay), surf * 0.75);

    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`

/** The region the height map covers, local NM. */
const REGION_NM = { e0: -60, e1: 62, n0: -26, n1: 23 }

/** A height map of the islands (0 = 80 ft deep or deeper, 0.8 = sea level, 1 = 20 ft up). */
function makeDepthTexture() {
  const W = 1536
  const H = Math.round((W * (REGION_NM.n1 - REGION_NM.n0)) / (REGION_NM.e1 - REGION_NM.e0))
  const data = new Uint8Array(W * H)
  const boxes = ISLANDS.map((i) => ({ i, e0: i.eastNm - i.rxNm * 1.25, e1: i.eastNm + i.rxNm * 1.25, n0: i.northNm - i.ryNm * 1.25, n1: i.northNm + i.ryNm * 1.25 }))
  for (let y = 0; y < H; y++) {
    // Row 0 is the south edge (texture v grows north… which is −z, flipped below).
    const n = REGION_NM.n0 + ((y + 0.5) / H) * (REGION_NM.n1 - REGION_NM.n0)
    for (let x = 0; x < W; x++) {
      const e = REGION_NM.e0 + ((x + 0.5) / W) * (REGION_NM.e1 - REGION_NM.e0)
      let h = -80
      for (const b of boxes) if (e >= b.e0 && e <= b.e1 && n >= b.n0 && n <= b.n1) h = Math.max(h, islandHeightFt(b.i, e, n))
      data[y * W + x] = Math.round(Math.min(1, Math.max(0, (h + 80) / 100)) * 255)
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

export function Ocean({ t, sky, size }: { t: ThemeTokens; sky: SkyState; size: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const depth = useMemo(makeDepthTexture, [])
  const mat = useMemo(() => {
    // World rect of the height map: x = east, z = −north (so v runs toward −z).
    const [x0, , zSouth] = toFlight(REGION_NM.e0, REGION_NM.n0, 0)
    const [x1, , zNorth] = toFlight(REGION_NM.e1, REGION_NM.n1, 0)
    return new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uDeep: { value: new THREE.Color() },
          uShallow: { value: new THREE.Color() },
          uFoam: { value: new THREE.Color() },
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uSunCol: { value: new THREE.Color() },
          uSun: { value: new THREE.Vector3(0, 1, 0) },
          uDay: { value: 1 },
          uTime: { value: 0 },
          uDepth: { value: null },
          uRect: { value: new THREE.Vector4(x0, zSouth, x1 - x0, zNorth - zSouth) },
        },
      ]),
    })
  }, [])
  useLayoutEffect(() => {
    mat.uniforms.uDepth.value = depth
    mat.uniforms.uDeep.value.copy(col(t, 'world-sea-deep'))
    mat.uniforms.uShallow.value.copy(col(t, 'world-sea-shallow'))
    mat.uniforms.uFoam.value.copy(col(t, 'world-foam'))
  }, [mat, depth, t])
  useLayoutEffect(
    () => () => {
      mat.dispose()
      depth.dispose()
    },
    [mat, depth],
  )
  useFrame(({ camera }) => {
    const u = mat.uniforms
    u.uZenith.value.copy(sky.zenith)
    u.uHorizon.value.copy(sky.horizon)
    u.uSunCol.value.copy(sky.sunColor)
    u.uSun.value.copy(sky.sun)
    u.uDay.value = sky.day
    u.uTime.value = sky.motionS
    mesh.current?.position.set(camera.position.x, 0, camera.position.z)
  })
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} material={mat} frustumCulled={false} renderOrder={-5}>
      <planeGeometry args={[size, size]} />
    </mesh>
  )
}
