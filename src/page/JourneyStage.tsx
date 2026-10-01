import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Maximize2, RotateCcw, ZoomIn } from 'lucide-react'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { HudButton, Segmented } from '@/hud/Controls'
import { CornerBrackets } from '@/hud/HudFrame'
import { PhaseTimeline } from '@/hud/PhaseTimeline'
import { SkyPlot } from '@/instruments/SkyPlot'
import { lazyRetry } from '@/lib/lazyRetry'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/stores/prefs'
import { LazyStage } from '@/stage/LazyStage'
import type { Quality } from '@/stage/types'
import type { ViewId } from '@/journey/director'
import type { JourneyEngine, StopId } from '@/journey/engine'
import { NARRATION } from '@/journey/narration'
import { useJourneyState } from '@/journey/store'
import { PHASES, type PhaseId } from '@/journey/phases'
import { NetworkMap } from '@/views/NetworkMap'
import { FLIGHT_HONESTY, NETWORK_HONESTY, spaceHonesty } from '@/views/scales'
import { shotFor, type CameraButton } from '@/views/shots'
import { describe, type ViewModel } from './model'
import { StopCard } from './panels'

// Each scene holds all of its three.js code and loads with the 3D chunk (design.md §7).
const SpaceScene = lazyRetry(() => import('@/views/SpaceScene'))
const FlightScene = lazyRetry(() => import('@/views/FlightScene'))

export type ViewChoice = 'auto' | ViewId

export function JourneyStage({
  engine,
  m,
  progress,
  view,
  viewChoice,
  onViewChoice,
  speed,
  className,
  inlineTimeline,
  stop,
}: {
  engine: JourneyEngine
  m: ViewModel
  progress: number
  view: ViewId
  viewChoice: ViewChoice
  onViewChoice: (v: ViewChoice) => void
  speed: number
  className?: string
  /** Where the timeline goes: on the view (wide screens) or under it (phones). */
  inlineTimeline: boolean
  stop: StopId | null
}) {
  const reduced = useReducedMotion()
  // The timeline follows the engine at once (the sampled model can lag by 100 ms).
  const phase = useJourneyState(engine, (s) => s.phase)
  const [camera, setCamera] = useState<CameraButton | 'auto'>('auto')
  const [resetKey, setResetKey] = useState(0)
  // A new phase or view goes back to the director's shot.
  useEffect(() => setCamera('auto'), [m.phase, view])
  const shot = useMemo(() => shotFor(engine, view, camera), [engine, view, camera, m.phase, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // A short fade covers each view switch.
  const [fade, setFade] = useState(false)
  const lastView = useRef(view)
  useEffect(() => {
    if (lastView.current === view) return
    lastView.current = view
    if (reduced) return
    setFade(true)
    const id = window.setTimeout(() => setFade(false), 260)
    return () => window.clearTimeout(id)
  }, [view, reduced])
  const label = describe(m, view)
  const scene = useMemo(
    () => (t: ThemeTokens, q: Quality) => (view === 'space' ? <SpaceScene t={t} quality={q} /> : <FlightScene t={t} quality={q} />),
    [view],
  )
  const honesty = view === 'space' ? spaceHonesty(speed, m.frozen) : view === 'network' ? NETWORK_HONESTY : FLIGHT_HONESTY
  const narration = NARRATION[m.phase]
  const threeView = view === 'network' ? 'flight' : view

  const timeline = <PhaseTimeline phases={PHASES} active={phase} onSelect={(p) => engine.jumpTo(p as PhaseId)} progress={progress} />
  return (
    <div className="flex flex-col gap-2">
      <div data-view={view} data-phase={m.phase} className={cn('dark relative overflow-hidden bg-stage-bg text-foreground', className)}>
        <LazyStage
          shot={shot}
          label={label}
          className="absolute inset-0"
          fog={[40, 120]}
          scenery={threeView === 'space' ? 'studio' : 'world'}
          paused={view === 'network'}
          drift={threeView === 'space'}
        >
          {scene}
        </LazyStage>
        {view === 'network' && <NetworkMap engine={engine} label={label} className="absolute inset-x-0 top-24 bottom-28 md:top-28 md:bottom-32 lg:right-[calc(var(--col)+2rem)] lg:bottom-36 lg:left-[calc(var(--col)+2rem)]" />}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-20 bg-stage-bg transition-opacity duration-200', fade ? 'opacity-100' : 'opacity-0')} />
        <CornerBrackets />
        {/* Top scrim: the phase, and slow motion. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-stage-bg/90 via-stage-bg/50 to-transparent px-4 pt-4 pb-10 md:px-6 lg:px-[calc(var(--col)+2.5rem)]">
          <p className="hud-label flex items-center gap-2 text-foreground/85">
            <span className="inline-block size-1.5 bg-brass" aria-hidden />
            {String(m.phaseNo).padStart(2, '0')} · {PHASES[m.phaseNo - 1].label} · {view === 'space' ? 'Space view' : view === 'network' ? 'Network map' : 'Flight view'}
          </p>
          <h1 className="hud-title mt-1 text-[13px] leading-5 text-foreground sm:text-[16px] md:text-[18px] md:leading-6">{narration.title}</h1>
          {m.frozen && (
            <p className="hud-label mt-1 text-brass">
              Slowed down so you can see it · world frozen · {Math.max(0, Math.ceil(m.signalTotalS - m.signalS))} s
            </p>
          )}
        </div>
        {/* The sky-plot inset: the satellites LAB201 uses, whatever the view. */}
        <div className="absolute top-20 right-3 z-10 w-[104px] sm:w-[128px] md:right-5 lg:right-[calc(var(--col)+2.5rem)] lg:w-[150px]">
          <SkyPlot
            getSats={() => m.sats}
            label={`Sky plot: ${m.sats.filter((s) => s.kind === 'gps' && s.state === 'used').length} GPS satellites used, ${m.sats.filter((s) => s.state === 'lost' || s.state === 'excluded').length} lost or excluded, ${m.geosTracked} SBAS GEOs.`}
            className="w-full rounded-[4px] border border-hud-line"
          />
          <p className="hud-label mt-1 text-right text-[9.5px] text-foreground/75">Sky plot · N up</p>
        </div>
        {/* Bottom scrim: honesty label, view and camera controls, timeline. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-stage-bg/95 via-stage-bg/70 to-transparent px-3 pt-10 pb-3 md:px-6 lg:px-[calc(var(--col)+2.5rem)]">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="hud-label max-w-[48ch] text-[9.5px] leading-[13px] text-foreground/80 sm:text-[10.5px] sm:leading-[14px]">{honesty}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Segmented
                className="w-[260px] max-w-full"
                value={viewChoice}
                onChange={onViewChoice}
                options={[
                  { value: 'auto', label: 'Auto', ariaLabel: 'View: automatic' },
                  { value: 'space', label: 'Space', ariaLabel: 'View: space' },
                  { value: 'flight', label: 'Flight', ariaLabel: 'View: flight' },
                  { value: 'network', label: 'Map', ariaLabel: 'View: network map' },
                ]}
              />
              {view !== 'network' && (
                <div className="flex gap-1" role="group" aria-label="Camera">
                  <HudButton active={camera === 'follow'} onClick={() => setCamera('follow')} aria-label="Camera: follow">
                    <Crosshair aria-hidden />
                  </HudButton>
                  <HudButton active={camera === 'overview'} onClick={() => setCamera('overview')} aria-label="Camera: overview">
                    <Maximize2 aria-hidden />
                  </HudButton>
                  <HudButton active={camera === 'zoom'} onClick={() => setCamera('zoom')} aria-label="Camera: zoom">
                    <ZoomIn aria-hidden />
                  </HudButton>
                  <HudButton
                    onClick={() => {
                      setCamera('auto')
                      setResetKey((k) => k + 1)
                    }}
                    aria-label="Camera: reset"
                  >
                    <RotateCcw aria-hidden />
                  </HudButton>
                </div>
              )}
            </div>
          </div>
          {inlineTimeline && timeline}
        </div>
        {stop && (
          <StopCard stop={stop} onContinue={() => engine.continueFromStop()} className="absolute top-24 left-3 z-30 w-[min(360px,calc(100%-7.5rem))] md:left-6 lg:left-[calc(var(--col)+2.5rem)]" />
        )}
      </div>
      {!inlineTimeline && <div className="px-1">{timeline}</div>}
    </div>
  )
}
