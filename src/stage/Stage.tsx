import { memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
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

import type { Quality, Scenery, Shot } from './types'
export type { Quality, Scenery, Shot } from './types'
export { col } from './col'
export { CameraRig } from './CameraRig'
export { StudioLights } from './StudioLights'
export { StudioFloor } from './StudioFloor'

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    // Browsers allow only a few live contexts: release the probe's at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

function Effects({ quality, reduced, scenery, dpr }: { quality: Quality; reduced: boolean; scenery: Scenery; dpr: number }) {
  if (quality === 'low') return null
  // The studio look: strong bloom, grain and vignette. The world look (a daylight scene)
  // blooms only lamps and the sun, with light grain and a soft vignette.
  const world = scenery === 'world'
  return (
    // MSAA only on 1x screens: at a pixel ratio of 2 the canvas is already supersampled,
    // and 4x MSAA on top of it quadruples the fill cost for edges nobody can see.
    <EffectComposer multisampling={quality === 'high' && dpr < 1.5 ? 4 : 0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={world ? 0.55 : 0.85} luminanceThreshold={world ? 0.92 : 0.62} luminanceSmoothing={0.2} radius={world ? 0.6 : 0.72} />
      {/* Moving grain is decorative motion: it stops with reduced motion. */}
      {!reduced && <Noise premultiply opacity={world ? 0.12 : 0.35} />}
      <Vignette eskil={false} offset={world ? 0.3 : 0.22} darkness={world ? 0.42 : 0.78} />
    </EffectComposer>
  )
}

const DEFAULT_FOG: [number, number] = [26, 90]

/**
 * Everything inside the Canvas. Memoised: the page re-renders about ten times a second
 * for its text readouts, and the scene must not re-render (or rebuild its background and
 * fog, which makes three.js re-check every material's shader) unless its inputs change.
 */
const StageScene = memo(function StageScene({
  t,
  quality,
  reduced,
  shot,
  drift,
  scenery,
  fog,
  dpr,
  children,
  onDecline,
}: {
  t: ThemeTokens
  quality: Quality
  reduced: boolean
  shot: Shot
  drift: boolean
  scenery: Scenery
  fog: [number, number]
  dpr: number
  children: (t: ThemeTokens, quality: Quality) => ReactNode
  onDecline: () => void
}) {
  const background = useMemo(() => col(t, 'stage-bg'), [t])
  const fogColor = useMemo(() => col(t, 'stage-fog'), [t])
  const [near, far] = fog
  return (
    <>
      <color attach="background" args={[background]} />
      {/* A world scene brings its own fog, coloured like its sky's horizon. */}
      {scenery === 'studio' && <fog attach="fog" args={[fogColor, near, far]} />}
      <PerformanceMonitor onDecline={onDecline}>
        <Suspense fallback={null}>
          {scenery === 'studio' && <StudioLights t={t} />}
          {children(t, quality)}
        </Suspense>
        <CameraRig shot={shot} drift={drift} reduced={reduced} />
        {/* Reduced motion drops the high tier's extras, but a slow GPU still gets the low tier. */}
        <Effects quality={reduced && quality === 'high' ? 'medium' : quality} reduced={reduced} scenery={scenery} dpr={dpr} />
      </PerformanceMonitor>
    </>
  )
})

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
  fog = DEFAULT_FOG,
  far = 400,
  paused = false,
  scenery = 'studio',
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
  /** 'studio': the lit-miniature lights and effects. 'world': the scene brings its own sun and sky. */
  scenery?: Scenery
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
  const onDecline = useMemo(() => () => setQuality((q) => (q === 'high' ? 'medium' : 'low')), [])
  // A lost WebGL context (common on phones when the GPU is needed elsewhere) throws no
  // error: show the poster, and start a fresh canvas when the browser gives it back.
  const [contextLost, setContextLost] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
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
        <>
        {contextLost && (
          <div className="absolute inset-0 z-[2] grid place-items-center bg-stage-bg p-6 text-center">
            <p className="hud-label text-foreground/85">3D view paused: the graphics processor was reset. Resuming…</p>
          </div>
        )}
        <StageLabelsContext.Provider value={labels as RefObject<HTMLElement>}>
          <div ref={labels} className={cn('pointer-events-none absolute inset-0 z-[1] overflow-hidden', paused && 'invisible')} />
          <Canvas
            key={canvasKey}
            frameloop={onScreen && !paused && !contextLost ? 'always' : 'never'}
            dpr={dpr}
            gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
            camera={{ position: shot.position, fov: shot.fov ?? 30, near: 0.1, far }}
            style={{ position: 'absolute', inset: 0 }}
            onCreated={({ gl }) => {
              const canvas = gl.domElement
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault() // lets the browser restore it
                setContextLost(true)
              })
              canvas.addEventListener('webglcontextrestored', () => {
                setContextLost(false)
                setCanvasKey((k) => k + 1) // rebuild every GPU resource on a fresh canvas
              })
              onCreated?.()
            }}
          >
            <StageScene t={t} quality={quality} reduced={reduced} shot={shot} drift={drift} scenery={scenery} fog={fog} dpr={dpr} onDecline={onDecline}>
              {children}
            </StageScene>
          </Canvas>
        </StageLabelsContext.Provider>
        </>
      ) : null}
    </div>
  )
}
