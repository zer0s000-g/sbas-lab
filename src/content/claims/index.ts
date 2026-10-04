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
import type { Claim, ClaimStatus } from './types'

export type { Claim, ClaimRef, ClaimStatus, ClaimTopic } from './types'

export const CLAIMS: readonly Claim[] = [...GNSS_CLAIMS, ...SBAS_CLAIMS, ...OPERATIONS_CLAIMS, ...EGNOS_CLAIMS]

const BY_ID = new Map(CLAIMS.map((c) => [c.id, c]))

/** A claim by id. */
export const claim = (id: string): Claim | undefined => BY_ID.get(id)

/** The claims a scenario shows. */
export const claimsFor = (scenario: ScenarioId): Claim[] => CLAIMS.filter((c) => c.scenarios.includes(scenario))

export const STATUS_LABEL: Readonly<Record<ClaimStatus, string>> = {
  reviewed: 'Reviewed',
  sourced: 'Sourced, awaiting review',
  'to-confirm': 'To confirm',
}

/** How many of a set of claims have each status. */
export function statusCounts(claims: readonly Claim[]): Record<ClaimStatus, number> {
  const out: Record<ClaimStatus, number> = { reviewed: 0, sourced: 0, 'to-confirm': 0 }
  for (const c of claims) out[c.status]++
  return out
}
