/**
 * Coastlines from Natural Earth (public domain), as compact data the views decode once:
 * rings of land polygons in longitude/latitude (scripts/geo/build-coast.mjs writes the
 * *.data.ts files). A spatial index answers "is this point on land?" (even–odd rule, so
 * lakes are holes) and "how far is the nearest coast?" fast enough to build terrain.
 * Pure, so the terrain, the map and the tests share it.
 */

export interface CoastData {
  box: { lon0: number; lon1: number; lat0: number; lat1: number }
  /** Quantisation step, degrees. */
  resDeg: number
  /** Each ring: delta-encoded integer pairs (lon, lat) in steps of resDeg from the box corner. */
  rings: readonly (readonly number[])[]
}

/** A ring as flat [x0, y0, x1, y1, …] coordinates. */
export type Ring = Float64Array

/** Decode to longitude/latitude rings. */
export function decodeRings(d: CoastData): Ring[] {
  return d.rings.map((r) => {
    const out = new Float64Array(r.length)
    let x = 0
    let y = 0
    for (let i = 0; i < r.length; i += 2) {
      x += r[i]
      y += r[i + 1]
      out[i] = d.box.lon0 + x * d.resDeg
      out[i + 1] = d.box.lat0 + y * d.resDeg
    }
    return out
  })
}

/** Map every ring point through a projection (for example to local NM). */
export function projectRings(rings: Ring[], f: (x: number, y: number) => [number, number]): Ring[] {
  return rings.map((r) => {
    const out = new Float64Array(r.length)
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = f(r[i], r[i + 1])
      out[i] = x
      out[i + 1] = y
    }
    return out
  })
}

/**
 * Segments bucketed into square cells (for the nearest coast) and into horizontal rows
 * (for the even–odd inside test), in whatever planar units the rings use. The buckets
 * are dense typed arrays (compressed rows), so a query touches no hash maps.
 */
export class CoastIndex {
  private readonly sx1: Float64Array
  private readonly sy1: Float64Array
  private readonly sx2: Float64Array
  private readonly sy2: Float64Array
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  private readonly nx: number
  private readonly ny: number
  private readonly cellStart: Int32Array
  private readonly cellItems: Int32Array
  private readonly rowStart: Int32Array
  private readonly rowItems: Int32Array

  private readonly cell: number

  constructor(rings: Ring[], cell: number) {
    this.cell = cell
    let n = 0
    for (const r of rings) n += r.length / 2
    this.sx1 = new Float64Array(n)
    this.sy1 = new Float64Array(n)
    this.sx2 = new Float64Array(n)
    this.sy2 = new Float64Array(n)
    let k = 0
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of rings) {
      const m = r.length / 2
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m
        this.sx1[k] = r[2 * i]
        this.sy1[k] = r[2 * i + 1]
        this.sx2[k] = r[2 * j]
        this.sy2[k] = r[2 * j + 1]
        minX = Math.min(minX, r[2 * i])
        maxX = Math.max(maxX, r[2 * i])
        minY = Math.min(minY, r[2 * i + 1])
        maxY = Math.max(maxY, r[2 * i + 1])
        k++
      }
    }
    if (n === 0) minX = minY = maxX = maxY = 0
    this.minX = minX
    this.minY = minY
    this.maxX = maxX
    this.maxY = maxY
    this.nx = Math.floor((maxX - minX) / cell) + 1
    this.ny = Math.floor((maxY - minY) / cell) + 1
    // Two passes: count, then fill (compressed sparse rows).
    const cellCount = new Int32Array(this.nx * this.ny + 1)
    const rowCount = new Int32Array(this.ny + 1)
    const span = (s: number) => {
      const ax = this.cx(Math.min(this.sx1[s], this.sx2[s]))
      const bx = this.cx(Math.max(this.sx1[s], this.sx2[s]))
      const ay = this.cy(Math.min(this.sy1[s], this.sy2[s]))
      const by = this.cy(Math.max(this.sy1[s], this.sy2[s]))
      return [ax, bx, ay, by] as const
    }
    for (let s = 0; s < n; s++) {
      const [ax, bx, ay, by] = span(s)
      for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) cellCount[x * this.ny + y + 1]++
      for (let y = ay; y <= by; y++) rowCount[y + 1]++
    }
    for (let i = 1; i < cellCount.length; i++) cellCount[i] += cellCount[i - 1]
    for (let i = 1; i < rowCount.length; i++) rowCount[i] += rowCount[i - 1]
    this.cellStart = cellCount
    this.rowStart = rowCount
    this.cellItems = new Int32Array(cellCount[cellCount.length - 1])
    this.rowItems = new Int32Array(rowCount[rowCount.length - 1])
    const cellFill = cellCount.slice(0, -1)
    const rowFill = rowCount.slice(0, -1)
    for (let s = 0; s < n; s++) {
      const [ax, bx, ay, by] = span(s)
      for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) this.cellItems[cellFill[x * this.ny + y]++] = s
      for (let y = ay; y <= by; y++) this.rowItems[rowFill[y]++] = s
    }
  }

  private cx = (x: number) => Math.floor((x - this.minX) / this.cell)
  private cy = (y: number) => Math.floor((y - this.minY) / this.cell)

  /** Inside a land polygon (even–odd: lakes and lagoons count as water). */
  inside(x: number, y: number): boolean {
    if (!(y >= this.minY && y <= this.maxY && x <= this.maxX)) return false
    const row = this.cy(y)
    let odd = false
    for (let i = this.rowStart[row]; i < this.rowStart[row + 1]; i++) {
      const k = this.rowItems[i]
      const y1 = this.sy1[k]
      const y2 = this.sy2[k]
      if (y1 > y !== y2 > y) {
        const xc = this.sx1[k] + ((y - y1) * (this.sx2[k] - this.sx1[k])) / (y2 - y1)
        if (x < xc) odd = !odd
      }
    }
    return odd
  }

  /** Distance to the nearest coast, capped at maxDist (searched over nearby cells only). */
  distance(x: number, y: number, maxDist: number): number {
    const c = this.cell
    const cx = this.cx(x)
    const cy = this.cy(y)
    const reach = Math.ceil(maxDist / c)
    let best2 = maxDist * maxDist
    for (let ring = 0; ring <= reach; ring++) {
      // Every cell in this ring is at least (ring − 1) cells away.
      const near = Math.max(0, ring - 1) * c
      if (near * near > best2) break
      for (let i = -ring; i <= ring; i++) {
        const gx = cx + i
        if (gx < 0 || gx >= this.nx) continue
        const edge = Math.abs(i) === ring
        for (let j = -ring; j <= ring; j += edge ? 1 : 2 * ring || 1) {
          const gy = cy + j
          if (gy < 0 || gy >= this.ny) continue
          const g = gx * this.ny + gy
          for (let q = this.cellStart[g]; q < this.cellStart[g + 1]; q++) {
            const k = this.cellItems[q]
            const ax = this.sx1[k]
            const ay = this.sy1[k]
            const dx = this.sx2[k] - ax
            const dy = this.sy2[k] - ay
            const l2 = dx * dx + dy * dy
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
            const ex = x - (ax + t * dx)
            const ey = y - (ay + t * dy)
            const d2 = ex * ex + ey * ey
            if (d2 < best2) best2 = d2
          }
        }
      }
    }
    return Math.sqrt(best2)
  }

  /** Signed distance to the coast: positive on land, negative at sea, capped at ±maxDist. */
  signed(x: number, y: number, maxDist: number): number {
    const d = this.distance(x, y, maxDist)
    return this.inside(x, y) ? d : -d
  }
}
