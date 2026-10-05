/**
 * The claims registry: every fact SBAS Lab shows or computes, with its sources and
 * review status (./types). Feature modules (the service-provision panel, the
 * assessment, the real-signal replay) add their own lists here.
 */
import type { ScenarioId } from '@/scenarios/id'
import { GNSS_CLAIMS } from './gnss'
import { SBAS_CLAIMS } from './sbas'
import { OPERATIONS_CLAIMS } from './operations'
import { EGNOS_CLAIMS } from './egnos'
import { WORLDWIDE_CLAIMS } from './worldwide'
import { TRAINING_CLAIMS } from './training'
import { aiCheckFor } from './aiChecks'
import type { Claim, ClaimStatus } from './types'

export type { AiCheck, Claim, ClaimRef, ClaimStatus, ClaimTopic } from './types'

/** A claim with its AI check applied: a claim not yet signed off by a person becomes "ai-checked". */
function withAiCheck(c: Claim): Claim {
  const aiCheck = aiCheckFor(c.id)
  return aiCheck && c.status !== 'reviewed' ? { ...c, status: 'ai-checked', aiCheck } : c
}

export const CLAIMS: readonly Claim[] = [...GNSS_CLAIMS, ...SBAS_CLAIMS, ...OPERATIONS_CLAIMS, ...EGNOS_CLAIMS, ...WORLDWIDE_CLAIMS, ...TRAINING_CLAIMS].map(withAiCheck)

/** The statuses, from most to least checked. */
export const STATUSES: readonly ClaimStatus[] = ['reviewed', 'ai-checked', 'sourced', 'to-confirm']

/** The model of the AI check (./aiChecks). */
export const AI_MODEL = 'Claude Opus 5.5'

const BY_ID = new Map(CLAIMS.map((c) => [c.id, c]))

/** A claim by id. */
export const claim = (id: string): Claim | undefined => BY_ID.get(id)

/** The claims a scenario shows. */
export const claimsFor = (scenario: ScenarioId): Claim[] => CLAIMS.filter((c) => c.scenarios.includes(scenario))

export const STATUS_LABEL: Readonly<Record<ClaimStatus, string>> = {
  reviewed: 'Reviewed',
  'ai-checked': 'Checked by AI, awaiting expert',
  sourced: 'Sourced, awaiting review',
  'to-confirm': 'To confirm',
}

/** How many of a set of claims have each status. */
export function statusCounts(claims: readonly Claim[]): Record<ClaimStatus, number> {
  const out: Record<ClaimStatus, number> = { reviewed: 0, 'ai-checked': 0, sourced: 0, 'to-confirm': 0 }
  for (const c of claims) out[c.status]++
  return out
}
