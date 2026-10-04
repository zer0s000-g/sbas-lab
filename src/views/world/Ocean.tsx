/**
 * The sea at true sea level: deep blue offshore, turquoise over the shallows and a
 * line of surf at the coast (read from height maps of the terrain, built once per
 * session in world/terrainData: a coarse one along the whole route and a detailed one
 * around each airport), small
 * waves, the sky reflected at grazing angles and the sun's glint. Wave detail fades
 * out wherever it would be smaller than a pixel, so the far sea never shimmers.
 * The plane follows the camera; everything else is computed per pixel.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { col } from '@/stage/col'
import { toFlight } from '../scales'
import { CORRIDOR, TERRAIN_PATCHES, seaCorridor, seaPatch, type NmRect, type SeaMap } from './terrainData'
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
  uniform sampler2D uDepthA; uniform vec4 uRectA;
  uniform sampler2D uDepthB; uniform vec4 uRectB;

  // Height map value at a point: the detailed map around an airport where there is one.
  float depthAt(vec2 p){
    vec2 a = (p - uRectA.xy) / uRectA.zw;
    if (all(greaterThan(a, vec2(0.0))) && all(lessThan(a, vec2(1.0)))) return texture2D(uDepthA, a).r;
    vec2 b = (p - uRectB.xy) / uRectB.zw;
    if (all(greaterThan(b, vec2(0.0))) && all(lessThan(b, vec2(1.0)))) return texture2D(uDepthB, b).r;
    return texture2D(uDepth, clamp((p - uRect.xy) / uRect.zw, 0.0, 1.0)).r;
  }
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

    // Water depth from the height maps (ft; deeper than 80 ft all looks like open sea).
    float h = -80.0 + depthAt(p) * 100.0;
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

/** A texture for one of the session's height maps (0 = 80 ft deep or deeper, 0.8 = sea level, 1 = 20 ft up). */
function depthTexture(m: SeaMap) {
  // Row 0 is the south edge (texture v grows north… which is −z, flipped below).
  const tex = new THREE.DataTexture(m.data, m.width, m.height, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

/** World rect of a height map: x = east, z = −north (so v runs toward −z). */
function worldRect(r: NmRect, out: THREE.Vector4) {
  const [x0, , zSouth] = toFlight(r.e0, r.n0, 0)
  const [x1, , zNorth] = toFlight(r.e1, r.n1, 0)
  return out.set(x0, zSouth, x1 - x0, zNorth - zSouth)
}

/** Where an airport's detailed map is not built yet: a rect no point of the sea is in. */
const NOWHERE = new THREE.Vector4(1e9, 1e9, 1, 1)

export function Ocean({ t, sky, size, airports }: { t: ThemeTokens; sky: SkyState; size: number; airports: readonly string[] }) {
  const mesh = useRef<THREE.Mesh>(null)
  // Textures over the session's height maps, made for this visit and freed when it ends.
  const corridor = useMemo(() => depthTexture(seaCorridor()), [])
  const hasA = airports.includes(TERRAIN_PATCHES[0].id)
  const hasB = airports.includes(TERRAIN_PATCHES[1].id)
  const patchA = useMemo(() => (hasA ? depthTexture(seaPatch(TERRAIN_PATCHES[0].id)) : null), [hasA])
  const patchB = useMemo(() => (hasB ? depthTexture(seaPatch(TERRAIN_PATCHES[1].id)) : null), [hasB])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
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
            uRect: { value: worldRect(CORRIDOR, new THREE.Vector4()) },
            uDepthA: { value: null },
            uRectA: { value: NOWHERE.clone() },
            uDepthB: { value: null },
            uRectB: { value: NOWHERE.clone() },
          },
        ]),
      }),
    [],
  )
  useLayoutEffect(() => {
    const u = mat.uniforms
    u.uDepth.value = corridor
    u.uDepthA.value = patchA
    u.uDepthB.value = patchB
    if (patchA) worldRect(TERRAIN_PATCHES[0], u.uRectA.value)
    else u.uRectA.value.copy(NOWHERE)
    if (patchB) worldRect(TERRAIN_PATCHES[1], u.uRectB.value)
    else u.uRectB.value.copy(NOWHERE)
  }, [mat, corridor, patchA, patchB])
  const seaKey = [t['world-sea-deep'], t['world-sea-shallow'], t['world-foam']].join('|')
  useLayoutEffect(() => {
    mat.uniforms.uDeep.value.copy(col(t, 'world-sea-deep'))
    mat.uniforms.uShallow.value.copy(col(t, 'world-sea-shallow'))
    mat.uniforms.uFoam.value.copy(col(t, 'world-foam'))
    // Keyed on the token values, not the tokens object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mat, seaKey])
  useLayoutEffect(() => () => mat.dispose(), [mat])
  useLayoutEffect(() => () => corridor.dispose(), [corridor])
  useLayoutEffect(() => () => patchA?.dispose(), [patchA])
  useLayoutEffect(() => () => patchB?.dispose(), [patchB])
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
