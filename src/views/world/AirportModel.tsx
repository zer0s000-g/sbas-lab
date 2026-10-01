/**
 * One airport from its layout (views/airports): pavement, markings and runway numbers
 * as ground layers drawn in a fixed order without writing depth (so no two layers can
 * fight over the same pixels), then the buildings, the parked airliners and the
 * airfield lights. Lamps are screen-sized points that glow brighter at night; the PAPI
 * shows white or red for LAB201's height above or below each unit's setting.
 */
import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { toThreeStyle } from '@/lib/color'
import { DEG } from '@/core/units'
import type { JourneyEngine } from '@/journey/engine'
import { col } from '@/stage/col'
import { TAXIWAY_WIDTH_M, type AirportLayout, type Box, type Lamp, type RA, type Rect } from '../airports'
import { aircraftFlight } from '../shots'
import { FLIGHT_UNIT_M } from '../scales'
import { Airliner, type AirlinerHandle } from './Airliner'
import { lampSprite } from './lampSprite'
import { raToWorld, type SkyState } from './skyState'

type Layer = 'apron' | 'taxiway' | 'runway' | 'shoulder' | 'marking' | 'taxiline' | 'number'
const ORDER: Record<Layer, number> = { apron: 1, shoulder: 2, taxiway: 3, runway: 4, marking: 5, taxiline: 6, number: 6 }

/** Flat quads for runway-frame rectangles, hM above the field. */
function rectsGeo(l: AirportLayout, rects: Rect[], hM: number) {
  const pos: number[] = []
  for (const q of rects) {
    const p00 = raToWorld(l, q.a0, q.r0, hM)
    const p10 = raToWorld(l, q.a1, q.r0, hM)
    const p11 = raToWorld(l, q.a1, q.r1, hM)
    const p01 = raToWorld(l, q.a0, q.r1, hM)
    pos.push(...p00, ...p01, ...p11, ...p00, ...p11, ...p10)
  }
  return flatGeo(pos)
}

/** Strips of a width along polylines, with round joints. */
function stripsGeo(l: AirportLayout, lines: RA[][], width: number, hM: number) {
  const pos: number[] = []
  const w = width / 2
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [p, q] = [line[i], line[i + 1]]
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      const na = (-(q[1] - p[1]) / len) * w
      const nr = ((q[0] - p[0]) / len) * w
      const a = raToWorld(l, p[0] + na, p[1] + nr, hM)
      const b = raToWorld(l, q[0] + na, q[1] + nr, hM)
      const c = raToWorld(l, q[0] - na, q[1] - nr, hM)
      const d = raToWorld(l, p[0] - na, p[1] - nr, hM)
      pos.push(...a, ...c, ...d, ...a, ...b, ...c)
    }
    for (const p of line) {
      const n = 14
      const c0 = raToWorld(l, p[0], p[1], hM)
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * Math.PI * 2
        const t1 = ((k + 1) / n) * Math.PI * 2
        const u = raToWorld(l, p[0] + Math.cos(t0) * w, p[1] + Math.sin(t0) * w, hM)
        const v = raToWorld(l, p[0] + Math.cos(t1) * w, p[1] + Math.sin(t1) * w, hM)
        pos.push(...c0, ...v, ...u)
      }
    }
  }
  return flatGeo(pos)
}

function flatGeo(pos: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const nor = new Float32Array(pos.length)
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.computeBoundingSphere()
  return g
}

function decalMat(layer: Layer, roughness = 0.9) {
  const k = ORDER[layer]
  // Layers sit 15–45 cm above the levelled ground and test depth against it without
  // writing depth: no slope-scaled offset, so they never paint over the aircraft or
  // buildings standing on them, and draw order alone stacks them.
  return new THREE.MeshStandardMaterial({ roughness, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -1 - k })
}

/** Runway numbers on a canvas (in the marking colour), upright for the landing direction. */
function designatorGeo(l: AirportLayout, a: number, r: number, dir: 1 | -1) {
  const L = 4.5
  // Wide enough for a letter as well as the number (07R).
  const R = 7.5
  const bl = raToWorld(l, a - dir * L, r - dir * R, 0.5)
  const br = raToWorld(l, a - dir * L, r + dir * R, 0.5)
  const tl = raToWorld(l, a + dir * L, r - dir * R, 0.5)
  const tr = raToWorld(l, a + dir * L, r + dir * R, 0.5)
  const g = flatGeo([...bl, ...br, ...tr, ...bl, ...tr, ...tl])
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2))
  return g
}

function numberTexture(text: string, t: ThemeTokens) {
  const c = document.createElement('canvas')
  // Same aspect as the painted area (15 m across, 9 m along).
  c.width = 320
  c.height = 192
  const g = c.getContext('2d')!
  g.fillStyle = toThreeStyle(t['world-marking'])
  g.font = `700 176px ${t.fontSans}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 160, 100, 300)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

/** Buildings merged per material: walls, glazing and roofs. */
function buildingsGeo(l: AirportLayout, boxes: Box[]) {
  const walls: THREE.BufferGeometry[] = []
  const glass: THREE.BufferGeometry[] = []
  const roofs: THREE.BufferGeometry[] = []
  const rot = -(l.airport.runwayCourseDeg - 90) * DEG
  const put = (list: THREE.BufferGeometry[], g: THREE.BufferGeometry, q: Rect, base: number) => {
    const [x, y, z] = raToWorld(l, (q.a0 + q.a1) / 2, (q.r0 + q.r1) / 2, 0)
    g.rotateY(rot)
    g.translate(x, y + base / FLIGHT_UNIT_M, z)
    list.push(g.index ? g.toNonIndexed() : g)
  }
  const u = (m: number) => m / FLIGHT_UNIT_M
  for (const b of boxes) {
    const la = b.a1 - b.a0
    const lr = b.r1 - b.r0
    const box = (wa: number, h: number, wr: number) => {
      const g = new THREE.BoxGeometry(u(wa), u(h), u(wr))
      g.translate(0, u(h / 2), 0)
      return g
    }
    switch (b.kind) {
      case 'terminal':
      case 'pier':
        put(walls, box(la, b.h, lr), b, 0)
        put(glass, box(la + 0.4, b.h * 0.5, lr + 0.4), b, b.h * 0.22)
        put(roofs, box(la + 3, 1, lr + 3), b, b.h)
        break
      case 'bridge':
        put(walls, box(la, 2.6, lr), b, 3)
        break
      case 'tower': {
        const g = new THREE.CylinderGeometry(u(la / 2), u(la / 1.6), u(b.h), 16)
        g.translate(0, u(b.h / 2), 0)
        put(walls, g, b, 0)
        break
      }
      case 'cab': {
        const g = new THREE.CylinderGeometry(u(la / 2), u(la / 2.4), u(6), 8)
        g.translate(0, u(3), 0)
        put(glass, g, b, b.h - 6)
        const cap = new THREE.CylinderGeometry(u(la / 1.8), u(la / 1.8), u(1.2), 8)
        cap.translate(0, u(0.6), 0)
        put(roofs, cap, b, b.h)
        break
      }
      case 'hangar': {
        put(walls, box(la, b.h * 0.62, lr), b, 0)
        const roof = new THREE.CylinderGeometry(u(lr / 2), u(lr / 2), u(la), 20, 1, false, 0, Math.PI)
        roof.rotateZ(Math.PI / 2)
        roof.scale(1, (b.h * 0.38) / (lr / 2), 1)
        put(roofs, roof, b, b.h * 0.62)
        break
      }
      case 'block':
        put(walls, box(la, b.h, lr), b, 0)
        put(glass, box(la + 0.3, b.h * 0.18, lr + 0.3), b, b.h * 0.45)
        put(roofs, box(la + 1, 0.8, lr + 1), b, b.h)
        break
    }
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    let n = 0
    for (const g of list) n += g.getAttribute('position').count
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    let o = 0
    for (const g of list) {
      pos.set(g.getAttribute('position').array as Float32Array, o * 3)
      nor.set(g.getAttribute('normal').array as Float32Array, o * 3)
      o += g.getAttribute('position').count
      g.dispose()
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    out.computeBoundingSphere()
    return out
  }
  return { walls: merge(walls), glass: merge(glass), roofs: merge(roofs) }
}

const LAMP_PX: Record<Lamp['kind'], number> = { edge: 3, threshold: 3.4, end: 3.4, approach: 3.6, taxi: 2.4 }

function lampsPoints(l: AirportLayout, kind: Lamp['kind'], color: THREE.Color) {
  const pts = l.lamps.filter((p) => p.kind === kind).flatMap((p) => raToWorld(l, p.a, p.r, 0.6))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  geo.computeBoundingSphere()
  const mat = new THREE.PointsMaterial({ size: LAMP_PX[kind], sizeAttenuation: false, color, map: lampSprite(), transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.02 })
  const pts3 = new THREE.Points(geo, mat)
  pts3.userData = { kind, base: color.clone() }
  return pts3
}

export function AirportModel({ l, t, sky, engine, blink }: { l: AirportLayout; t: ThemeTokens; sky: SkyState; engine: JourneyEngine; blink: boolean }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const geos = useMemo(() => {
    const pier: Rect[] = l.lamps.some((p) => p.kind === 'approach') ? [{ a0: -905, a1: -40, r0: -2.5, r1: 2.5 }] : []
    return {
      apron: rectsGeo(l, [...l.aprons, ...l.landside], 0.15),
      shoulder: rectsGeo(l, l.shoulders, 0.25),
      taxiway: stripsGeo(l, l.taxiways, TAXIWAY_WIDTH_M, 0.2),
      runway: rectsGeo(l, [l.runway, ...l.extraRunways], 0.3),
      marking: rectsGeo(l, l.markings, 0.4),
      taxiline: (() => {
        const a = stripsGeo(l, l.taxiLines, 0.6, 0.45)
        const b = rectsGeo(l, l.holdBars, 0.45)
        const pos = [...(a.getAttribute('position').array as Float32Array), ...(b.getAttribute('position').array as Float32Array)]
        a.dispose()
        b.dispose()
        return flatGeo(pos)
      })(),
      numbers: l.designators.map((d) => ({ d, geo: designatorGeo(l, d.a, d.r, d.dir) })),
      buildings: buildingsGeo(l, l.buildings),
      pier: pier.length
        ? (() => {
            // Approach lights over the sea stand on a narrow pier at field level.
            const [x0, y0, z0] = raToWorld(l, (pier[0].a0 + pier[0].a1) / 2, 0, 0)
            const h = y0 + 0.004
            const g = new THREE.BoxGeometry((pier[0].a1 - pier[0].a0) / FLIGHT_UNIT_M, h, 5 / FLIGHT_UNIT_M)
            g.rotateY(-(l.airport.runwayCourseDeg - 90) * DEG)
            g.translate(x0, h / 2, z0)
            return g
          })()
        : null,
    }
  }, [l])
  const mats = useMemo(
    () => ({
      apron: decalMat('apron', 0.95),
      shoulder: decalMat('shoulder', 0.95),
      taxiway: decalMat('taxiway', 0.9),
      runway: decalMat('runway', 0.88),
      marking: decalMat('marking', 0.7),
      taxiline: decalMat('taxiline', 0.7),
      number: decalMat('number', 0.7),
      walls: new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }),
      glass: new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.4 }),
      roofs: new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.2 }),
      pier: new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    }),
    [],
  )
  const numberTex = useMemo(() => l.designators.map((d) => numberTexture(d.text, t)), [l, t])
  const numberMats = useMemo(
    () =>
      numberTex.map((tex) => {
        const m = decalMat('number', 0.7)
        m.map = tex
        m.transparent = true
        m.alphaTest = 0.35
        return m
      }),
    [numberTex],
  )
  useLayoutEffect(() => {
    mats.apron.color.copy(col(t, 'world-concrete'))
    mats.shoulder.color.copy(col(t, 'world-concrete')).lerp(col(t, 'world-asphalt'), 0.35)
    mats.taxiway.color.copy(col(t, 'world-asphalt')).lerp(col(t, 'world-concrete'), 0.18)
    mats.runway.color.copy(col(t, 'world-asphalt'))
    mats.marking.color.copy(col(t, 'world-marking'))
    mats.taxiline.color.copy(col(t, 'world-taxi-line'))
    mats.walls.color.copy(col(t, 'world-building'))
    mats.glass.color.copy(col(t, 'world-glazing'))
    mats.roofs.color.copy(col(t, 'world-roof'))
    mats.pier.color.copy(col(t, 'world-concrete'))
  }, [mats, t])

  const lamps = useMemo(
    () => [
      lampsPoints(l, 'edge', col(t, 'lamp-white')),
      lampsPoints(l, 'approach', col(t, 'lamp-white')),
      lampsPoints(l, 'threshold', col(t, 'lamp-green')),
      lampsPoints(l, 'end', col(t, 'lamp-red')),
      lampsPoints(l, 'taxi', col(t, 'lamp-blue')),
    ],
    [l, t],
  )
  const papi = useMemo(() => {
    if (!l.papi.length) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(l.papi.flatMap((p) => raToWorld(l, p.a, p.r, 0.9)), 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(l.papi.length * 3), 3))
    geo.computeBoundingSphere()
    const mat = new THREE.PointsMaterial({ size: 4.2, sizeAttenuation: false, vertexColors: true, map: lampSprite(), transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.02 })
    return new THREE.Points(geo, mat)
  }, [l])
  const papiCols = useMemo(() => ({ white: col(t, 'lamp-white'), red: col(t, 'lamp-red') }), [t])

  // Parked airliners: gear down, lights off.
  const parked = useMemo<AirlinerHandle>(() => ({ gear: true, landing: false, beacon: false }), [])
  const night = useMemo(() => ({ value: 0 }), [])

  useLayoutEffect(
    () => () => {
      for (const g of [geos.apron, geos.shoulder, geos.taxiway, geos.runway, geos.marking, geos.taxiline, geos.buildings.walls, geos.buildings.glass, geos.buildings.roofs]) g.dispose()
      geos.pier?.dispose()
      geos.numbers.forEach((n) => n.geo.dispose())
    },
    [geos],
  )
  useLayoutEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useLayoutEffect(
    () => () => {
      numberTex.forEach((x) => x.dispose())
      numberMats.forEach((m) => m.dispose())
    },
    [numberTex, numberMats],
  )
  useLayoutEffect(
    () => () =>
      lamps.forEach((p) => {
        p.geometry.dispose()
        ;(p.material as THREE.Material).dispose()
      }),
    [lamps],
  )

  const glow = useMemo(() => ({ concrete: col(t, 'world-concrete'), building: col(t, 'world-building'), window: col(t, 'lamp-amber').lerp(col(t, 'lamp-white'), 0.5) }), [t])
  useFrame(() => {
    night.value = 1 - sky.day
    // At night the apron is floodlit and the terminal windows are lit.
    const nv = night.value
    mats.apron.emissive.copy(glow.concrete).multiplyScalar(0.16 * nv)
    mats.taxiway.emissive.copy(glow.concrete).multiplyScalar(0.035 * nv)
    mats.runway.emissive.copy(glow.concrete).multiplyScalar(0.025 * nv)
    mats.marking.emissive.copy(glow.concrete).multiplyScalar(0.08 * nv)
    mats.taxiline.emissive.copy(glow.concrete).multiplyScalar(0.06 * nv)
    mats.walls.emissive.copy(glow.building).multiplyScalar(0.07 * nv)
    mats.glass.emissive.copy(glow.window).multiplyScalar(0.55 * nv)
    // Lamps are bright points in the dark and small, steady dots in daylight.
    const boost = 0.9 + 2.4 * night.value
    for (const p of lamps) {
      const m = p.material as THREE.PointsMaterial
      m.color.copy(p.userData.base as THREE.Color).multiplyScalar(boost)
      m.opacity = 0.75 + 0.25 * night.value
      m.size = LAMP_PX[p.userData.kind as Lamp['kind']] * dpr * (0.8 + 0.5 * night.value)
    }
    if (papi) {
      // Each unit shows white when LAB201 is above its setting angle, red below.
      const ac = aircraftFlight(engine)
      const pos = papi.geometry.getAttribute('position') as THREE.BufferAttribute
      const c = papi.geometry.getAttribute('color') as THREE.BufferAttribute
      l.papi.forEach((u, i) => {
        const dx = ac[0] - pos.getX(i)
        const dz = ac[2] - pos.getZ(i)
        const dy = (ac[1] - pos.getY(i)) * FLIGHT_UNIT_M
        const ang = Math.atan2(dy, Math.hypot(dx, dz) * FLIGHT_UNIT_M) / DEG
        const k = ang > u.settingDeg ? papiCols.white : papiCols.red
        c.setXYZ(i, k.r * boost, k.g * boost, k.b * boost)
      })
      c.needsUpdate = true
      ;(papi.material as THREE.PointsMaterial).size = 4.2 * dpr
    }
  })

  const stands = l.stands.map((s) => {
    const [x, y, z] = raToWorld(l, s.a, s.r, 0)
    return { key: `${s.a}`, pos: [x, y, z] as [number, number, number], rotY: -(s.headingDeg - 90) * DEG }
  })
  return (
    <group>
      <mesh geometry={geos.apron} material={mats.apron} renderOrder={ORDER.apron} />
      <mesh geometry={geos.shoulder} material={mats.shoulder} renderOrder={ORDER.shoulder} />
      <mesh geometry={geos.taxiway} material={mats.taxiway} renderOrder={ORDER.taxiway} />
      <mesh geometry={geos.runway} material={mats.runway} renderOrder={ORDER.runway} />
      <mesh geometry={geos.marking} material={mats.marking} renderOrder={ORDER.marking} />
      <mesh geometry={geos.taxiline} material={mats.taxiline} renderOrder={ORDER.taxiline} />
      {geos.numbers.map((n, i) => (
        <mesh key={n.d.text + i} geometry={n.geo} material={numberMats[i]} renderOrder={ORDER.number} />
      ))}
      <mesh geometry={geos.buildings.walls} material={mats.walls} />
      <mesh geometry={geos.buildings.glass} material={mats.glass} />
      <mesh geometry={geos.buildings.roofs} material={mats.roofs} />
      {geos.pier && <mesh geometry={geos.pier} material={mats.pier} />}
      {lamps.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
      {papi && <primitive object={papi} />}
      {stands.map((s) => (
        <group key={s.key} position={s.pos} rotation-y={s.rotY}>
          <Airliner t={t} state={parked} blink={blink} night={night} />
        </group>
      ))}
    </group>
  )
}
