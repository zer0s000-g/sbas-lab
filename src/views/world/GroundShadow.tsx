/**
 * LAB201's shadow on the ground: the airliner's top-view silhouette, cast along the
 * sun's direction onto the runway, the land or the sea, fading as the aircraft climbs
 * away and with the daylight. A flat mask, so it is cheap and never flickers.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { DEG, M_PER_FT } from '@/core/units'
import type { JourneyEngine } from '@/journey/engine'
import { col } from '@/stage/col'
import { terrainFtAt } from '../islands'
import { FLIGHT_UNIT_M } from '../scales'
import { aircraftFlight } from '../shots'
import type { SkyState } from './skyState'

const SPAN_M = 40
const inQuad = (x: number, y: number, q: [number, number][]) => {
  let s = 0
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i]
    const [bx, by] = q[(i + 1) % 4]
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (c !== 0) {
      if (s === 0) s = Math.sign(c)
      else if (Math.sign(c) !== s) return false
    }
  }
  return true
}

/** Top-view silhouette (alpha), x along the fuselage, y across, 40 m square. */
function silhouette() {
  const n = 128
  const data = new Uint8Array(n * n * 4)
  const wing: [number, number][] = [
    [3.6, 0.9],
    [-4.6, 17.8],
    [-6.2, 17.8],
    [-2.8, 0.9],
  ]
  const stab: [number, number][] = [
    [-14.2, 0.4],
    [-17.6, 6.5],
    [-18.8, 6.5],
    [-18.4, 0.4],
  ]
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let hit = 0
      for (let sj = 0; sj < 2; sj++)
        for (let si = 0; si < 2; si++) {
          const x = ((i + 0.25 + si * 0.5) / n - 0.5) * SPAN_M
          const y = Math.abs(((j + 0.25 + sj * 0.5) / n - 0.5) * SPAN_M)
          const fuse = x > -19 && x < 18.6 && y < 1.98 * Math.min(1, (18.6 - x) / 4, (x + 19) / 8)
          if (fuse || inQuad(x, y, wing) || inQuad(x, y, stab)) hit++
        }
      const k = (j * n + i) * 4
      data[k] = data[k + 1] = data[k + 2] = 255
      data[k + 3] = Math.round((hit / 4) * 255)
    }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export function GroundShadow({ t, sky, engine }: { t: ThemeTokens; sky: SkyState; engine: JourneyEngine }) {
  const ref = useRef<THREE.Mesh>(null)
  const tex = useMemo(silhouette, [])
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8, toneMapped: false }),
    [tex],
  )
  useLayoutEffect(() => {
    mat.color.copy(col(t, 'stage-bg'))
  }, [mat, t])
  useLayoutEffect(
    () => () => {
      mat.dispose()
      tex.dispose()
    },
    [mat, tex],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const a = engine.aircraft
    const ac = aircraftFlight(engine)
    const groundFt = Math.max(0, terrainFtAt(a.eastNm, a.northNm))
    const aglM = Math.max(0, (a.altFt - groundFt) * M_PER_FT)
    const s = sky.sun
    const strength = sky.day * Math.max(0, 1 - aglM / 250) * Math.min(1, s.y * 3)
    m.visible = strength > 0.02
    if (!m.visible) return
    const k = aglM / FLIGHT_UNIT_M / Math.max(s.y, 0.2)
    const gy = (groundFt * M_PER_FT) / FLIGHT_UNIT_M + 0.005
    m.position.set(ac[0] - s.x * k, gy, ac[2] - s.z * k)
    m.rotation.set(-Math.PI / 2, 0, (a.headingDeg - 90) * -DEG)
    mat.opacity = 0.42 * strength
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={7}>
      <planeGeometry args={[SPAN_M / FLIGHT_UNIT_M, SPAN_M / FLIGHT_UNIT_M]} />
    </mesh>
  )
}
