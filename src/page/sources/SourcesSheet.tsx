import { Suspense } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HudButton } from '@/hud/Controls'
import { lazyRetry } from '@/lib/lazyRetry'
import { StageBoundary } from '@/stage/StageBoundary'
import { useSources } from './store'

// The registry's text loads only when the sheet opens (design.md §7: lightest asset first).
const SourcesList = lazyRetry(() => import('./SourcesList'))

/** The top bar's Sources button. */
export function SourcesButton() {
  const show = useSources((s) => s.show)
  return (
    <HudButton onClick={() => show()} aria-label="Sources and review status">
      <BookOpenCheck aria-hidden />
      <span className="hidden lg:inline">Sources</span>
    </HudButton>
  )
}

/**
 * Every claim the scenario makes, with its sources and how far it has been checked
 * (src/content/claims). Opened from the top bar, or from a phase's source line.
 */
export function SourcesSheet() {
  const open = useSources((s) => s.open)
  const setOpen = useSources((s) => s.setOpen)
  const focus = useSources((s) => s.focus)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-hud-line pr-12">
          <SheetTitle className="hud-title text-[14px]">Sources and review status</SheetTitle>
          <SheetDescription className="text-[13px] leading-5">
            Every fact this scenario shows, where it comes from, and how far it has been checked. Values in the code are tested against these entries.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <StageBoundary
            fallback={({ retry }) => (
              <div role="status" className="flex flex-col items-start gap-2 p-4 text-[13px] text-muted-foreground">
                <p>The sources could not be loaded.</p>
                <HudButton onClick={retry}>Try again</HudButton>
              </div>
            )}
          >
            <Suspense fallback={<p className="hud-label p-4">Loading the sources…</p>}>
              <SourcesList focus={focus} />
            </Suspense>
          </StageBoundary>
        )}
      </SheetContent>
    </Sheet>
  )
}
