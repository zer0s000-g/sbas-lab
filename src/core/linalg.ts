/** Small dense linear algebra for the position solution (4×4 normal equations). */

export type Matrix = number[][]

export const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => Array.from({ length: c }, () => 0))

export function transpose(a: Matrix): Matrix {
  const out = zeros(a[0]?.length ?? 0, a.length)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].length; j++) out[j][i] = a[i][j]
  return out
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  const n = a.length
  const m = b[0]?.length ?? 0
  const k = b.length
  const out = zeros(n, m)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0
      for (let x = 0; x < k; x++) s += a[i][x] * b[x][j]
      out[i][j] = s
    }
  return out
}

/** Inverse by Gauss–Jordan with partial pivoting. Null when the matrix is singular (a geometry that cannot be solved). */
export function invert(a: Matrix): Matrix | null {
  const n = a.length
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    const p = m[pivot][col]
    if (!Number.isFinite(p) || Math.abs(p) < 1e-12) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let j = 0; j < 2 * n; j++) m[col][j] /= p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j]
    }
  }
  return m.map((row) => row.slice(n))
}
