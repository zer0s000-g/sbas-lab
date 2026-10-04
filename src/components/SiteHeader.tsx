import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

/** The SBAS LAB wordmark: a GEO diamond over a hairline square. */
export function Wordmark() {
  return (
    <a href={import.meta.env.BASE_URL} className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-sm" aria-label="SBAS Lab, start of the page">
      <span className="relative grid size-6 place-items-center border border-foreground/60" aria-hidden>
        <span className="size-2 rotate-45 border border-brass" />
        <span className="absolute size-1 rounded-full bg-signal shadow-[0_0_6px_var(--signal)]" />
      </span>
      <span className="hud-title text-[12.5px] text-foreground">SBAS Lab</span>
    </a>
  )
}

/**
 * Top bar (design.md §4). `children` holds the journey status (phase name, mode
 * annunciator, clock); `actions` the play/pause and panel buttons. The theme
 * toggle is always last.
 */
export function SiteHeader({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hud-line bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 md:gap-4 md:px-8">
        <Wordmark />
        {children && <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
