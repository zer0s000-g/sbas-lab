/**
 * The director: for each phase, the view that explains it, the camera shot, the
 * automatic time-lapse and what the SBAS panels show. Pure data, so the choice is
 * deterministic (the same phase always gets the same view).
 */
import type { PhaseId } from './phases'
import type { FlightStage } from '@/core/operations'

export type ViewId = 'space' | 'flight' | 'network'
/** The camera intent the view turns into a shot. */
export type CameraIntent = 'overview' | 'follow' | 'zoom' | 'constellation' | 'satellite' | 'uplink' | 'broadcast' | 'ground'

export interface Direction {
  view: ViewId
  camera: CameraIntent
  /** Automatic time-lapse, one of the clock's speeds. */
  autoSpeed: number
  /** The flight stage whose alert limits apply (Doc 9849 Table 2-1), or none. */
  stage: FlightStage
  /** The story shows SBAS corrections in use from this phase on (see `sbasShown`). */
  sbasInUse: boolean
}

export const DIRECTION: Readonly<Record<PhaseId, Direction>> = {
  gate: { view: 'flight', camera: 'overview', autoSpeed: 4, stage: 'ground', sbasInUse: false },
  takeoff: { view: 'flight', camera: 'follow', autoSpeed: 4, stage: 'departure', sbasInUse: false },
  climb: { view: 'space', camera: 'constellation', autoSpeed: 16, stage: 'terminal', sbasInUse: false },
  errors: { view: 'space', camera: 'satellite', autoSpeed: 1, stage: 'terminal', sbasInUse: false },
  reference: { view: 'network', camera: 'ground', autoSpeed: 1, stage: 'terminal', sbasInUse: false },
  master: { view: 'network', camera: 'ground', autoSpeed: 1, stage: 'terminal', sbasInUse: false },
  uplink: { view: 'space', camera: 'uplink', autoSpeed: 1, stage: 'terminal', sbasInUse: false },
  broadcast: { view: 'space', camera: 'broadcast', autoSpeed: 1, stage: 'terminal', sbasInUse: false },
  cruise: { view: 'flight', camera: 'follow', autoSpeed: 60, stage: 'enroute', sbasInUse: true },
  descent: { view: 'flight', camera: 'follow', autoSpeed: 30, stage: 'approach', sbasInUse: true },
  final: { view: 'flight', camera: 'zoom', autoSpeed: 2, stage: 'final', sbasInUse: true },
  landing: { view: 'flight', camera: 'overview', autoSpeed: 2, stage: 'landed', sbasInUse: true },
}

export const directionFor = (phase: PhaseId): Direction => DIRECTION[phase]

/**
 * The story device: until the first correction arrives (the end of the broadcast
 * phase), the page shows LAB201 navigating with GPS alone, so the learner sees what
 * SBAS adds. A real SBAS receiver uses SBAS from the gate; the page says so.
 */
export const STORY_NOTE = 'In this story SBAS is switched on when the first correction arrives, so you can see what it adds. A real SBAS receiver uses it from the gate.'

export function sbasShown(phase: PhaseId, broadcastDone: boolean): boolean {
  return DIRECTION[phase].sbasInUse || (phase === 'broadcast' && broadcastDone)
}
