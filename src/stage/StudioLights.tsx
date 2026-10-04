import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { col } from './col'

type Form = { shape: 'rect' | 'circle'; intensity: number; position: [number, number, number]; scale: [number, number]; tone: keyof ThemeTokens }

// Soft key above and behind, cool rim on the left, warm practical on the right, a top fill.
const FORMS: readonly Form[] = [
  { shape: 'rect', intensity: 2.2, position: [0, 6, -8], scale: [12, 3], tone: 'stage-paint' },
  { shape: 'rect', intensity: 1.4, position: [-8, 3, 2], scale: [8, 2], tone: 'stage-signal' },
  { shape: 'rect', intensity: 1.2, position: [8, 2, 4], scale: [8, 2], tone: 'stage-brass' },
  { shape: 'circle', intensity: 0.8, position: [0, 10, 0], scale: [6, 6], tone: 'stage-paint' },
]

/**
 * Reflections for the studio look: a few glowing light-formers facing the centre, baked
 * once into a prefiltered environment map (no image files, no HDR loaders). Rebuilt only
 * when the theme's colours change.
 */
function LightformerEnvironment({ t }: { t: ThemeTokens }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const key = FORMS.map((f) => t[f.tone]).join('|')
  useEffect(() => {
    const room = new THREE.Scene()
    const owned: { dispose(): void }[] = []
    for (const f of FORMS) {
      const geometry = f.shape === 'circle' ? new THREE.RingGeometry(0, 0.5, 48) : new THREE.PlaneGeometry(1, 1)
      const material = new THREE.MeshBasicMaterial({ color: col(t, f.tone).multiplyScalar(f.intensity), side: THREE.DoubleSide, toneMapped: false })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...f.position)
      mesh.scale.set(f.scale[0], f.scale[1], 1)
      mesh.lookAt(0, 0, 0)
      room.add(mesh)
      owned.push(geometry, material)
    }
    const pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromScene(room, 0, 0.1, 100, { size: 128 })
    pmrem.dispose()
    for (const o of owned) o.dispose()
    const previous = scene.environment
    scene.environment = target.texture
    return () => {
      if (scene.environment === target.texture) scene.environment = previous
      target.dispose()
    }
    // `key` holds the colours that matter; `t` changes identity on every theme read.
  }, [gl, scene, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Studio lighting: soft key, cool rim, warm practical, plus light-former reflections (no files). */
export function StudioLights({ t }: { t: ThemeTokens }) {
  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} castShadow={false} color={col(t, 'stage-paint')} />
      <directionalLight position={[-10, 6, -8]} intensity={0.9} color={col(t, 'stage-signal')} />
      <pointLight position={[-6, 3, 6]} intensity={14} distance={24} color={col(t, 'stage-brass')} />
      <LightformerEnvironment t={t} />
    </>
  )
}
