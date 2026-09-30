import { Environment, Lightformer } from '@react-three/drei'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { toThreeStyle } from '@/lib/color'
import { col } from './col'

/** Studio lighting: soft key, cool rim, warm practical, all from light-formers (no files). */
export function StudioLights({ t }: { t: ThemeTokens }) {
  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} castShadow={false} color={col(t, 'stage-paint')} />
      <directionalLight position={[-10, 6, -8]} intensity={0.9} color={col(t, 'stage-signal')} />
      <pointLight position={[-6, 3, 6]} intensity={14} distance={24} color={col(t, 'stage-brass')} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, -8]} scale={[12, 3, 1]} color={toThreeStyle(t['stage-paint'])} />
        <Lightformer form="rect" intensity={1.4} position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} color={toThreeStyle(t['stage-signal'])} />
        <Lightformer form="rect" intensity={1.2} position={[8, 2, 4]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} color={toThreeStyle(t['stage-brass'])} />
        <Lightformer form="circle" intensity={0.8} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={6} color={toThreeStyle(t['stage-paint'])} />
      </Environment>
    </>
  )
}
