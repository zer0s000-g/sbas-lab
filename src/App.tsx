import { Suspense, useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageBoundary } from '@/components/RouteError'
import { SiteFooter } from '@/components/SiteFooter'
import { applyMotion, applyTheme, usePrefs } from '@/stores/prefs'
import JourneyPage from '@/page/JourneyPage'
import { ACTIVE_VIEW } from '@/page/view'
import { lazyRetry } from '@/lib/lazyRetry'

// The SBAS systems of the world (`?view=systems`): a page of its own, loaded only there.
const SystemsPage = ACTIVE_VIEW === 'systems' ? lazyRetry(() => import('@/page/systems/SystemsPage')) : null

function useThemeSync() {
  const theme = usePrefs((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
}

function useMotionSync() {
  const override = usePrefs((s) => s.reducedMotionOverride)
  useEffect(() => applyMotion(override), [override])
}

/** The one page ("/"): LAB201's journey, or the SBAS systems of the world (`?view=systems`). */
export default function App() {
  useThemeSync()
  useMotionSync()
  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col">
        <PageBoundary>
          {SystemsPage ? (
            <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
              <SystemsPage />
            </Suspense>
          ) : (
            <JourneyPage />
          )}
        </PageBoundary>
        <SiteFooter />
      </div>
    </TooltipProvider>
  )
}
