import { useSampled } from '@/hooks/useSampled'
import { HudPanel } from '@/hud/HudFrame'
import { TelemetryRow } from '@/hud/Telemetry'
import { formatMetres, formatNumber } from '@/lib/format'
import { demo, DEMO_HAL_M, DEMO_VAL_M } from './demoState'

/**
 * The SBAS status panel, reading the same demo world as the stage (so its HPL/VPL
 * agree with the cylinder). Placeholder values until the engine arrives in Stage 1.
 */
export function KitStatusPanel() {
  const pl = useSampled(() => ({ h: demo.hplM, v: demo.vplM }), 100)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HudPanel index="02" title="SBAS status">
        <TelemetryRow label="Satellites used" value="9 / 11" />
        <TelemetryRow label="HDOP" value={formatNumber(0.9)} />
        <TelemetryRow label="VDOP" value={formatNumber(1.4)} />
        <TelemetryRow label={`HPL vs HAL ${DEMO_HAL_M} m`} value={formatMetres(pl.h)} tone="signal" bar={pl.h / DEMO_HAL_M} />
        <TelemetryRow label={`VPL vs VAL ${DEMO_VAL_M} m`} value={formatMetres(pl.v)} tone="signal" bar={pl.v / DEMO_VAL_M} />
        <TelemetryRow label="Last message" value="MT2 fast corrections" tone="brass" />
        <TelemetryRow label="GEO" value="Received" tone="ok" />
        <p className="mt-2 text-[12px] leading-4 text-muted-foreground">Demo values, not from the SBAS engine (Stage 1).</p>
      </HudPanel>
    </div>
  )
}
