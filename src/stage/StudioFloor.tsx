import { ContactShadows, Grid } from '@react-three/drei'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { toThreeStyle } from '@/lib/color'
import { col } from './col'

/** Blueprint floor: fading grid plus a soft contact shadow under the hero. */
export function StudioFloor({ t, y = 0, shadowScale = 22 }: { t: ThemeTokens; y?: number; shadowScale?: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color={col(t, 'stage-floor')} roughness={0.92} metalness={0.05} />
      </mesh>
      <Grid
        position={[0, 0.005, 0]}
        args={[160, 160]}
        cellSize={1}
        cellThickness={0.5}
        cellColor={toThreeStyle(t['stage-line'])}
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor={toThreeStyle(t['stage-line'])}
        fadeDistance={48}
        fadeStrength={2.2}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.01, 0]} scale={shadowScale} blur={2.6} opacity={0.55} far={6} resolution={512} frames={1} />
    </group>
  )
}
