/**
 * The ESSP-SAS scenario's own panels, loaded only in that scenario (one lazy chunk):
 * Break something, Service provision, the real EGNOS signal and the assessment. Placed
 * in the page's left column, right column, or a tab of their own on phones.
 */
import type { JourneyEngine } from '@/journey/engine'
import { BreakPanel } from './BreakPanel'
import { ServicePanel } from './ServicePanel'

export default function EsspToolkit({ engine, nowS, part }: { engine: JourneyEngine; nowS: number; part: 'left' | 'right' | 'all' }) {
  return (
    <>
      {part !== 'right' && <BreakPanel engine={engine} />}
      {part !== 'left' && <ServicePanel engine={engine} nowS={nowS} />}
    </>
  )
}
