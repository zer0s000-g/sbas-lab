import { useMemo } from 'react'
import { Stage } from '@/stage/Stage'
import type { StageProps } from '@/stage/LazyStage'
import type { ViewId } from '@/journey/director'
import type { JourneyEngine } from '@/journey/engine'
import type { PhaseId } from '@/journey/phases'
import { shotFor, type CameraButton } from '@/views/shots'

/**
 * The journey's 3D stage with its camera shot. A module of its own, loaded with the
 * 3D chunk: the shots read the terrain, the airports and the flight's whole track,
 * none of which the page's first paint needs.
 */
export default function JourneyScene({
  engine,
  view,
  camera,
  phase,
  resetKey,
  ...stage
}: Omit<StageProps, 'shot'> & {
  engine: JourneyEngine
  view: ViewId
  camera: CameraButton | 'auto'
  /** A new phase or a camera reset goes back to the director's shot. */
  phase: PhaseId
  resetKey: number
}) {
  const shot = useMemo(() => shotFor(engine, view, camera), [engine, view, camera, phase, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Stage {...stage} shot={shot} />
}
