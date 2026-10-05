/**
 * The ESSP-SAS scenario's own panels, loaded only in that scenario (one lazy chunk):
 * Break something, Service provision, the real EGNOS signal (a chunk of its own, with
 * its recording), the service-area map of a real day (a chunk of its own, with its data)
 * and the assessment. Placed in the page's left column, right column, or
 * a tab of their own on phones.
 */
import { PanelBoundary } from '@/components/PanelBoundary'
import type { JourneyEngine } from '@/journey/engine'
import { lazyRetry } from '@/lib/lazyRetry'
import { BreakPanel } from './BreakPanel'
import { ServicePanel } from './ServicePanel'
import { AssessmentPanel } from './AssessmentPanel'
import { instructorMode } from './instructor'

const ReplayPanel = lazyRetry(() => import('./ReplayPanel'))
const ServiceMapPanel = lazyRetry(() => import('./ServiceMapPanel'))
const InstructorPanel = lazyRetry(() => import('./InstructorPanel'))
const INSTRUCTOR = instructorMode()

export default function EsspToolkit({ engine, nowS, part }: { engine: JourneyEngine; nowS: number; part: 'left' | 'right' | 'all' }) {
  return (
    <>
      {INSTRUCTOR && part !== 'right' && (
        <PanelBoundary name="The instructor panel">
          <InstructorPanel />
        </PanelBoundary>
      )}
      {part !== 'right' && <BreakPanel engine={engine} />}
      {part !== 'left' && <ServicePanel engine={engine} nowS={nowS} />}
      {part !== 'left' && (
        <PanelBoundary name="The real EGNOS signal">
          <ReplayPanel engine={engine} nowS={nowS} />
        </PanelBoundary>
      )}
      {part !== 'left' && (
        <PanelBoundary name="The service-area map">
          <ServiceMapPanel />
        </PanelBoundary>
      )}
      {part !== 'right' && <AssessmentPanel engine={engine} />}
    </>
  )
}
