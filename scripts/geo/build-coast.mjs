// Builds the coastline data the views draw (src/views/geo/*.data.ts) from Natural Earth
// land polygons (public domain, naturalearthdata.com). The source files are not kept in
// the repo; download and unzip them, then run:
//
//   node scripts/geo/build-coast.mjs <dir with 10m/ 50m/ 110m/ subfolders>
//
// Each dataset is clipped to a box, simplified (Douglas–Peucker) and stored as
// delta-encoded integer rings, so the page ships a few kilobytes, not megabytes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/geo/build-coast.mjs <natural-earth dir>')
  process.exit(1)
}

const DATASETS = [
  // Flight view: Java, Madura, Bali, the Sunda Strait and the west of Lombok, in detail.
  { name: 'javaBali', file: '10m/ne_10m_land.shp', box: { lon0: 104.5, lon1: 116.5, lat0: -9.5, lat1: -5.0 }, tolDeg: 0.001, resDeg: 0.0005, minAreaDeg2: 0.00002, out: 'javaBali.data.ts', note: '1:10m, Java to Lombok' },
  // Network map: the Indonesian archipelago and its neighbours.
  { name: 'indonesia', file: '50m/ne_50m_land.shp', box: { lon0: 88, lon1: 148, lat0: -18, lat1: 14 }, tolDeg: 0.04, resDeg: 0.01, minAreaDeg2: 0.01, out: 'indonesia.data.ts', note: '1:50m, 88–148°E, 18°S–14°N' },
  // Globe: the whole world, coarse.
  { name: 'world', file: '110m/ne_110m_land.shp', box: { lon0: -180, lon1: 180, lat0: -90, lat1: 90 }, tolDeg: 0.35, resDeg: 0.05, minAreaDeg2: 1, out: 'world.data.ts', note: '1:110m, whole world' },
]

/** Polygon rings from an ESRI shapefile (shape types 5 and 15). */
function readShpRings(path) {
  const buf = readFileSync(path)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const fileLen = dv.getInt32(24, false) * 2
  const rings = []
  let off = 100
  while (off < fileLen) {
    const contentLen = dv.getInt32(off + 4, false) * 2
    const rec = off + 8
    const type = dv.getInt32(rec, true)
    if (type === 5 || type === 15) {
      const numParts = dv.getInt32(rec + 36, true)
      const numPoints = dv.getInt32(rec + 40, true)
      const parts = []
      for (let i = 0; i < numParts; i++) parts.push(dv.getInt32(rec + 44 + i * 4, true))
      const pts = rec + 44 + numParts * 4
      for (let i = 0; i < numParts; i++) {
        const a = parts[i]
        const b = i + 1 < numParts ? parts[i + 1] : numPoints
        const ring = []
        for (let k = a; k < b; k++) ring.push([dv.getFloat64(pts + k * 16, true), dv.getFloat64(pts + k * 16 + 8, true)])
        rings.push(ring)
      }
    }
    off = rec + contentLen
  }
  return rings
}

/** Sutherland–Hodgman clip of a ring against an axis-aligned box. */
function clipRing(ring, { lon0, lon1, lat0, lat1 }) {
  const edges = [
    [(p) => p[0] >= lon0, (a, b) => [lon0, a[1] + ((b[1] - a[1]) * (lon0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= lon1, (a, b) => [lon1, a[1] + ((b[1] - a[1]) * (lon1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= lat0, (a, b) => [a[0] + ((b[0] - a[0]) * (lat0 - a[1])) / (b[1] - a[1]), lat0]],
    [(p) => p[1] <= lat1, (a, b) => [a[0] + ((b[0] - a[0]) * (lat1 - a[1])) / (b[1] - a[1]), lat1]],
  ]
  let out = ring
  for (const [inside, cut] of edges) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur))
        out.push(cur)
      } else if (inside(prev)) out.push(cut(prev, cur))
    }
    if (out.length === 0) break
  }
  return out
}

function simplify(points, tol) {
  if (points.length < 4) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let best = -1
    let bestD = tol
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

const area = (ring) => {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

const outDir = join(root, 'src', 'views', 'geo')
mkdirSync(outDir, { recursive: true })

for (const d of DATASETS) {
  const rings = readShpRings(join(src, d.file))
  const encoded = []
  let points = 0
  for (const ring of rings) {
    // Drop the closing duplicate before clipping.
    const open = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring
    const clipped = clipRing(open, d.box)
    if (clipped.length < 3 || area(clipped) < d.minAreaDeg2) continue
    const simple = simplify([...clipped, clipped[0]], d.tolDeg).slice(0, -1)
    if (simple.length < 3) continue
    const q = simple.map(([lon, lat]) => [Math.round((lon - d.box.lon0) / d.resDeg), Math.round((lat - d.box.lat0) / d.resDeg)])
    const flat = []
    let px = 0
    let py = 0
    for (const [x, y] of q) {
      flat.push(x - px, y - py)
      px = x
      py = y
    }
    encoded.push(flat)
    points += q.length
  }
  const body = `// Generated by scripts/geo/build-coast.mjs from Natural Earth (public domain), ${d.note}. Do not edit.
import type { CoastData } from './coast'

export const ${d.name}: CoastData = {
  box: ${JSON.stringify(d.box)},
  resDeg: ${d.resDeg},
  rings: [
${encoded.map((r) => `    [${r.join(',')}],`).join('\n')}
  ],
}
`
  writeFileSync(join(outDir, d.out), body)
  console.log(`${d.out}: ${encoded.length} rings, ${points} points, ${(body.length / 1024).toFixed(1)} kB`)
}
