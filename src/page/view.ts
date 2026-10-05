/**
 * Which view of the site a page load shows: LAB201's journey (the default, one scenario
 * per load, src/scenarios/id.ts) or the SBAS systems of the world (`?view=systems`).
 * Chosen once per page load, like the scenario.
 */
export type ViewId = 'journey' | 'systems'

export const VIEW_PARAM = 'view'

/** The view named by a URL query string; anything unknown is the journey. */
export function viewFromSearch(search: string): ViewId {
  return new URLSearchParams(search).get(VIEW_PARAM) === 'systems' ? 'systems' : 'journey'
}

/** The view of this page load. */
export const ACTIVE_VIEW: ViewId = viewFromSearch(typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : '')

/** The address of the systems page. */
export const systemsHref = (base: string) => `${base}?${VIEW_PARAM}=systems`

/** A query string without the view parameter (so a scenario tab leads back to the journey). */
export function withoutView(search: string): string {
  const p = new URLSearchParams(search)
  p.delete(VIEW_PARAM)
  const s = p.toString()
  return s ? `?${s}` : ''
}
