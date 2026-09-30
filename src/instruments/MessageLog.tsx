import type { LogRow } from '@/page/model'
import { cn } from '@/lib/utils'

/** The SBAS messages LAB201 has received, newest first, one per second (type and plain meaning). */
export function MessageLog({ rows, signal, className }: { rows: LogRow[]; signal: string; className?: string }) {
  // The newest row is marked; older rows stay at full contrast.
  if (rows.length === 0)
    return <p className={cn('hud-label text-destructive', className)}>No SBAS messages: no GEO signal received</p>
  return (
    <ol className={cn('flex flex-col', className)} aria-label={`Latest SBAS messages on ${signal}`}>
      {rows.map((r, i) => (
        <li key={`${r.second}-${i}`} className={cn('grid grid-cols-[3.2rem_2.6rem_1fr] items-baseline gap-2 border-b border-hud-line py-1 last:border-b-0')}>
          <span className="hud-value text-[11px] text-muted-foreground">
            {i === 0 && <span className="sr-only">Newest: </span>}
            {r.geo}
          </span>
          <span className={cn('hud-value text-[11px]', r.alarm ? 'text-destructive' : 'text-brass')}>MT{r.type}</span>
          <span className="min-w-0 text-[12px] leading-4 text-foreground">
            <span className={cn('block truncate', r.alarm && 'text-destructive')}>
              {r.alarm && 'ALARM · '}
              {r.name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{r.plain}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
