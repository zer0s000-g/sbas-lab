/**
 * The ESSP-SAS scenario's own panels, loaded only in that scenario (one lazy chunk):
 * Break something, Service provision, the real EGNOS signal (a chunk of its own, with
 * its recording) and the assessment. Placed in the page's left column, right column, or
 * a tab of their own on phones.
 */
import { Suspense } from 'react'
import type { JourneyEngine } from '@/journey/engine'
import { lazyRetry } from '@/lib/lazyRetry'
import { BreakPanel } from './BreakPanel'
import { ServicePanel } from './ServicePanel'
import { AssessmentPanel } from './AssessmentPanel'

const ReplayPanel = lazyRetry(() => import('./ReplayPanel'))

export default function EsspToolkit({ engine, nowS, part }: { engine: JourneyEngine; nowS: number; part: 'left' | 'right' | 'all' }) {
  return (
    <>
      {part !== 'right' && <BreakPanel engine={engine} />}
      {part !== 'left' && <ServicePanel engine={engine} nowS={nowS} />}
      {part !== 'left' && (
        <Suspense fallback={null}>
          <ReplayPanel engine={engine} nowS={nowS} />
        </Suspense>
      )}
      {part !== 'right' && <AssessmentPanel engine={engine} />}
    </>
  )
}
