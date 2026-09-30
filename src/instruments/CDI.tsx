import type { ApproachMode } from '@/core/receiver'
import type { Deviations } from '@/core/approach'
import { cn } from '@/lib/utils'

/**
 * A course deviation indicator with the approach mode annunciator: lateral deviation
 * as a vertical bar, vertical deviation as a diamond on the right-hand scale, and flags
 * when there is no guidance. Instrument colours stay dark in both themes.
 */
export function CDI({ dev, mode, className }: { dev: Deviations | null; mode: ApproachMode; className?: string }) {
  const lat = dev ? dev.lateralFs : 0
  const ver = dev ? dev.verticalFs : 0
  const hasLat = !!dev && mode !== 'NONE'
  const hasVert = !!dev && (mode === 'LPV' || mode === 'LNAV/VNAV')
  const label = `Course deviation indicator. Mode ${mode}. ${hasLat ? `Lateral ${(lat * 2.5).toFixed(1)} dots ${lat > 0 ? 'right of course' : lat < 0 ? 'left of course' : 'on course'}` : 'No lateral guidance'}. ${hasVert ? `Vertical ${(ver * 2.5).toFixed(1)} dots ${ver > 0 ? 'high' : ver < 0 ? 'low' : 'on path'}` : 'No vertical guidance'}.`
  // The bar shows where the course is: right of course means the bar is to the left.
  const barX = 60 - lat * 40
  const diamondY = 60 + ver * 40
  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      <svg viewBox="0 0 132 120" className="w-full max-w-[220px]" role="img" aria-label={label}>
        <rect x="2" y="2" width="116" height="116" rx="10" className="fill-instrument-face stroke-instrument-bezel" strokeWidth="2" />
        {[-2, -1, 1, 2].map((d) => (
          <circle key={d} cx={60 + d * 16} cy="60" r="2.2" className="fill-none stroke-instrument-marking" strokeWidth="1" />
        ))}
        <path d="M60 14 L66 26 L54 26 Z" className="fill-instrument-marking" />
        {hasLat ? <rect x={barX - 1.5} y="24" width="3" height="72" className="fill-instrument-accent" /> : null}
        <line x1="54" y1="60" x2="66" y2="60" className="stroke-instrument-marking" strokeWidth="1.5" />
        {/* The vertical scale on the right. */}
        <rect x="120" y="18" width="10" height="84" rx="2" className="fill-instrument-face stroke-instrument-bezel" />
        {[-2, -1, 1, 2].map((d) => (
          <circle key={d} cx="125" cy={60 + d * 16} r="1.8" className="fill-none stroke-instrument-marking" strokeWidth="1" />
        ))}
        {hasVert ? <path d={`M125 ${diamondY - 5} L129 ${diamondY} L125 ${diamondY + 5} L121 ${diamondY} Z`} className="fill-instrument-accent" /> : null}
        <text x="60" y="110" textAnchor="middle" className={cn('font-mono text-[11px]', mode === 'NONE' ? 'fill-instrument-flag' : 'fill-instrument-accent')}>
          {mode === 'NONE' ? 'NO GNSS APPR' : mode}
        </text>
        {!hasVert && dev ? (
          <text x="125" y="14" textAnchor="middle" className="fill-instrument-flag font-mono text-[7px]">
            V
          </text>
        ) : null}
      </svg>
    </figure>
  )
}
