import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Maximize2, RotateCcw, ZoomIn } from 'lucide-react'
import type { ThemeTokens } from '@/hooks/useThemeTokens'
import { HudButton, Segmented } from '@/hud/Controls'
import { CornerBrackets } from '@/hud/HudFrame'
import { PhaseTimeline } from '@/hud/PhaseTimeline'
import { SkyPlot } from '@/instruments/SkyPlot'
import { lazyRetry } from '@/lib/lazyRetry'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/stores/prefs'
import { DeferredStage, StageFailurePoster, useWhenIdle } from '@/stage/LazyStage'
import { StageBoundary } from '@/stage/StageBoundary'
import type { Quality } from '@/stage/types'
import type { ViewId } from '@/journey/director'
import type { JourneyEngine, StopId } from '@/journey/engine'
import { NARRATION } from '@/journey/narration'
import { loadTerrainCoast } from '@/views/geo/scenarioCoast'
import { useJourneyState } from '@/journey/store'
import { PHASES, type PhaseId } from '@/journey/phases'
import { FLIGHT_HONESTY, NETWORK_HONESTY, spaceHonesty } from '@/views/scales'
import type { CameraButton } from '@/views/shots'
import { describe, type ViewModel } from './model'
import { StopCard } from './panels'

// Each scene holds all of its three.js code and loads with the 3D chunk (design.md §7).
const SpaceScene = lazyRetry(() => import('@/views/SpaceScene'))
// The terrain's coastline downloads alongside the scene code (views/geo/scenarioCoast).
const withCoast = <T,>(load: Promise<T>) => Promise.all([load, loadTerrainCoast()]).then(([m]) => m)
const FlightScene = lazyRetry(() => withCoast(import('@/views/FlightScene')))
// The stage and its camera shots (terrain, airports, the flight's track) load with the 3D chunk.
const JourneyScene = lazyRetry(() => withCoast(import('./JourneyScene')))
// The network map and its coastline data are needed only for two phases: they load once
// the page is idle, before the journey gets there, instead of with the first page load.
const loadNetworkMap = () => import('@/views/NetworkMap')
const NetworkMap = lazyRetry(() => loadNetworkMap().then((m) => ({ default: m.NetworkMap })))

export type ViewChoice = 'auto' | ViewId

const STAGE_FOG: [number, number] = [40, 120]

/** Where the network map sits on the stage: between the scrims (and the glass columns on wide screens). */
const MAP_BOX = 'absolute inset-x-0 top-24 bottom-28 md:top-28 md:bottom-32 lg:right-[calc(var(--col)+2rem)] lg:bottom-36 lg:left-[calc(var(--col)+2rem)]'

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
  const idle = useWhenIdle()
  useEffect(() => {
    if (idle) loadNetworkMap().catch(() => {}) // a failure shows when the map is opened
  }, [idle])
  // The timeline follows the engine at once (the sampled model can lag by 100 ms).
  const phase = useJourneyState(engine, (s) => s.phase)
  const [camera, setCamera] = useState<CameraButton | 'auto'>('auto')
  const [resetKey, setResetKey] = useState(0)
  // A new phase or view goes back to the director's shot.
  useEffect(() => setCamera('auto'), [m.phase, view])
  // A short fade covers each view switch.
  const [fade, setFade] = useState(false)
  const lastView = useRef(view)
  useEffect(() => {
    if (reduced) {
      // Also ends a fade that reduced motion interrupted.
      setFade(false)
      lastView.current = view
      return
    }
    if (lastView.current === view) return
    lastView.current = view
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
        <DeferredStage label={label} className="absolute inset-0">
          <JourneyScene
            engine={engine}
            view={view}
            camera={camera}
            phase={m.phase}
            resetKey={resetKey}
            label={label}
            className="absolute inset-0"
            fog={STAGE_FOG}
            scenery={threeView === 'space' ? 'studio' : 'world'}
            paused={view === 'network'}
            drift={threeView === 'space'}
          >
            {scene}
          </JourneyScene>
        </DeferredStage>
        {view === 'network' && (
          <StageBoundary fallback={(f) => <StageFailurePoster {...f} className={MAP_BOX} label={label} subject="Network map" />}>
            <Suspense fallback={null}>
              <NetworkMap engine={engine} label={label} className={MAP_BOX} />
            </Suspense>
          </StageBoundary>
        )}
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
              Slowed down so you can see it · world frozen · {formatNumber(Math.max(0, Math.ceil(m.signalTotalS - m.signalS)), 0)} s
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
