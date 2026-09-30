import { useCallback } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import { withAlpha } from '@/lib/color'
import type { SatDot } from '@/page/model'
import { cn } from '@/lib/utils'

/**
 * Satellites by azimuth and elevation as LAB201 sees them. Shapes carry the meaning
 * (never colour alone): GPS used = filled circle, tracked but not used = hollow circle,
 * lost or excluded = crossed, SBAS GEO = diamond. North up, horizon at the rim.
 */
export function SkyPlot({ getSats, label, className }: { getSats: () => SatDot[]; label: string; className?: string }) {
  const draw = useCallback<DrawFn>(
    (ctx, { width, height, tokens }) => {
      const r = Math.max(4, Math.min(width, height) / 2 - 14)
      const cx = width / 2
      const cy = height / 2
      ctx.fillStyle = tokens['scope-bg']
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = tokens['scope-grid']
      ctx.lineWidth = 1
      for (const k of [1, 2 / 3, 1 / 3]) {
        ctx.beginPath()
        ctx.arc(cx, cy, r * k, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()
      ctx.fillStyle = tokens['scope-dim']
      ctx.font = `9px ${tokens.fontMono}`
      ctx.textAlign = 'center'
      ctx.fillText('N', cx, cy - r - 4)
      for (const s of getSats()) {
        const d = r * (1 - Math.max(0, s.elDeg) / 90)
        const a = (s.azDeg * Math.PI) / 180
        const x = cx + Math.sin(a) * d
        const y = cy - Math.cos(a) * d
        if (s.kind === 'geo') {
          ctx.strokeStyle = tokens['scope-trace-2']
          ctx.fillStyle = withAlpha(tokens['scope-trace-2'], s.state === 'lost' ? 0 : 0.85)
          ctx.beginPath()
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x + 6, y)
          ctx.lineTo(x, y + 6)
          ctx.lineTo(x - 6, y)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          continue
        }
        const lost = s.state === 'lost' || s.state === 'excluded'
        ctx.strokeStyle = lost ? tokens['scope-alert'] : tokens['scope-trace']
        ctx.fillStyle = tokens['scope-trace']
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(x, y, 4.2, 0, Math.PI * 2)
        if (s.state === 'used') ctx.fill()
        else ctx.stroke()
        if (lost) {
          ctx.beginPath()
          ctx.moveTo(x - 5, y - 5)
          ctx.lineTo(x + 5, y + 5)
          ctx.stroke()
        }
      }
    },
    [getSats],
  )
  return <Canvas2D draw={draw} label={label} className={cn('aspect-square', className)} />
}
