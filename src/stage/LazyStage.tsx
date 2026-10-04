import { Suspense, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isChunkLoadError, lazyRetry } from '@/lib/lazyRetry'
import { StageBoundary, type StageFailure } from './StageBoundary'
import { StagePoster } from './StagePoster'
import type { Stage as StageComponent } from './Stage'

export { StagePoster } from './StagePoster'

/**
 * The 3D stage, loaded on demand. three.js, drei and postprocessing live in
 * their own chunk, so a page's text, controls and layout appear before the
 * 3D engine has downloaded. The poster holds the same box, so nothing shifts.
 */
const StageImpl = lazyRetry(() => import('./Stage').then((m) => ({ default: m.Stage })))

export type StageProps = ComponentProps<typeof StageComponent>

/**
 * Resolves once the page has loaded and the browser is idle, so the 3D chunk
 * (about 280 kB) never competes with the text, fonts and simulator code the
 * page needs first.
 */
export function useWhenIdle() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    let idle = 0
    const go = () => {
      const ric = window.requestIdleCallback
      if (ric) idle = ric(() => !cancelled && setReady(true), { timeout: 1500 })
      else idle = window.setTimeout(() => !cancelled && setReady(true), 200)
    }
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', go)
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [])
  return ready
}

export function LazyStage(props: StageProps) {
  return (
    <DeferredStage className={props.className} label={props.label}>
      <StageImpl {...props} />
    </DeferredStage>
  )
}

/**
 * Mounts `children` (a lazily loaded 3D view) once the page is idle, with the poster
 * while it downloads and the failure poster if it cannot load or render. For a view
 * that wraps Stage in its own lazy module, so its setup code also stays out of the
 * first load.
 */
export function DeferredStage({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  const ready = useWhenIdle()
  if (!ready) return <StagePoster className={className} label={label} />
  return (
    <StageBoundary fallback={(f) => <StageFailurePoster {...f} className={className} label={label} />}>
      <Suspense fallback={<StagePoster className={className} label={label} />}>{children}</Suspense>
    </StageBoundary>
  )
}

/**
 * What a failed stage shows. A download that failed can be tried again; if that fails
 * too (Chromium remembers a failed module download until the page reloads) the button
 * reloads the page. Anything else (no WebGL, a shader the GPU rejects) is a limit of
 * this device.
 */
export function StageFailurePoster({
  error,
  retry,
  attempts,
  className,
  label,
  subject = '3D view',
}: StageFailure & { className?: string; label: string; /** What failed, for the message. */ subject?: string }) {
  const download = isChunkLoadError(error)
  const reload = attempts >= 2
  return (
    <StagePoster
      className={className}
      label={label}
      message={download ? `${subject} could not be downloaded` : `${subject} unavailable on this device`}
      action={
        download ? (
          <Button size="sm" variant="outline" onClick={reload ? () => window.location.reload() : retry}>
            <RotateCw aria-hidden /> {reload ? 'Reload page' : 'Try again'}
          </Button>
        ) : undefined
      }
    />
  )
}
