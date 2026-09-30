import { useEffect } from 'react'
import { TitleBlock } from '@/hud/HudFrame'
import { useSimClock } from '@/hooks/useSimClock'
import { useSimulationLoop } from '@/hooks/useSimulationLoop'
import { KitStatusPanel } from './KitPanels'
import { KitStage } from './KitStage'
import { resetDemo, stepDemo } from './demoState'

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <TitleBlock as="h2" kicker={kicker} title={<span id={id}>{title}</span>} className="[&_h2]:text-[18px] md:[&_h2]:text-[22px]" />
      {children}
    </section>
  )
}

/**
 * Stage 0 kit preview: a demo stage with a pen-plotted terrain table and the
 * SBAS status panel, for the design review. It is removed in Stage 3, when the
 * journey page takes over "/".
 */
export default function KitPreview() {
  const clock = useSimClock({ speed: 4 })
  useEffect(() => resetDemo, [])
  useSimulationLoop(clock, stepDemo)
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-4 py-8 md:px-8 md:py-10">
      <TitleBlock
        kicker="Stage 0 · Design kit"
        title="Flight Deck kit preview"
        sub="A demo stage and the SBAS status panel · removed in Stage 3"
      />
      <Section id="kit-stage" kicker="Stage kit" title="Demo stage">
        <KitStage clock={clock} />
      </Section>
      <Section id="kit-status" kicker="HUD kit" title="SBAS status">
        <KitStatusPanel />
      </Section>
    </div>
  )
}
