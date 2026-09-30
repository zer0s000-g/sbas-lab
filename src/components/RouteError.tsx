import { Component, useEffect, type ReactNode } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CornerBrackets } from '@/hud/HudFrame'
import { isChunkLoadError, resetFailedLazies } from '@/lib/lazyRetry'

/**
 * The page error screen (design.md §8): a crash, a stale chunk after a deploy, or
 * offline. It always offers Reload, never a retry loop. The header and footer stay.
 */
export function RouteError({ error }: { error: unknown }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const stale = !offline && isChunkLoadError(error)
  // The part that failed is no longer rendered: a reload downloads it again.
  useEffect(() => resetFailedLazies(), [error])
  return (
    <div role="alert" className="mx-auto max-w-[760px] px-4 py-20 md:px-10">
      <div className="relative px-6 py-10 md:px-10">
        <CornerBrackets inset={0} />
        <p className="hud-label mb-3 flex items-center gap-2 text-destructive">
          <TriangleAlert className="size-3.5" aria-hidden />
          {offline ? 'Offline' : stale ? 'Download failed' : 'Something went wrong'}
        </p>
        <h1 className="hud-title text-[24px] leading-8 text-foreground md:text-[30px]">
          {offline ? 'You are offline' : stale ? 'Part of this page could not be downloaded' : 'The page could not load'}
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-7 text-muted-foreground">
          {offline
            ? 'This page has not been saved for offline use yet. Once it has loaded while online it keeps working offline. Reconnect and reload.'
            : stale
              ? 'The connection may have dropped, or SBAS Lab was updated and this part of the page moved. Reloading fetches it again.'
              : 'The simulation hit an unexpected problem. Reloading usually fixes it.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCw aria-hidden /> Reload
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Catches a crash anywhere in the page body and shows RouteError instead of a blank page. */
export class PageBoundary extends Component<{ children: ReactNode }, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false }
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error(error)
  }
  render() {
    return this.state.failed ? <RouteError error={this.state.error} /> : this.props.children
  }
}
