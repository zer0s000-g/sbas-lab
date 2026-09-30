import { useCallback } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import { withAlpha } from '@/lib/color'
import { cn } from '@/lib/utils'

export interface StanfordPoint {
  errM: number
  plM: number
}

const LO = 0.1
const HI = 10_000
const lg = (v: number) => Math.log10(Math.min(HI, Math.max(LO, v)))

/**
 * The Stanford chart: each point is one moment of the flight, the position error
 * across, the protection level up (log scales). Above the diagonal the protection level
 * bounds the error, as it must; the alert limit of the current operation splits
 * "available" from "unavailable". Region names are written on the chart.
 */
export function StanfordChart({ getPoints, alM, label, className }: { getPoints: () => StanfordPoint[]; alM: number | null; label: string; className?: string }) {
  const draw = useCallback<DrawFn>(
    (ctx, { width, height, tokens }) => {
      const pad = { l: 30, r: 8, t: 8, b: 22 }
      const w = Math.max(10, width - pad.l - pad.r)
      const h = Math.max(10, height - pad.t - pad.b)
      const X = (v: number) => pad.l + ((lg(v) - lg(LO)) / (lg(HI) - lg(LO))) * w
      const Y = (v: number) => pad.t + h - ((lg(v) - lg(LO)) / (lg(HI) - lg(LO))) * h
      ctx.fillStyle = tokens['scope-bg']
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = tokens['scope-grid']
      ctx.lineWidth = 1
      ctx.font = `9px ${tokens.fontMono}`
      ctx.fillStyle = tokens['scope-dim']
      for (const v of [0.1, 1, 10, 100, 1000, 10000]) {
        ctx.beginPath()
        ctx.moveTo(X(v), pad.t)
        ctx.lineTo(X(v), pad.t + h)
        ctx.moveTo(pad.l, Y(v))
        ctx.lineTo(pad.l + w, Y(v))
        ctx.stroke()
        const t = v >= 1000 ? `${v / 1000}k` : String(v)
        ctx.textAlign = 'center'
        ctx.fillText(t, X(v), height - 8)
        ctx.textAlign = 'right'
        ctx.fillText(t, pad.l - 3, Y(v) + 3)
      }
      // Diagonal: error = protection level.
      ctx.strokeStyle = tokens['scope-warning']
      ctx.beginPath()
      ctx.moveTo(X(LO), Y(LO))
      ctx.lineTo(X(HI), Y(HI))
      ctx.stroke()
      if (alM) {
        ctx.strokeStyle = tokens['scope-trace-2']
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(pad.l, Y(alM))
        ctx.lineTo(pad.l + w, Y(alM))
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = tokens['scope-trace-2']
        ctx.textAlign = 'left'
        ctx.fillText('alert limit', pad.l + 4, Y(alM) - 3)
      }
      ctx.fillStyle = tokens['scope-dim']
      ctx.textAlign = 'left'
      ctx.fillText('bounded', pad.l + 4, pad.t + 10)
      ctx.textAlign = 'right'
      ctx.fillText('misleading', pad.l + w - 2, pad.t + h - 4)
      ctx.fillStyle = withAlpha(tokens['scope-trace'], 0.7)
      for (const p of getPoints()) {
        if (!Number.isFinite(p.errM) || !Number.isFinite(p.plM)) continue
        ctx.fillRect(X(p.errM) - 1.5, Y(p.plM) - 1.5, 3, 3)
      }
    },
    [getPoints, alM],
  )
  return <Canvas2D draw={draw} label={label} className={cn('aspect-[4/3]', className)} />
}
