/**
 * What the page says in each phase, in plain language (CLAUDE.md: analogy first, jargon
 * gets tooltips, formulas only in "Go deeper"). The words are the active scenario's
 * (src/scenarios/<id>/narration.ts); each entry names its sources (docs/SOURCES.md, and
 * the claims registry in src/content/claims).
 */
import type { PhaseId } from './phases'
import { SCENARIO } from '@/scenarios/active'

export interface Narration {
  title: string
  /** What is happening now. */
  now: string
  /** What SBAS gives LAB201 in this phase. */
  benefit: string
  source: string
  /** The claims (src/content/claims) behind the words, when the scenario lists them. */
  claims?: readonly string[]
}

export const NARRATION: Readonly<Record<PhaseId, Narration>> = SCENARIO.narration
