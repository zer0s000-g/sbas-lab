/**
 * Which scenario the page runs. It is chosen once, when the page loads, from the URL
 * (`?scenario=essp`); the page has one world and one clock, so switching scenario is a
 * new page load, never a change under a running journey. Tests choose it with the
 * SBAS_SCENARIO environment variable (vite.config.ts runs the suite once per scenario).
 */
export type ScenarioId = 'indonesia' | 'essp'

export const SCENARIO_IDS: readonly ScenarioId[] = ['indonesia', 'essp']
export const DEFAULT_SCENARIO: ScenarioId = 'indonesia'
/** The URL query parameter that selects the scenario. */
export const SCENARIO_PARAM = 'scenario'

/** A scenario id from untrusted input; anything unknown is the default scenario. */
export function parseScenarioId(v: unknown): ScenarioId {
  return typeof v === 'string' && (SCENARIO_IDS as readonly string[]).includes(v) ? (v as ScenarioId) : DEFAULT_SCENARIO
}

/** The scenario named by a URL query string, or null when it names none. */
export function scenarioFromSearch(search: string): ScenarioId | null {
  const v = new URLSearchParams(search).get(SCENARIO_PARAM)
  return v === null ? null : parseScenarioId(v)
}

function fromEnvironment(): ScenarioId {
  const search = typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : ''
  const fromUrl = scenarioFromSearch(search)
  if (fromUrl) return fromUrl
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SBAS_SCENARIO
  return parseScenarioId(env)
}

/** The scenario of this page load. */
export const ACTIVE_SCENARIO: ScenarioId = fromEnvironment()

/**
 * The address of a scenario's page: the site's base path, with `?scenario=` for any
 * scenario but the default, keeping other query parameters (for example the LMS launch flag).
 */
export function scenarioHref(id: ScenarioId, base: string, search = ''): string {
  const q = new URLSearchParams(search)
  if (id === DEFAULT_SCENARIO) q.delete(SCENARIO_PARAM)
  else q.set(SCENARIO_PARAM, id)
  const s = q.toString()
  return `${base}${s ? `?${s}` : ''}`
}
