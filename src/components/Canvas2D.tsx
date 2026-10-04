import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type HTMLAttributes } from 'react'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import { getThemeTokens, onThemeChange, type ThemeTokens } from '@/hooks/useThemeTokens'
import { cn } from '@/lib/utils'

export interface DrawInfo {
  /** CSS pixel size of the canvas. */
  width: number
  height: number
  dpr: number
  /** Real seconds since the previous frame (not since the previous draw when `frameKey` skips frames). */
  dt: number
  now: number
  tokens: ThemeTokens
  /** Goes up each time web fonts finish loading: part of the key of any cached layer with text on it. */
  fontEpoch: number
}

export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void

export interface Canvas2DProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  draw: DrawFn
  /** Redraw every animation frame (default). When false, redraws on resize, theme change or redrawKey change. */
  animate?: boolean
  redrawKey?: unknown
  /**
   * Called every frame while animating and on screen: the canvas redraws only when the
   * result changes (an array is compared item by item), and on resize, theme change,
   * font load or a new `draw`. Without it an animated canvas redraws every frame.
   */
  frameKey?: () => unknown
  /** Accessible description of what the canvas currently shows. */
  label: string
  /** Extra DOM overlays (labels, buttons) positioned over the canvas. */
  overlay?: React.ReactNode
  canvasClassName?: string
  /** Make the canvas focusable (for keyboard control). */
  focusable?: boolean
  onCanvasKeyDown?: React.KeyboardEventHandler<HTMLCanvasElement>
  onCanvasPointerDown?: React.PointerEventHandler<HTMLCanvasElement>
  onCanvasPointerMove?: React.PointerEventHandler<HTMLCanvasElement>
  onCanvasPointerUp?: React.PointerEventHandler<HTMLCanvasElement>
  onCanvasPointerLeave?: React.PointerEventHandler<HTMLCanvasElement>
}

export interface Canvas2DHandle {
  canvas: HTMLCanvasElement | null
  /** CSS pixel size. */
  size: () => { width: number; height: number }
  /** Pointer event → CSS pixel coordinates within the canvas. */
  toLocal: (e: { clientX: number; clientY: number }) => { x: number; y: number }
}

/** Below this CSS size (hidden, collapsed or squeezed) nothing is drawn. */
export const MIN_DRAW_PX = 8
/** Canvases draw at a device pixel ratio between 1 and 2 (design.md §7). */
export const MAX_DPR = 2

const canvasDpr = () => Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1))

const sameKey = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

/** Web fonts that finish loading after a canvas drew its text need it drawn again. */
let fontEpoch = 0
const fontListeners = new Set<() => void>()
if (typeof document !== 'undefined' && document.fonts?.addEventListener)
  document.fonts.addEventListener('loadingdone', () => {
    fontEpoch++
    fontListeners.forEach((l) => l())
  })

/**
 * A high-DPI canvas that fills its container, redraws at 60 fps while on
 * screen (or only when its `frameKey` changes) and reads colours from the theme tokens.
 */
export const Canvas2D = forwardRef<Canvas2DHandle, Canvas2DProps>(function Canvas2D(
  {
    draw,
    animate = true,
    redrawKey,
    frameKey,
    label,
    overlay,
    className,
    canvasClassName,
    focusable,
    onCanvasKeyDown,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasPointerLeave,
    ...rest
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const drawRef = useRef(draw)
  drawRef.current = draw
  const frameKeyRef = useRef(frameKey)
  frameKeyRef.current = frameKey
  /** The last frame key drawn, and whether something else asks for a redraw. */
  const lastKey = useRef<unknown>(undefined)
  const dirty = useRef(true)
  const reported = useRef(new Set<string>())
  const [visible, setVisible] = useState(true)

  useImperativeHandle(ref, () => ({
    get canvas() {
      return canvasRef.current
    },
    size: () => ({ width: sizeRef.current.width, height: sizeRef.current.height }),
    toLocal: (e) => {
      const r = canvasRef.current?.getBoundingClientRect()
      return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 }
    },
  }))

  const render = useCallback((dt: number, now: number) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const { width, height, dpr } = sizeRef.current
    // Hidden or squeezed to almost nothing: instruments would compute negative radii.
    if (width < MIN_DRAW_PX || height < MIN_DRAW_PX) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    try {
      drawRef.current(ctx, { width, height, dpr, dt, now, tokens: getThemeTokens(), fontEpoch })
    } catch (error) {
      // A drawing bug blanks this canvas for one frame; it must not take the page down
      // (this also runs from resize and theme callbacks, outside any error boundary).
      const msg = String(error)
      if (!reported.current.has(msg)) {
        reported.current.add(msg)
        console.error('Canvas draw failed:', error)
      }
    }
  }, [])

  // Size the backing store to the container at device pixel ratio, again whenever the
  // ratio changes (browser zoom, a move to another monitor) so the canvas stays sharp.
  useEffect(() => {
    const wrap = wrapRef.current
    const c = canvasRef.current
    if (!wrap || !c) return
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      const dpr = canvasDpr()
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      sizeRef.current = { width: Math.round(r.width), height: Math.round(r.height), dpr }
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      render(0, performance.now())
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    // A resolution query matches only the current ratio; when it stops matching, re-measure and watch the new one.
    let mq: MediaQueryList | null = null
    const onDprChange = () => {
      resize()
      watchDpr()
    }
    const watchDpr = () => {
      mq?.removeEventListener('change', onDprChange)
      mq = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null
      mq?.addEventListener?.('change', onDprChange)
    }
    watchDpr()
    resize()
    return () => {
      ro.disconnect()
      mq?.removeEventListener?.('change', onDprChange)
    }
  }, [render])

  // Skip drawing while scrolled off screen.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), {
      rootMargin: '100px',
    })
    io.observe(wrap)
    return () => io.disconnect()
  }, [])

  const frame = useCallback(
    (dt: number, now: number) => {
      const getKey = frameKeyRef.current
      if (getKey) {
        const key = getKey()
        if (!dirty.current && sameKey(key, lastKey.current)) return
        lastKey.current = key
        dirty.current = false
      }
      render(dt, now)
    },
    [render],
  )
  useAnimationFrame(frame, animate && visible)
  // A new draw function may draw something else: the next frame draws it.
  useEffect(() => {
    dirty.current = true
  }, [draw])

  // Every canvas redraws on theme change and font load; static ones also on redrawKey change.
  useEffect(() => onThemeChange(() => render(0, performance.now())), [render])
  useEffect(() => {
    const redraw = () => render(0, performance.now())
    fontListeners.add(redraw)
    return () => {
      fontListeners.delete(redraw)
    }
  }, [render])
  useEffect(() => {
    if (!animate) render(0, performance.now())
  }, [animate, redrawKey, render])

  return (
    <div ref={wrapRef} className={cn('relative overflow-hidden', className)} {...rest}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        tabIndex={focusable ? 0 : undefined}
        className={cn('absolute inset-0 block touch-none select-none', canvasClassName)}
        onKeyDown={onCanvasKeyDown}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerLeave={onCanvasPointerLeave}
        onPointerCancel={onCanvasPointerUp}
      />
      {overlay}
    </div>
  )
})
