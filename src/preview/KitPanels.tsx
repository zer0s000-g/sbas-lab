import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useSampled } from '@/hooks/useSampled'
import { useClock, type SimClock } from '@/hooks/useSimClock'
import { Dial, HudButton, LeverSwitch, Segmented } from '@/hud/Controls'
import { HudPanel } from '@/hud/HudFrame'
import { MissionClock } from '@/hud/MissionClock'
import { BarMeter, NeedleGauge, TelemetryRow } from '@/hud/Telemetry'
import { DEFAULT_SPEEDS } from '@/core/clock'
import { formatMetres, formatNumber, formatSpeed } from '@/lib/format'
import { usePrefs } from '@/stores/prefs'
import { demo, DEMO_HAL_M, DEMO_VAL_M } from './demoState'

/** Placeholder values: they move so the kit can be seen live, and stand for nothing. */
function DemoNote() {
  return <p className="mt-2 text-[12px] leading-4 text-muted-foreground">Demo values, not from the SBAS engine (Stage 1).</p>
}

export function KitPanels({ clock }: { clock: SimClock }) {
  const running = useClock(clock, (s) => s.running)
  const speed = useClock(clock, (s) => s.speed)
  const frozen = useSampled(() => demo.frozen, 200)
  const pl = useSampled(() => ({ h: demo.hplM, v: demo.vplM }), 100)
  const [view, setView] = useState<'auto' | 'orbit' | 'network' | 'approach'>('auto')
  const [minima, setMinima] = useState<'lpv200' | 'lpv' | 'lnavvnav' | 'lnav'>('lpv')
  const [dial, setDial] = useState(12)
  const [geoLost, setGeoLost] = useState(false)
  const guidedStops = usePrefs((s) => s.guidedStops)
  const setGuidedStops = usePrefs((s) => s.setGuidedStops)

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <HudPanel index="01" title="Flight">
        <TelemetryRow label="Callsign" value="LAB201" />
        <TelemetryRow label="Route" value="Made-up airports" tone="muted" />
        <TelemetryRow label="Phase" value="Final" tone="signal" />
        <TelemetryRow label="Mode" value={geoLost ? 'LNAV' : 'LPV'} tone={geoLost ? 'alert' : 'ok'} />
        <TelemetryRow label="Distance to threshold" value="2.0" unit="NM" />
        <DemoNote />
      </HudPanel>

      <HudPanel index="02" title="SBAS status">
        <TelemetryRow label="Satellites used" value="9 / 11" />
        <TelemetryRow label="HDOP" value={formatNumber(0.9)} />
        <TelemetryRow label="VDOP" value={formatNumber(1.4)} />
        <TelemetryRow label={`HPL vs HAL ${DEMO_HAL_M} m`} value={formatMetres(pl.h)} tone="signal" bar={pl.h / DEMO_HAL_M} />
        <TelemetryRow label={`VPL vs VAL ${DEMO_VAL_M} m`} value={formatMetres(pl.v)} tone="signal" bar={pl.v / DEMO_VAL_M} />
        <TelemetryRow label="Last message" value="MT2 fast corrections" tone="brass" />
        <TelemetryRow label="GEO" value={geoLost ? 'Lost' : 'Received'} tone={geoLost ? 'alert' : 'ok'} />
        <DemoNote />
      </HudPanel>

      <HudPanel index="03" title="Meters">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col items-end gap-2">
            <BarMeter value={pl.v / DEMO_VAL_M} label={`VPL ${formatMetres(pl.v)} of VAL ${DEMO_VAL_M} m`} />
            <span className="hud-label">VPL/VAL</span>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <NeedleGauge value={pl.h} min={0} max={DEMO_HAL_M} ticks={[0, 10, 20, 30, 40]} label="HPL, m" valueText={formatMetres(pl.h)} />
            <BarMeter orientation="horizontal" value={pl.h / DEMO_HAL_M} label={`HPL ${formatMetres(pl.h)} of HAL ${DEMO_HAL_M} m`} />
          </div>
        </div>
        <DemoNote />
      </HudPanel>

      <HudPanel index="04" title="Clock">
        <div className="flex items-start justify-between gap-3">
          <HudButton variant="solid" onClick={() => clock.getState().toggle()} aria-label={running ? 'Pause' : 'Play'}>
            {running ? <Pause aria-hidden /> : <Play aria-hidden />}
            {running ? 'Pause' : 'Play'}
          </HudButton>
          <MissionClock getTimeS={() => demo.timeS} speed={speed} frozen={frozen} running={running} />
        </div>
        <Segmented
          className="mt-4"
          label="Time-lapse"
          value={String(speed)}
          options={DEFAULT_SPEEDS.map((s) => ({ value: String(s), label: formatSpeed(s), ariaLabel: `Time-lapse ${s} times` }))}
          onChange={(v) => clock.getState().setSpeed(Number(v))}
        />
        <LeverSwitch
          className="mt-3"
          tone="signal"
          label="Slow-motion moment"
          hint="Freezes the world; the GEO signal keeps travelling, slowly."
          checked={frozen}
          onChange={(v) => (demo.frozen = v)}
        />
      </HudPanel>

      <HudPanel index="05" title="Controls">
        <div className="flex flex-col gap-4">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'orbit', label: 'Orbit' },
              { value: 'network', label: 'Network' },
              { value: 'approach', label: 'Approach' },
            ]}
          />
          <Segmented
            label="Approach minima"
            value={minima}
            onChange={setMinima}
            options={[
              { value: 'lpv200', label: 'LPV-200' },
              { value: 'lpv', label: 'LPV' },
              { value: 'lnavvnav', label: 'L/VNAV', ariaLabel: 'LNAV/VNAV' },
              { value: 'lnav', label: 'LNAV' },
            ]}
          />
          <div className="flex items-center justify-between gap-4">
            <Dial label="Demo dial" value={dial} min={0} max={40} step={1} onChange={setDial} format={(v) => `${v} m`} />
            <div className="flex flex-col gap-2">
              <HudButton>Line</HudButton>
              <HudButton active>Active</HudButton>
              <HudButton disabled>Disabled</HudButton>
            </div>
          </div>
        </div>
      </HudPanel>

      <HudPanel index="06" title="Break something">
        <p className="text-[13px] leading-5 text-muted-foreground">The flight keeps its planned path whatever is broken.</p>
        <LeverSwitch label="GEO signal lost" hint="Demo: only the mode and GEO readouts change here." checked={geoLost} onChange={setGeoLost} />
        <LeverSwitch tone="signal" label="Guided stops" hint="Saved on this device." checked={guidedStops} onChange={setGuidedStops} />
      </HudPanel>
    </div>
  )
}
