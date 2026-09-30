import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageBoundary } from '@/components/RouteError'
import { SiteFooter } from '@/components/SiteFooter'
import { applyTheme, usePrefs } from '@/stores/prefs'
import JourneyPage from '@/page/JourneyPage'

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

/** The one page ("/"): LAB201's journey. */
export default function App() {
  useThemeSync()
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
          <JourneyPage />
        </PageBoundary>
        <SiteFooter />
      </div>
    </TooltipProvider>
  )
}
