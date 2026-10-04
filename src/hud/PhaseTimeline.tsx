import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export interface TimelinePhase {
  id: string
  label: string
}

/**
 * Bottom timeline: a hairline track with a tick per journey phase. The active
 * tick glows and the progress line is signal cyan. Click a tick to jump, or use
 * ←/→ (Home/End) while a tick has focus.
 */
export function PhaseTimeline({
  phases,
  active,
  onSelect,
  progress,
  className,
}: {
  phases: readonly TimelinePhase[]
  active: string
  onSelect: (id: string) => void
  /** 0..1 progress through the whole journey. Defaults to the active phase's position. */
  progress?: number
  className?: string
}) {
  const idx = Math.max(0, phases.findIndex((p) => p.id === active))
  const raw = progress ?? idx / Math.max(1, phases.length - 1)
  const p = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0
  const go = (n: number, list: HTMLElement) => {
    const i = Math.min(phases.length - 1, Math.max(0, n))
    onSelect(phases[i].id)
    ;(list.querySelectorAll('button')[i] as HTMLButtonElement | undefined)?.focus()
  }
  return (
    <nav aria-label="Journey phases" className={cn('relative', className)}>
      <div className="relative mx-2 h-px bg-hud-line" aria-hidden>
        <div className="absolute inset-y-0 left-0 bg-signal/80" style={{ width: `${p * 100}%` }} />
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_12px_var(--signal)]"
          style={{ left: `${p * 100}%` }}
        />
      </div>
      {/* On a phone the ticks sit in two rows, so every one stays a 40 px touch target. */}
      <ol
        className="mt-2 grid grid-cols-[repeat(var(--half),minmax(0,1fr))] gap-y-1 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] sm:gap-y-0"
        style={{ '--n': phases.length, '--half': Math.ceil(phases.length / 2) } as CSSProperties}
        onKeyDown={(e) => {
          // Step from the tick that has focus (the active one unless the journey moved on since).
          const buttons = [...e.currentTarget.querySelectorAll('button')]
          const at = buttons.indexOf(e.target as HTMLButtonElement)
          const from = at >= 0 ? at : idx
          const moves: Record<string, number> = { ArrowRight: from + 1, ArrowLeft: from - 1, Home: 0, End: phases.length - 1 }
          if (e.key in moves) {
            e.preventDefault()
            go(moves[e.key], e.currentTarget)
          }
        }}
      >
        {phases.map((ph, i) => (
          <li key={ph.id} className="flex justify-center">
            <button
              type="button"
              onClick={() => onSelect(ph.id)}
              aria-current={ph.id === active ? 'step' : undefined}
              aria-label={`Phase ${i + 1}: ${ph.label}`}
              title={ph.label}
              className={cn(
                'hud-label flex min-h-10 w-full min-w-0 flex-col items-center justify-start gap-1 rounded-sm px-0.5 pt-1 transition-colors hover:text-foreground',
                ph.id === active ? 'text-signal' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn('block h-1.5 w-px', ph.id === active ? 'bg-signal shadow-[0_0_8px_var(--signal)]' : i <= idx ? 'bg-signal/60' : 'bg-hud-line')}
              />
              <span aria-hidden className={ph.id === active ? 'text-signal' : 'text-muted-foreground'}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span aria-hidden className="hidden max-w-full truncate xl:block">
                {ph.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
