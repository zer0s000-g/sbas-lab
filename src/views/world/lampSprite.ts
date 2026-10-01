import * as THREE from 'three'

let sprite: THREE.DataTexture | null = null

/**
 * A round, soft-edged dot for lamp points: an alpha mask only (the lamp colour comes
 * from each point's vertex colour, read from the lamp tokens).
 */
export function lampSprite(): THREE.DataTexture {
  if (sprite) return sprite
  const n = 32
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2)
      const a = r < 0.35 ? 1 : Math.max(0, 1 - (r - 0.35) / 0.65) ** 1.6
      const i = (y * n + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(a * 255)
    }
  sprite = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  sprite.magFilter = THREE.LinearFilter
  sprite.minFilter = THREE.LinearFilter
  sprite.needsUpdate = true
  return sprite
}
