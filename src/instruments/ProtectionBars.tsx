import type { Operation } from '@/core/operations'
import type { Fix } from '@/core/receiver'
import { formatMetres } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * HPL against HAL and VPL against VAL as paired bars: the cyan bar is the protection
 * level, the brass tick is the alert limit. Past the limit the bar turns to the alarm
 * colour and says "over the limit" (never colour alone).
 */
export function ProtectionBars({ fix, op, className }: { fix: Fix | null; op: Operation | null; className?: string }) {
  const rows = [
    { name: 'HPL', al: 'HAL', pl: fix?.hplM ?? Number.NaN, limit: op?.halM ?? null },
    { name: 'VPL', al: 'VAL', pl: fix?.vplM ?? Number.NaN, limit: op?.valM ?? null },
  ]
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {rows.map((r) => {
        const has = Number.isFinite(r.pl)
        // The alert limit sits at 70 % of the bar so an overshoot stays visible.
        const scale = r.limit ? r.limit / 0.7 : Math.max(has ? r.pl * 1.4 : 1, 1)
        const f = has ? Math.min(1, r.pl / scale) : 0
        const over = has && r.limit !== null && r.pl > r.limit
        return (
          <div key={r.name} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="hud-label">
                {r.name}
                {r.limit !== null ? ` vs ${r.al}` : ''}
              </span>
              <span className={cn('hud-value text-[12px]', over ? 'text-destructive' : 'text-signal')}>
                {has ? formatMetres(r.pl) : r.name === 'VPL' ? 'none' : '—'}
                <span className="text-muted-foreground">{r.limit !== null ? ` / ${formatMetres(r.limit)}` : ''}</span>
                {over && <span className="ml-1">over the limit</span>}
              </span>
            </div>
            <div className="relative h-2 w-full rounded-[2px] bg-foreground/10" aria-hidden>
              <div className={cn('absolute inset-y-0 left-0 rounded-[2px]', over ? 'bg-destructive' : 'bg-signal')} style={{ width: `${f * 100}%` }} />
              {r.limit !== null && <div className="absolute -inset-y-1 w-0.5 bg-brass" style={{ left: '70%' }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
