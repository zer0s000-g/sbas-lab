import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { HudButton } from '@/hud/Controls'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import { useReducedMotion } from '@/stores/prefs'
import { cn } from '@/lib/utils'
import { SBAS_CHAIN, type SbasSystem } from '@/content/sbasSystems'

/** Seconds each step stays lit while playing. */
const STEP_S = 3.2

/** The glyph of each step (design.md §2 shapes: satellite, triangle, square, dish, diamond, aircraft, runway). */
function Glyph({ id, lit }: { id: string; lit: boolean }) {
  const sig = lit ? 'stroke-signal' : 'stroke-signal/60'
  const brass = lit ? 'stroke-brass fill-brass/25' : 'stroke-brass/60 fill-none'
  return (
    <svg viewBox="0 0 40 40" className="size-10 shrink-0" aria-hidden>
      {id === 'gnss' && (
        <g className={sig} strokeWidth={1.6} fill="none">
          <rect x="15" y="15" width="10" height="10" />
          <path d="M5 17h8v6H5zM27 17h8v6h-8z" />
          <path d="M20 25v6M14 34c4-3 8-3 12 0" strokeDasharray="2 2" />
        </g>
      )}
      {id === 'reference' && <path d="M20 8l12 22H8z" className={brass} strokeWidth={1.6} />}
      {id === 'master' && <rect x="9" y="9" width="22" height="22" className={brass} strokeWidth={1.6} />}
      {id === 'uplink' && (
        <g className={brass} strokeWidth={1.6}>
          <path d="M8 26a14 14 0 0 1 20-14z" />
          <path d="M20 22l9-13M18 30h8" fill="none" />
        </g>
      )}
      {id === 'geo' && <path d="M20 7l13 13-13 13L7 20z" className={brass} strokeWidth={1.6} />}
      {id === 'aircraft' && <path d="M20 6l3 11 11 6v3l-11-3-1 8 4 3v2l-6-2-6 2v-2l4-3-1-8-11 3v-3l11-6z" className={lit ? 'fill-foreground' : 'fill-foreground/60'} />}
      {id === 'approach' && (
        <g strokeWidth={1.6} fill="none">
          <path d="M14 34l4-26h4l4 26" className={lit ? 'stroke-foreground' : 'stroke-foreground/60'} />
          <path d="M20 12v4M20 20v4M20 28v4" className={sig} />
        </g>
      )}
    </svg>
  )
}

/** The figure a step shows for the chosen system, from its sources. */
function figure(id: string, s: SbasSystem): string {
  const n = (v: number | null, what: string) => (v === null ? `${what}: not published` : `${v} ${what}`)
  switch (id) {
    case 'gnss':
      return 'GPS L1 C/A'
    case 'reference':
      return n(s.ground.reference, 'reference stations')
    case 'master':
      return n(s.ground.master, 'master stations')
    case 'uplink':
      return s.id === 'egnos' ? '2 uplink stations per GEO' : n(s.ground.uplink, 'uplink stations')
    case 'geo':
      return `${s.geos.filter((g) => g.role === 'operational').length || 'no'} operational GEO${s.geos.filter((g) => g.role === 'operational').length === 1 ? '' : 's'}`
    case 'aircraft':
      return 'SBAS receiver (RTCA DO-229)'
    default:
      return s.services.length ? s.services[s.services.length - 1].level : 'No aviation service yet'
  }
}

/**
 * How SBAS works, end to end, in seven fixed steps: a lit step and its caption, with
 * signals travelling along the links (cyan: GPS ranging signals; brass, dashed: the SBAS
 * correction path). Plays on its own unless the learner prefers reduced motion; ←/→
 * step through it. The figures come from the chosen system.
 */
export function SbasChain({ system }: { system: SbasSystem }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(!reduced)
  const phase = useRef(0)
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    if (reduced) setPlaying(false)
  }, [reduced])

  useAnimationFrame(
    (dt) => {
      if (!playing) return
      phase.current += dt / STEP_S
      if (phase.current >= 1) {
        phase.current = 0
        setStep((s) => (s + 1) % SBAS_CHAIN.length)
      }
      // The pulse leaving the lit step travels along its link (CSS percentages, no re-render).
      dots.current.forEach((d, i) => {
        if (!d) return
        d.style.opacity = i === step ? '1' : '0'
        d.style.setProperty('--p', String(Math.min(1, phase.current * 1.25)))
      })
    },
    playing && !reduced,
  )

  const go = (d: number) => {
    phase.current = 0
    setStep((s) => (s + d + SBAS_CHAIN.length) % SBAS_CHAIN.length)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    }
  }
  const cur = SBAS_CHAIN[step]
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-7 lg:gap-0" aria-label="The SBAS chain, step by step" onKeyDown={onKey}>
        {SBAS_CHAIN.map((c, i) => {
          const lit = i === step
          const brassLink = i >= 1 && i <= 4
          return (
            <li key={c.id} className="relative flex lg:flex-col">
              <button
                type="button"
                onClick={() => {
                  phase.current = 0
                  setStep(i)
                }}
                aria-current={lit ? 'step' : undefined}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-[4px] border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:mx-1 lg:min-h-36 lg:w-auto lg:flex-col lg:justify-center lg:text-center',
                  lit ? 'border-signal bg-signal/10 shadow-[0_0_10px_var(--signal)]' : 'border-hud-line hover:border-foreground/40',
                )}
              >
                <Glyph id={c.id} lit={lit} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="hud-label text-foreground">
                    <span className="text-muted-foreground">{i + 1} · </span>
                    {c.title}
                  </span>
                  <span className="text-[11.5px] leading-4 text-muted-foreground">{figure(c.id, system)}</span>
                </span>
              </button>
              {i < SBAS_CHAIN.length - 1 && (
                // The link to the next step: down on phones, right on wide screens.
                <span aria-hidden className="pointer-events-none absolute left-7 top-full z-10 h-2 w-px lg:left-auto lg:right-[-4px] lg:top-1/2 lg:h-px lg:w-2">
                  <span className={cn('absolute inset-0', brassLink ? 'border-l border-dashed border-brass lg:border-l-0 lg:border-t' : 'bg-signal/70')} />
                  {!reduced && (
                    <span
                      ref={(el) => {
                        dots.current[i] = el
                      }}
                      className={cn('absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 [left:50%] [top:calc(var(--p,0)*100%)] lg:[left:calc(var(--p,0)*100%)] lg:[top:50%]', brassLink ? 'bg-brass shadow-[0_0_6px_var(--brass)]' : 'bg-signal shadow-[0_0_6px_var(--signal)]')}
                    />
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-3 rounded-[4px] border border-hud-line p-3 md:flex-row md:items-center">
        <p className="min-h-[3.75rem] flex-1 text-[14px] leading-5 text-foreground" aria-live="polite">
          <span className="hud-label mr-2 text-signal">
            Step {step + 1} of {SBAS_CHAIN.length} · {cur.title}
          </span>
          <br />
          {cur.text}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <HudButton aria-label="Previous step" onClick={() => go(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </HudButton>
          <HudButton aria-label={playing ? 'Pause the animation' : 'Play the animation'} onClick={() => setPlaying((p) => !p)} active={playing} disabled={reduced}>
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </HudButton>
          <HudButton aria-label="Next step" onClick={() => go(1)}>
            <ChevronRight className="size-4" aria-hidden />
          </HudButton>
        </div>
      </div>
      <p className="text-[11.5px] leading-4 text-muted-foreground">
        Cyan: GPS ranging signals and the protection level. Brass, dashed: the SBAS correction path. Every SBAS in civil aviation follows this chain (ICAO Annex 10); the figures are those of {system.name}.
        {reduced ? ' Motion is reduced: step through with the buttons or the arrow keys.' : ' Use ← and → on a step to move through it.'}
      </p>
    </div>
  )
}
