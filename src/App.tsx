import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageBoundary } from '@/components/RouteError'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { applyTheme, usePrefs } from '@/stores/prefs'
import KitPreview from '@/preview/KitPreview'

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

/** The one page ("/"). Stage 0 shows the kit preview; Stage 3 replaces it with the journey. */
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
        <SiteHeader>
          <span className="hud-label hidden text-muted-foreground sm:inline" aria-hidden>
            //
          </span>
          <span className="hud-label truncate text-foreground/85">Kit preview</span>
        </SiteHeader>
        <main id="main" className="flex-1">
          <PageBoundary>
            <KitPreview />
          </PageBoundary>
        </main>
        <SiteFooter />
      </div>
    </TooltipProvider>
  )
}
