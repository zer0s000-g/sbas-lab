/**
 * A claim: one fact SBAS Lab shows or computes, with where it comes from and how far it
 * has been checked. The registry (src/content/claims) is the single record of what the
 * page asserts; tests keep it honest:
 * - a claim that names a value binds it to the code (`actual`), and the test fails when
 *   the code and the claim disagree;
 * - every `TODO(expert-review)` in src belongs to exactly one claim with status
 *   "to-confirm" (`todo` matches the comment, `code` names the file);
 * - every claim a scenario's narration or failures cite exists;
 * - docs/EXPERT_REVIEW.md and docs/claims.csv are generated from the registry
 *   (scripts/claims-report.mjs) and a test checks they are current.
 */
import type { ScenarioId } from '@/scenarios/id'
import type { SourceId } from '../sources'

/**
 * How far a claim has been checked:
 * - "reviewed": a named, qualified reviewer confirmed it against the primary source;
 * - "sourced": the source and section are identified and the claim agrees with them as
 *   cited, but no reviewer has signed it off yet;
 * - "to-confirm": not yet traced to a primary source, or a simplification or illustrative
 *   value the page labels as such (a `TODO(expert-review)` in the code).
 */
export type ClaimStatus = 'reviewed' | 'sourced' | 'to-confirm'

export type ClaimTopic = 'GNSS' | 'SBAS' | 'Operations and ATM' | 'Ionosphere' | 'EGNOS and ESSP' | 'Scenario data' | 'Real signal'

export interface ClaimRef {
  source: SourceId
  /** Section, table or page. */
  section?: string
}

export interface Claim {
  /** Stable id, `topic.short-name`. */
  id: string
  topic: ClaimTopic
  /** The scenarios that show it; both for the shared physics and words. */
  scenarios: readonly ScenarioId[]
  /** The claim, in plain words. */
  text: string
  refs: readonly ClaimRef[]
  status: ClaimStatus
  /** The value as the source gives it, when the claim is a value. */
  value?: number | string | readonly number[]
  unit?: string
  /** Relative tolerance for comparing `actual()` with `value` (default: exact). */
  tolerance?: number
  /** The value as the code has it (read when the claim's scenario is the active one). */
  actual?: () => number | string | readonly number[]
  /** Where the code holds it, `file` or `file symbol`. */
  code?: string
  /** A substring of the `TODO(expert-review)` comment in `code` this claim answers. */
  todo?: string
  /** What a reviewer should know. */
  note?: string
  /** Filled when a qualified reviewer signs the claim off. */
  review?: { by: string; on: string }
}
