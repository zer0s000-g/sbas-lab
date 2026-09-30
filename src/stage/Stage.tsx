import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useThemeTokens, type ThemeTokens } from '@/hooks/useThemeTokens'
import { useReducedMotion } from '@/stores/prefs'
import { cn } from '@/lib/utils'
import { CameraRig } from './CameraRig'
import { StageLabelsContext } from './labels'
import { col } from './col'
import { StudioLights } from './StudioLights'

import type { Quality, Shot } from './types'
export type { Quality, Shot } from './types'
export { col } from './col'
export { CameraRig } from './CameraRig'
export { StudioLights } from './StudioLights'
export { StudioFloor } from './StudioFloor'

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function Effects({ quality, reduced }: { quality: Quality; reduced: boolean }) {
  if (quality === 'low') return null
  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.2} radius={0.72} />
      {/* Moving grain is decorative motion: it stops with reduced motion. */}
      <Noise premultiply opacity={reduced ? 0 : 0.35} />
      <Vignette eskil={false} offset={0.22} darkness={0.78} />
    </EffectComposer>
  )
}

/**
 * The 3D stage used by every world view: WebGL check, performance tiers
 * (PerformanceMonitor steps quality and DPR down, never up), fog, studio
 * lights, bloom, grain and vignette, and the camera rig. Children receive the
 * current theme tokens. Falls back to `fallback` when WebGL is missing.
 */
export function Stage({
  children,
  shot,
  label,
  className,
  fallback,
  drift = true,
  onCreated,
  interactive = false,
  fog = [26, 90],
  far = 400,
  paused = false,
}: {
  children: (t: ThemeTokens, quality: Quality) => ReactNode
  shot: Shot
  label: string
  className?: string
  fallback?: ReactNode
  drift?: boolean
  onCreated?: () => void
  /** The scene holds clickable labels: expose it as a labelled group instead of an image. */
  interactive?: boolean
  /** Fog near and far distance, scene units (each view has its own scale). */
  fog?: [number, number]
  /** Camera far plane, scene units. */
  far?: number
  /** Stop rendering (another view covers the stage); the WebGL context stays. */
  paused?: boolean
}) {
  const t = useThemeTokens()
  const reduced = useReducedMotion()
  const [ok, setOk] = useState<boolean | null>(null)
  const [quality, setQuality] = useState<Quality>('high')
  // The screen's own pixel ratio, clamped to 1–2 and fixed for the life of the stage:
  // changing it resizes the canvas mid-scene, which shows as a flash. A slow GPU
  // gets lower quality tiers (fewer effects) instead.
  const [dpr] = useState(() => Math.min(2, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio : 1)))
  useEffect(() => setOk(webglAvailable()), [])
  // The canvas measures its box with a ResizeObserver that React's development
  // StrictMode (mount, unmount, mount) can leave detached until the next window
  // resize. One resize nudge after mount makes the first measurement reliable.
  useEffect(() => {
    if (!ok) return
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    return () => cancelAnimationFrame(id)
  }, [ok])
  // Stop rendering while the stage is scrolled out of view (browsers already
  // throttle hidden tabs).
  const root = useRef<HTMLDivElement>(null)
  // drei Html labels mount into this layer. It exists before the Canvas does, so labels
  // never remount (and React never warns) when the scene first renders.
  const labels = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={root}
      role={interactive ? 'group' : 'img'}
      aria-roledescription={interactive ? '3D view' : undefined}
      aria-label={label}
      className={cn('relative overflow-hidden bg-stage-bg', className)}
    >
      {ok === false ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {fallback ?? '3D view needs WebGL.'}
        </div>
      ) : ok ? (
        <StageLabelsContext.Provider value={labels as RefObject<HTMLElement>}>
          <div ref={labels} className={cn('pointer-events-none absolute inset-0 z-[1] overflow-hidden', paused && 'invisible')} />
          <Canvas
            frameloop={onScreen && !paused ? 'always' : 'never'}
            dpr={dpr}
            gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
            camera={{ position: shot.position, fov: shot.fov ?? 30, near: 0.1, far }}
            style={{ position: 'absolute', inset: 0 }}
            onCreated={() => onCreated?.()}
          >
            <color attach="background" args={[col(t, 'stage-bg')]} />
            <fog attach="fog" args={[col(t, 'stage-fog'), fog[0], fog[1]]} />
            <PerformanceMonitor onDecline={() => setQuality((q) => (q === 'high' ? 'medium' : 'low'))}>
              <Suspense fallback={null}>
                <StudioLights t={t} />
                {children(t, quality)}
              </Suspense>
              <CameraRig shot={shot} drift={drift} reduced={reduced} />
              <Effects quality={reduced ? 'medium' : quality} reduced={reduced} />
            </PerformanceMonitor>
          </Canvas>
        </StageLabelsContext.Provider>
      ) : null}
    </div>
  )
}
