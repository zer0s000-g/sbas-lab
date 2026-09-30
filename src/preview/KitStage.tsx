import { useEffect, useMemo, useState } from 'react'
import { Crosshair, Maximize2, RotateCcw, ZoomIn } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSampled } from '@/hooks/useSampled'
import { CornerBrackets } from '@/hud/HudFrame'
import { HudButton } from '@/hud/Controls'
import { MissionClock } from '@/hud/MissionClock'
import { PhaseTimeline } from '@/hud/PhaseTimeline'
import { formatMetres } from '@/lib/format'
import { lazyRetry } from '@/lib/lazyRetry'
import type { SimClock } from '@/hooks/useSimClock'
import { useClock } from '@/hooks/useSimClock'
import { LazyStage } from '@/stage/LazyStage'
import { APPROACH_HONESTY } from '@/stage/scale'
import type { Shot } from '@/stage/types'
import { AIRCRAFT, demo, DEMO_DIST_NM, DEMO_HAL_M, DEMO_VAL_M } from './demoState'

// The scene holds all three.js code, so it loads with the 3D chunk (design.md §7).
const DemoScene = lazyRetry(() => import('./DemoScene'))

/** The twelve journey phases (master prompt). Stage 2 moves them to src/journey/phases.ts. */
export const DEMO_PHASES = [
  { id: 'gate', label: 'Gate' },
  { id: 'takeoff', label: 'Taxi/Takeoff' },
  { id: 'climb', label: 'Climb' },
  { id: 'errors', label: 'Errors' },
  { id: 'reference', label: 'Reference' },
  { id: 'master', label: 'Master' },
  { id: 'uplink', label: 'Uplink' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'cruise', label: 'Cruise' },
  { id: 'descent', label: 'Descent' },
  { id: 'final', label: 'Final' },
  { id: 'landing', label: 'Landing' },
] as const

type ShotName = 'overview' | 'follow' | 'zoom'
const [ax, ay, az] = AIRCRAFT
const SHOTS: Record<ShotName, Shot> = {
  overview: { position: [4, 13, 19], target: [0, 0, 0], fov: 30 },
  // A portrait phone screen needs the camera further back to fit the table's width.
  follow: { position: [ax - 3.6, ay + 1.1, az + 1.6], target: [ax + 1.5, ay * 0.4, az], fov: 32 },
  zoom: { position: [ax + 0.2, ay + 0.1, az + 0.42], target: [ax, ay, az], fov: 30 },
}
const NARROW: Partial<Record<ShotName, Shot>> = {
  overview: { position: [3, 26, 34], target: [-1.5, 0, 0], fov: 32 },
  follow: { position: [ax - 4.4, ay + 1.6, az + 2.4], target: [ax + 1.2, ay * 0.4, az], fov: 40 },
  zoom: { position: [ax + 0.26, ay + 0.12, az + 0.56], target: [ax, ay, az], fov: 34 },
}

/** The demo stage with its HUD overlay, the way the journey page will frame each view. */
export function KitStage({ clock }: { clock: SimClock }) {
  const narrow = useMediaQuery('(max-width: 639px)')
  const shotFor = (n: ShotName) => ({ ...((narrow && NARROW[n]) || SHOTS[n]) })
  const [shotName, setShotName] = useState<ShotName>('overview')
  // A fresh object on reset, so the camera rig also drops the learner's drag.
  const [shot, setShot] = useState<Shot>(() => shotFor('overview'))
  useEffect(() => setShot(shotFor(shotName)), [narrow]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<string>('final')
  const running = useClock(clock, (s) => s.running)
  const speed = useClock(clock, (s) => s.speed)
  const frozen = useSampled(() => demo.frozen, 200)
  const pl = useSampled(() => ({ h: Math.round(demo.hplM), v: Math.round(demo.vplM) }), 1000)
  const pick = (n: ShotName) => {
    setShotName(n)
    setShot(shotFor(n))
  }
  const label = `Demo terrain table. LAB201 on final, ${DEMO_DIST_NM} NM from runway 09. HPL ${formatMetres(pl.h)} within HAL ${DEMO_HAL_M} m, VPL ${formatMetres(pl.v)} within VAL ${DEMO_VAL_M} m. Placeholder values.`
  const children = useMemo(() => (t: Parameters<typeof DemoScene>[0]['t'], q: Parameters<typeof DemoScene>[0]['quality']) => <DemoScene t={t} quality={q} />, [])
  const labels = ['LAB201 · HPL/VPL', `HAL ${DEMO_HAL_M} m · VAL ${DEMO_VAL_M} m`, 'RWY 09', 'GPS satellite', 'GEO · SBAS broadcast']

  return (
    <div className="flex flex-col gap-3">
      {/* Night stage in both themes: its chrome uses the dark tokens (design.md §2). */}
      <div className="dark relative h-[56svh] min-h-[320px] overflow-hidden rounded-md border border-hud-line text-foreground md:h-[520px] lg:h-[600px]">
        <LazyStage shot={shot} label={label} className="absolute inset-0" fog={[24, 70]}>
          {children}
        </LazyStage>
        <CornerBrackets />
        {/* Top scrim: what the view shows and the journey clock. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-stage-bg/90 via-stage-bg/55 to-transparent px-4 pt-4 pb-10 md:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="hud-label flex items-center gap-2 text-foreground/85">
              <span className="inline-block size-1.5 bg-brass" aria-hidden />
              Approach view · demo
            </p>
            <p className="hud-title truncate text-[14px] text-foreground md:text-[18px]">LAB201 · Final</p>
            {frozen && <p className="hud-label text-brass">Slowed down so you can see it</p>}
          </div>
          <MissionClock getTimeS={() => demo.timeS} speed={speed} frozen={frozen} running={running} />
        </div>
        {/* Bottom scrim: honesty label, camera buttons, the phase timeline. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-stage-bg/95 via-stage-bg/70 to-transparent px-3 pt-10 pb-3 md:px-6 md:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="hud-label max-w-[46ch] text-[9.5px] leading-[13px] text-foreground/80 sm:text-[10.5px] sm:leading-[14px]">
              {APPROACH_HONESTY} · satellites not to scale
            </p>
            <div className="flex gap-1" role="group" aria-label="Camera">
              <HudButton active={shotName === 'follow'} onClick={() => pick('follow')} aria-label="Camera: follow the aircraft">
                <Crosshair aria-hidden />
                <span className="hidden sm:inline">Follow</span>
              </HudButton>
              <HudButton active={shotName === 'overview'} onClick={() => pick('overview')} aria-label="Camera: overview">
                <Maximize2 aria-hidden />
                <span className="hidden sm:inline">Overview</span>
              </HudButton>
              <HudButton active={shotName === 'zoom'} onClick={() => pick('zoom')} aria-label="Camera: zoom to the protection cylinder">
                <ZoomIn aria-hidden />
                <span className="hidden sm:inline">Zoom</span>
              </HudButton>
              <HudButton onClick={() => pick(shotName)} aria-label="Camera: reset the view">
                <RotateCcw aria-hidden />
                <span className="hidden sm:inline">Reset</span>
              </HudButton>
            </div>
          </div>
          {/* On a phone the timeline moves under the view, so the scene keeps its height. */}
          <PhaseTimeline className="hidden sm:block" phases={DEMO_PHASES} active={phase} onSelect={setPhase} />
        </div>
      </div>
      <PhaseTimeline className="sm:hidden" phases={DEMO_PHASES} active={phase} onSelect={setPhase} />
      <div className="flex flex-col gap-1.5 md:flex-row md:items-baseline md:gap-3">
        <h3 id="stage-labels" className="hud-label shrink-0">
          Labels in this view
        </h3>
        <ul aria-labelledby="stage-labels" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-foreground/85">
          {labels.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Drag the view to look around (sideways only on touch); double-click resets. The timeline only highlights a phase here: jumping arrives with the journey engine
        in Stage 2.
      </p>
    </div>
  )
}
