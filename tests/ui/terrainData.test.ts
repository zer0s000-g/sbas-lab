import { describe, expect, test } from 'vitest'
import * as THREE from 'three'
import { DEPARTURE, DESTINATION } from '@/core/region'
import { M_PER_FT } from '@/core/units'
import { FLIGHT_UNIT_M } from '@/views/scales'
import { terrainFtAt } from '@/views/terrain'
import { TERRAIN_PATCHES, buildGroundAt, builtAirports, seaCorridor, seaPatch, terrainCorridor, terrainPatch, terrainTrees } from '@/views/world/terrainData'

describe('flight-view ground data', () => {
  test('the airport the view opens at is built at once, and everything is kept for the session', () => {
    buildGroundAt(DEPARTURE.id)
    expect(builtAirports()).toContain(DEPARTURE.id)
    expect(terrainCorridor()).toBe(terrainCorridor())
    expect(terrainPatch(DEPARTURE.id)).toBe(terrainPatch(DEPARTURE.id))
    expect(terrainTrees(DEPARTURE.id)).toBe(terrainTrees(DEPARTURE.id))
    expect(seaCorridor()).toBe(seaCorridor())
    // A stable list until another airport is built.
    expect(builtAirports()).toBe(builtAirports())
  })

  test('grid heights are the terrain (never below 150 ft deep)', () => {
    const g = terrainPatch(DESTINATION.id)
    for (let k = 0; k < 300; k++) {
      const i = (k * 37) % (g.nx + 1)
      const j = (k * 53) % (g.ny + 1)
      const e = g.rect.e0 + ((g.rect.e1 - g.rect.e0) * i) / g.nx
      const n = g.rect.n0 + ((g.rect.n1 - g.rect.n0) * j) / g.ny
      const v = i * (g.ny + 1) + j
      expect(g.heightFt[v]).toBeCloseTo(Math.max(-150, terrainFtAt(e, n)), 3)
      expect(g.position[v * 3 + 1]).toBeCloseTo((g.heightFt[v] * M_PER_FT) / FLIGHT_UNIT_M, 4)
    }
  })

  test('normals and bounding sphere are the ones three.js would compute', () => {
    const g = terrainPatch(DEPARTURE.id)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3))
    geo.setIndex(new THREE.BufferAttribute(g.index, 1))
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    const n = geo.getAttribute('normal').array
    for (let i = 0; i < n.length; i += 997) expect(g.normal[i]).toBeCloseTo(n[i], 5)
    expect(g.sphere.radius).toBeCloseTo(geo.boundingSphere!.radius, 3)
    expect(g.sphere.center.distanceTo(geo.boundingSphere!.center)).toBeLessThan(1e-3)
  })

  test('trees at both airports, each set within its patch, and thinning keeps both forests', () => {
    for (const p of TERRAIN_PATCHES) {
      const t = terrainTrees(p.id)
      expect(t.count).toBeGreaterThan(500)
      expect(t.matrices.length).toBe(t.count * 16)
      const m = new THREE.Matrix4()
      const pos = new THREE.Vector3()
      const box = new THREE.Box3()
      const half = new THREE.Box3()
      for (let i = 0; i < t.count; i++) {
        pos.setFromMatrixPosition(m.fromArray(t.matrices, i * 16))
        const e = pos.x / (1852 / FLIGHT_UNIT_M)
        const n = -pos.z / (1852 / FLIGHT_UNIT_M)
        expect(e).toBeGreaterThan(p.e0)
        expect(e).toBeLessThan(p.e1)
        expect(n).toBeGreaterThan(p.n0)
        expect(n).toBeLessThan(p.n1)
        box.expandByPoint(pos)
        if (i < Math.ceil(t.count / 2)) half.expandByPoint(pos)
      }
      // The first half (drawn on low quality) is every second tree: it spreads over the same area.
      const size = box.getSize(new THREE.Vector3())
      const hs = half.getSize(new THREE.Vector3())
      expect(hs.x).toBeGreaterThan(size.x * 0.9)
      expect(hs.z).toBeGreaterThan(size.z * 0.9)
    }
  })

  test('sea height maps: 2048 px along the corridor, 512 px around each airport', () => {
    const c = seaCorridor()
    expect(c.width).toBe(2048)
    expect(c.data.length).toBe(c.width * c.height)
    for (const p of TERRAIN_PATCHES) {
      const m = seaPatch(p.id)
      expect(m.width).toBe(512)
      expect(m.height).toBe(512)
    }
  })
})
