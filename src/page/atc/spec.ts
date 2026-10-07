/**
 * The controller's traffic for the active scenario: its arrival streams into the
 * destination runway, with the glide path of the destination's FAS data block (the same
 * angle and threshold crossing height LAB201 flies).
 */
import { makeFasDataBlock } from '@/core/approach'
import { DESTINATION } from '@/core/region'
import type { TrafficSpec } from '@/core/traffic'
import { SCENARIO } from '@/scenarios/active'
import { SCENARIO_TRAFFIC } from '@/scenarios/traffic'

const FAS = makeFasDataBlock()

export const ATC_TRAFFIC = SCENARIO_TRAFFIC[SCENARIO.id]

export const ATC_TRAFFIC_SPEC: TrafficSpec = {
  threshold: { eastNm: DESTINATION.thresholdEastNm, northNm: DESTINATION.thresholdNorthNm, elevationFt: DESTINATION.elevationFt },
  finalCourseDeg: FAS.courseDeg,
  joinNm: ATC_TRAFFIC.joinNm,
  gpaDeg: FAS.gpaDeg,
  tchFt: FAS.tchFt,
  streams: ATC_TRAFFIC.streams,
  aircraft: ATC_TRAFFIC.aircraft,
  cycleS: ATC_TRAFFIC.cycleS,
}
