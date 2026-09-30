import { useSampled } from '@/hooks/useSampled'
import { formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'

export function formatMissionTime(s: number): string {
  const t = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * The journey clock: world time since the gate, and the time-lapse factor
 * ("×16", or "SLOW-MO" while the world is frozen for a signal moment).
 */
export function MissionClock({
  getTimeS,
  speed,
  frozen = false,
  auto = false,
  running,
  className,
}: {
  getTimeS: () => number
  /** Current time-lapse factor. */
  speed: number
  /** A slow-motion signal moment is playing: the world clock stands still. */
  frozen?: boolean
  /** The director chooses the speed. */
  auto?: boolean
  running: boolean
  className?: string
}) {
  const t = useSampled(getTimeS, 250)
  const time = formatMissionTime(t)
  const rate = frozen ? 'Slow motion' : `${auto ? 'Auto ' : ''}${formatSpeed(speed)}`
  return (
    <div
      role="timer"
      className={cn('flex flex-col items-end gap-1', className)}
      aria-label={`Journey time ${time}, ${frozen ? 'world frozen for slow motion' : `time-lapse ${formatSpeed(speed)}`}${running ? '' : ', paused'}`}
    >
      <span className="hud-value text-[18px] leading-none text-foreground md:text-[20px]">{time}</span>
      <span className="hud-label flex items-center gap-1.5">
        <span className={frozen ? 'text-brass' : undefined}>{running ? rate : 'Paused'}</span>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn('inline-block h-[3px] w-3', i === Math.floor(t) % 4 && running && !frozen ? 'bg-signal' : 'bg-foreground/20')}
          />
        ))}
      </span>
    </div>
  )
}
