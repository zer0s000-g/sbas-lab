import { Suspense, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { HudButton } from '@/hud/Controls'
import { isChunkLoadError } from '@/lib/lazyRetry'
import { StageBoundary } from '@/stage/StageBoundary'

/**
 * A lazily loaded optional panel: while it downloads nothing shows, and if it cannot
 * load or render, a small notice with a retry takes its place, so the journey and the
 * other panels carry on (design.md §8). Without it the failure would reach the page's
 * boundary and replace the whole page.
 */
export function PanelBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <StageBoundary
      fallback={({ error, retry, attempts }) => {
        const download = isChunkLoadError(error)
        const reload = attempts >= 2
        return (
          <div role="status" className="hud-panel flex flex-col gap-2 rounded-md p-3 text-[12.5px] leading-5 text-muted-foreground">
            <p>
              {name} {download ? 'could not be downloaded.' : 'could not be shown.'}
            </p>
            <HudButton onClick={reload ? () => window.location.reload() : retry}>
              <RotateCw aria-hidden /> {reload ? 'Reload page' : 'Try again'}
            </HudButton>
          </div>
        )
      }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </StageBoundary>
  )
}
