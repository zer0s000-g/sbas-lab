import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Placeholder with the stage's size and backdrop while the 3D chunk loads. */
export function StagePoster({ className, label, message, action }: { className?: string; label: string; message?: string; action?: ReactNode }) {
  return (
    <div className={cn('relative overflow-hidden bg-stage-bg', className)}>
      <div role="img" aria-label={label} className="absolute inset-0">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--hud-line)_1px,transparent_1px),linear-gradient(90deg,var(--hud-line)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_60%_60%,black,transparent_70%)]"
        />
        <p className={cn('hud-label absolute bottom-1/2 left-1/2 flex -translate-x-1/2 items-center gap-2', message ? 'text-foreground/85' : 'text-foreground/50')}>
          {!message && <span aria-hidden className="block size-1.5 animate-pulse rounded-full bg-signal motion-reduce:animate-none" />}
          {message ?? 'Loading 3D stage'}
        </p>
      </div>
      {action && <div className="absolute top-1/2 left-1/2 mt-4 -translate-x-1/2">{action}</div>}
    </div>
  )
}
