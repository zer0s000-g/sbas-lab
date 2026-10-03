/**
 * The scenario of this page load (src/scenarios/id.ts chooses it from the URL, or the
 * SBAS_SCENARIO environment variable in tests). The simulation and the views read their
 * scenario data from here; nothing changes it while the page runs.
 */
import { ACTIVE_SCENARIO, type ScenarioId } from './id'
import type { ScenarioDef } from './types'
import { INDONESIA } from './indonesia'
import { ESSP } from './essp'

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDef>> = { indonesia: INDONESIA, essp: ESSP }

export const SCENARIO: ScenarioDef = SCENARIOS[ACTIVE_SCENARIO]
