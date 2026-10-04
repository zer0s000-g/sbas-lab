import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useAnimationFrame } from '@/hooks/useAnimationFrame'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSampled } from '@/hooks/useSampled'
import { HudButton } from '@/hud/Controls'
import { MissionClock } from '@/hud/MissionClock'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SiteHeader } from '@/components/SiteHeader'
import { PanelBoundary } from '@/components/PanelBoundary'
import { ScenarioBar } from '@/components/ScenarioBar'
import { SourcesButton, SourcesSheet } from './sources/SourcesSheet'
import { lazyRetry } from '@/lib/lazyRetry'
import { SCENARIO } from '@/scenarios/active'
import { cn } from '@/lib/utils'
import { directionFor } from '@/journey/director'
import { getJourney, useJourneyState } from '@/journey/store'
import { PHASES } from '@/journey/phases'
import { systemPrefersReducedMotion, usePrefs } from '@/stores/prefs'
import type { StanfordPoint } from '@/instruments/StanfordChart'
import { viewModel, type ViewModel } from './model'
import { BenefitCard, CockpitPanel, ControlsPanel, FlightCard, NowPanel, SignalsPanel, StatusPanel } from './panels'
import { JourneyStage, type ViewChoice } from './JourneyStage'

// The ESSP-SAS scenario's own panels (Break something, Service provision, real signal,
// assessment) load as one chunk, only in that scenario.
const EsspToolkit = SCENARIO.id === 'essp' ? lazyRetry(() => import('./essp/Toolkit')) : null

/** The one page: LAB201 gate to gate (design.md §4). */
export default function JourneyPage() {
  const guidedStops = usePrefs((s) => s.guidedStops)
  const setGuidedStops = usePrefs((s) => s.setGuidedStops)
  const [engine] = useState(() => {
    const reduced = usePrefs.getState().reducedMotionOverride ?? systemPrefersReducedMotion()
    // With reduced motion the journey waits for Play.
    return getJourney({ guidedStops: usePrefs.getState().guidedStops, running: !reduced })
  })
  useEffect(() => engine.setGuidedStops(guidedStops), [engine, guidedStops])
  useAnimationFrame((dt) => engine.advance(dt))
  const phase = useJourneyState(engine, (s) => s.phase)
  const running = useJourneyState(engine, (s) => s.running)
  const stop = useJourneyState(engine, (s) => s.stop)
  const speedMode = useJourneyState(engine, (s) => s.speedMode)
  useJourneyState(engine, (s) => s.failures)
  // The model is rebuilt only when the world has moved on (a tick, signal time or a
  // discrete change), so a paused or stopped journey does not re-render the page.
  const modelCache = useRef<{ tick: number; signalS: number; state: unknown; m: ViewModel } | null>(null)
  const m = useSampled(
    () => {
      const c = modelCache.current
      if (c && c.tick === engine.tick && c.signalS === engine.signalS && c.state === engine.state) return c.m
      const next = viewModel(engine)
      modelCache.current = { tick: engine.tick, signalS: engine.signalS, state: engine.state, m: next }
      return next
    },
    100,
    Object.is,
  )
  const progress = useSampled(() => engine.progress, 200)
  const [viewChoice, setViewChoice] = useState<ViewChoice>('auto')
  const view = viewChoice === 'auto' ? directionFor(phase).view : viewChoice
  const wide = useMediaQuery('(min-width: 1024px)')
  const phone = useMediaQuery('(max-width: 767px)')

  // The Stanford chart's points: one per second of real time while the world moves; cleared
  // when the journey goes back (a jump back or a reset seen at the next sample).
  const points = useRef<StanfordPoint[]>([])
  const lastTick = useRef(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (engine.tick < lastTick.current) points.current = []
      if (engine.tick === lastTick.current) return
      lastTick.current = engine.tick
      const f = viewModel(engine).nav
      if (f) points.current.push({ errM: f.horizontalErrorM, plM: f.hplM })
      if (points.current.length > 900) points.current.shift()
    }, 1000)
    return () => window.clearInterval(id)
  }, [engine])

  const approachPhase = m.approachPhase
  const playLabel = stop ? 'Continue' : running ? 'Pause the journey' : 'Play the journey'
  const header = (
    <SiteHeader
      actions={
        <>
          <MissionClock className="mr-2 hidden sm:flex" getTimeS={() => engine.worldS} speed={engine.speed} frozen={m.frozen} auto={speedMode === 'auto'} running={running && !stop} />
          <SourcesButton />
          <HudButton variant="solid" onClick={() => engine.toggle()} aria-label={playLabel}>
            {running && !stop ? <Pause aria-hidden /> : <Play aria-hidden />}
            <span className="hidden md:inline">{running && !stop ? 'Pause' : stop ? 'Continue' : 'Play'}</span>
          </HudButton>
        </>
      }
    >
      <span className="hud-label hidden text-muted-foreground sm:inline" aria-hidden>
        //
      </span>
      <span className="hud-label truncate text-foreground/85">
        {String(m.phaseNo).padStart(2, '0')} · {PHASES[m.phaseNo - 1].label}
      </span>
      {/* The approach mode annunciator from the descent on; before that, what LAB201 navigates with. */}
      {approachPhase ? (
        <span
          className={cn(
            'hud-value hidden rounded-[3px] border px-1.5 py-0.5 text-[10.5px] tracking-wider sm:inline',
            m.mode === 'LPV' ? 'border-success/60 text-success' : m.mode === 'NONE' ? 'border-destructive/60 text-destructive' : 'border-hud-line text-foreground/85',
          )}
          aria-label={`Approach mode ${m.mode === 'NONE' ? 'none' : m.mode}`}
        >
          {m.mode === 'NONE' ? 'NO APPR' : m.modeText.toUpperCase()}
        </span>
      ) : (
        <span className="hud-value hidden rounded-[3px] border border-hud-line px-1.5 py-0.5 text-[10.5px] tracking-wider text-foreground/85 sm:inline" aria-label={`Navigating with ${m.navSource === 'sbas' ? 'SBAS' : m.navSource === 'abas' ? 'GPS alone' : 'no GNSS'}`}>
          {m.navSource === 'sbas' ? 'SBAS' : m.navSource === 'abas' ? 'GPS ALONE' : 'NO GNSS'}
        </span>
      )}
    </SiteHeader>
  )

  const toolkit = (part: 'left' | 'right' | 'all') =>
    EsspToolkit && (
      <PanelBoundary name="The EGNOS panels">
        <EsspToolkit engine={engine} nowS={m.worldS} part={part} />
      </PanelBoundary>
    )
  const left = (
    <>
      <FlightCard m={m} />
      <NowPanel m={m} />
      {toolkit('left')}
    </>
  )
  const right = (
    <>
      <BenefitCard m={m} />
      <StatusPanel m={m} />
      <CockpitPanel m={m} />
      <SignalsPanel m={m} getPoints={() => points.current} />
      <ControlsPanel engine={engine} speedMode={speedMode} guidedStops={guidedStops} onGuidedStops={setGuidedStops} />
      {toolkit('right')}
    </>
  )
  const stage = (
    <JourneyStage
      engine={engine}
      m={m}
      progress={progress}
      view={view}
      viewChoice={viewChoice}
      onViewChoice={setViewChoice}
      speed={engine.speed}
      stop={stop}
      inlineTimeline={!phone}
      className={wide ? 'h-[calc(100svh-6rem)] min-h-[640px]' : phone ? 'h-[56svh] min-h-[300px] rounded-md border border-hud-line' : 'h-[520px] rounded-md border border-hud-line'}
    />
  )

  return (
    <>
      {header}
      <ScenarioBar />
      <SourcesSheet />
      <main id="main" className="flex-1">
        {wide ? (
          <div className="relative [--col:300px] min-[1440px]:[--col:340px]">
            {stage}
            {/* Two glass columns over the view (design.md §4). They scroll when the panels are tall, so they take keyboard focus. */}
            <div role="region" aria-label="Flight and phase panels" tabIndex={0} className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-[calc(var(--col)+2rem)] flex-col gap-3 overflow-y-auto p-4 [&>*]:pointer-events-auto">
              {left}
            </div>
            <div role="region" aria-label="SBAS and cockpit panels" tabIndex={0} className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[calc(var(--col)+2rem)] flex-col gap-3 overflow-y-auto p-4 [&>*]:pointer-events-auto">
              {right}
            </div>
          </div>
        ) : phone ? (
          <div className="flex flex-col gap-4 px-3 py-3">
            {/* Opaque, so the panels scrolling under it never show through the timeline; not
                sticky on a phone held sideways, where the strip would fill the whole screen. */}
            <div className="sticky top-14 z-30 -mx-3 bg-background px-3 pb-1 [@media(max-height:500px)]:static">{stage}</div>
            <Tabs defaultValue="now">
              <TabsList className="w-full">
                <TabsTrigger value="now">Now</TabsTrigger>
                <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
                <TabsTrigger value="signals">Signals</TabsTrigger>
                {EsspToolkit && <TabsTrigger value="egnos">EGNOS</TabsTrigger>}
              </TabsList>
              <TabsContent value="now" className="mt-3 flex flex-col gap-3">
                <NowPanel m={m} />
                <BenefitCard m={m} />
                <FlightCard m={m} />
              </TabsContent>
              <TabsContent value="cockpit" className="mt-3 flex flex-col gap-3">
                <StatusPanel m={m} />
                <CockpitPanel m={m} />
                <ControlsPanel engine={engine} speedMode={speedMode} guidedStops={guidedStops} onGuidedStops={setGuidedStops} />
              </TabsContent>
              <TabsContent value="signals" className="mt-3 flex flex-col gap-3">
                <SignalsPanel m={m} getPoints={() => points.current} />
              </TabsContent>
              {EsspToolkit && (
                <TabsContent value="egnos" className="mt-3 flex flex-col gap-3">
                  {toolkit('all')}
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-4">
            {stage}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex min-w-0 flex-col gap-4">{left}</div>
              <div className="flex min-w-0 flex-col gap-4">{right}</div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
