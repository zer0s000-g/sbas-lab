import { useCallback, type ReactNode } from 'react'
import { Canvas2D, type DrawFn } from '@/components/Canvas2D'
import { HudPanel } from '@/hud/HudFrame'
import { mulberry32 } from '@/core/random'
import { withAlpha } from '@/lib/color'
import { cn } from '@/lib/utils'

/** A swatch: the token's colour as a CSS variable, never a literal. */
function Swatch({ token, shape, name, note }: { token: string; shape: ReactNode; name: string; note: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span
        className={cn('grid size-9 shrink-0 place-items-center rounded-[4px] border border-hud-line', token.startsWith('stage-') ? 'bg-stage-bg' : 'bg-background')}
        style={{ color: `var(--${token})` }}
      >
        {shape}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] leading-5 text-foreground">{name}</span>
        <span className="hud-label truncate">
          --{token} · {note}
        </span>
      </span>
    </li>
  )
}

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 20 20" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
    {children}
  </svg>
)

const MEANINGS = [
  { token: 'stage-signal', name: 'GPS satellite and ranging signal', note: 'satellite glyph, solid wire', shape: svg(<><rect x="7" y="7" width="6" height="6" /><path d="M2 10h5M13 10h5" /></>) },
  { token: 'stage-brass', name: 'GEO, SBAS broadcast, corrections', note: 'diamond glyph, dashed wire', shape: svg(<><path d="M10 3l6 7-6 7-6-7z" /></>) },
  { token: 'stage-brass', name: 'Reference, master and uplink stations', note: 'triangle, square, dish', shape: svg(<><path d="M3 16l4-7 4 7z" /><rect x="12" y="5" width="5" height="5" /></>) },
  { token: 'signal', name: 'Protection level (HPL, VPL)', note: 'filled glass cylinder', shape: svg(<><ellipse cx="10" cy="5" rx="5" ry="2" fill="currentColor" fillOpacity=".35" /><path d="M5 5v10M15 5v10" /><ellipse cx="10" cy="15" rx="5" ry="2" /></>) },
  { token: 'brass', name: 'Alert limit (HAL, VAL)', note: 'wireframe cylinder', shape: svg(<><ellipse cx="10" cy="5" rx="6" ry="2" strokeDasharray="2 1.5" /><path d="M4 5v10M16 5v10" strokeDasharray="2 1.5" /><ellipse cx="10" cy="15" rx="6" ry="2" strokeDasharray="2 1.5" /></>) },
  { token: 'stage-paint', name: 'True position', note: 'small cross, "truth"', shape: svg(<path d="M10 5v10M5 10h10" />) },
  { token: 'muted-foreground', name: 'GPS-only position', note: 'hollow circle, "GPS only"', shape: svg(<circle cx="10" cy="10" r="4.5" />) },
  { token: 'stage-alert', name: 'Integrity alert, "Do not use"', note: 'text flag', shape: svg(<><path d="M5 17V3M5 4h9l-2 3 2 3H5" /></>) },
  { token: 'stage-glass', name: 'Ionosphere', note: 'labelled shell, low alpha', shape: svg(<path d="M2 14c4-6 12-6 16 0" strokeOpacity=".6" strokeWidth="3" />) },
]

/** A tiny sky plot drawn on a 2D canvas from the theme tokens (the future SkyPlot instrument). */
function DemoSkyPlot() {
  const draw = useCallback<DrawFn>((ctx, { width, height, tokens }) => {
    const r = Math.min(width, height) / 2 - 18
    const cx = width / 2
    const cy = height / 2
    ctx.fillStyle = tokens['scope-bg']
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = tokens['scope-grid']
    ctx.lineWidth = 1
    for (const k of [1, 2 / 3, 1 / 3]) {
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(0, r * k), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy + r)
    ctx.stroke()
    ctx.fillStyle = tokens['scope-dim']
    ctx.font = `10px ${tokens.fontMono}`
    ctx.textAlign = 'center'
    ctx.fillText('N', cx, cy - r - 6)
    // Seeded placeholder satellites: used ones filled, one excluded (hollow, crossed).
    const rand = mulberry32(201)
    for (let i = 0; i < 9; i++) {
      const az = rand() * Math.PI * 2
      const el = 10 + rand() * 75
      const d = r * (1 - el / 90)
      const x = cx + Math.sin(az) * d
      const y = cy - Math.cos(az) * d
      const excluded = i === 4
      ctx.strokeStyle = tokens['scope-trace']
      ctx.fillStyle = withAlpha(tokens['scope-trace'], 0.85)
      ctx.beginPath()
      ctx.arc(x, y, 4.5, 0, Math.PI * 2)
      if (excluded) {
        ctx.strokeStyle = tokens['scope-alert']
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 6, y - 6)
        ctx.lineTo(x + 6, y + 6)
        ctx.stroke()
      } else ctx.fill()
    }
    ctx.save()
    ctx.translate(cx + r * 0.55, cy + r * 0.2)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = tokens['scope-trace-2']
    ctx.strokeRect(-4, -4, 8, 8)
    ctx.restore()
  }, [])
  return (
    <Canvas2D
      draw={draw}
      animate={false}
      label="Demo sky plot: nine GPS satellites by azimuth and elevation, eight used (filled) and one excluded (crossed), and one GEO (diamond). Placeholder positions."
      className="aspect-square w-full max-w-[260px] rounded-[4px] border border-hud-line"
    />
  )
}

export function KitTokens() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <HudPanel index="13" title="SBAS meanings" className="xl:col-span-1">
        <ul className="flex flex-col">
          {MEANINGS.map((m) => (
            <Swatch key={m.name} {...m} />
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted-foreground">Colour never works alone: every meaning has a shape or a label too.</p>
      </HudPanel>

      <HudPanel index="14" title="Type">
        <div className="flex flex-col gap-4">
          <div>
            <p className="hud-label mb-1">Display · Michroma</p>
            <p className="hud-title text-[20px] text-foreground">LPV engaged</p>
          </div>
          <div>
            <p className="hud-label mb-1">Reading · Inter Tight</p>
            <p className="prose-lab">
              Hikers estimate where they are from distant church bells. Surveyors at known spots hear the same bells and notice the north bell is three
              seconds late today, and a lookout on a tall tower shouts that correction to everyone.
            </p>
          </div>
          <div>
            <p className="hud-label mb-1">Data · JetBrains Mono</p>
            <p className="hud-value text-[15px] text-foreground">HPL 12.3 m · VPL 18.0 m · 1575.42 MHz</p>
          </div>
        </div>
      </HudPanel>

      <HudPanel index="15" title="Canvas from tokens">
        <div className="flex flex-col items-center gap-3">
          <DemoSkyPlot />
          <p className="text-[12px] text-muted-foreground">Scopes stay dark in both themes and read their colours with the theme tokens.</p>
        </div>
      </HudPanel>
    </div>
  )
}
