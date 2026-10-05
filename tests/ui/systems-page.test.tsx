// @vitest-environment jsdom
/**
 * The SBAS worldwide page (`?view=systems`): its data stays sourced and well-formed, the
 * view parameter is read safely, and the page renders, switches systems from the list,
 * the map and the table, and steps through the end-to-end chain by button and keyboard.
 * Runs in both scenario projects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import SystemsPage from '@/page/systems/SystemsPage'
import { SBAS_CHAIN, SBAS_STUDIES, SBAS_SYSTEMS } from '@/content/sbasSystems'
import { claim } from '@/content/claims'
import { viewFromSearch, withoutView, systemsHref } from '@/page/view'
import { usePrefs } from '@/stores/prefs'

// jsdom has no matchMedia: a wide screen, no reduced-motion preference.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: media.includes('min-width'), media, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the SBAS systems data', () => {
  it('has one sourced claim per system and study, and unique ids', () => {
    const ids = SBAS_SYSTEMS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SBAS_SYSTEMS) expect(claim(s.claim), s.claim).toBeDefined()
    for (const x of SBAS_STUDIES) expect(claim(x.claim), x.claim).toBeDefined()
    expect(claim('world.architecture')).toBeDefined()
    expect(claim('world.areas')).toBeDefined()
  })

  it('keeps to civil aviation: every operational system lists an aviation service with its year', () => {
    for (const s of SBAS_SYSTEMS.filter((x) => x.status === 'operational')) {
      expect(s.services.length, s.id).toBeGreaterThan(0)
      expect(s.services.some((v) => v.year !== null && !v.planned), s.id).toBe(true)
    }
  })

  it('has valid outlines, PRNs in the SBAS range and GEO longitudes on the globe', () => {
    for (const s of SBAS_SYSTEMS) {
      for (const [lon, lat] of s.area ?? []) {
        expect(lon, s.id).toBeGreaterThanOrEqual(-180)
        expect(lon, s.id).toBeLessThanOrEqual(180)
        expect(Math.abs(lat), s.id).toBeLessThanOrEqual(90)
      }
      for (const g of s.geos) {
        if (g.prn !== null) expect(g.prn >= 120 && g.prn <= 158, `${s.id} ${g.prn}`).toBe(true)
        if (g.lonDeg !== null) expect(Math.abs(g.lonDeg), s.id).toBeLessThanOrEqual(180)
      }
    }
    const all = SBAS_SYSTEMS.flatMap((s) => s.geos.map((g) => g.prn)).filter((p) => p !== null)
    expect(new Set(all).size).toBe(all.length)
  })

  it('tells the chain in seven steps', () => {
    expect(SBAS_CHAIN.map((c) => c.id)).toEqual(['gnss', 'reference', 'master', 'uplink', 'geo', 'aircraft', 'approach'])
  })
})

describe('the view parameter', () => {
  it('shows the systems page only for view=systems', () => {
    expect(viewFromSearch('?view=systems')).toBe('systems')
    expect(viewFromSearch('?view=SYSTEMS')).toBe('journey')
    expect(viewFromSearch('?view=<script>')).toBe('journey')
    expect(viewFromSearch('')).toBe('journey')
  })

  it('drops the view when going back to a scenario, and keeps the rest', () => {
    expect(withoutView('?view=systems&lms=scorm')).toBe('?lms=scorm')
    expect(withoutView('?view=systems')).toBe('')
    expect(systemsHref('/sbas-lab/')).toBe('/sbas-lab/?view=systems')
  })
})

describe('the SBAS worldwide page', () => {
  it('renders the map, the chosen system, the chain and the comparison of every system', () => {
    render(<SystemsPage />)
    expect(screen.getByRole('heading', { level: 1, name: /Satellite augmentation around the world/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /World map of SBAS service areas/ })).toBeTruthy()
    // EGNOS is chosen first.
    expect(screen.getByText('European Geostationary Navigation Overlay Service')).toBeTruthy()
    for (const s of SBAS_SYSTEMS) expect(screen.getAllByText(s.name).length, s.name).toBeGreaterThan(0)
    expect(screen.getByRole('list', { name: 'The SBAS chain, step by step' })).toBeTruthy()
  })

  it('switches system from the comparison', () => {
    render(<SystemsPage />)
    const waas = screen.getAllByRole('button', { name: /^WAAS/ })
    fireEvent.click(waas[waas.length - 1])
    expect(screen.getByText('Wide Area Augmentation System')).toBeTruthy()
    expect(screen.getByRole('img', { name: /WAAS highlighted/ })).toBeTruthy()
  })

  it('steps through the chain with the buttons and the arrow keys', () => {
    act(() => usePrefs.setState({ reducedMotionOverride: true }))
    render(<SystemsPage />)
    const caption = () => screen.getByText(/^Step \d of 7/).textContent
    expect(caption()).toMatch(/Step 1 of 7/)
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(caption()).toMatch(/Step 2 of 7 · Reference stations/)
    const list = screen.getByRole('list', { name: 'The SBAS chain, step by step' })
    fireEvent.keyDown(within(list).getAllByRole('button')[0], { key: 'ArrowRight' })
    expect(caption()).toMatch(/Step 3 of 7/)
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(caption()).toMatch(/Step 7 of 7 · Approach/)
    // Reduced motion: no autoplay.
    expect((screen.getByRole('button', { name: /Play the animation/ }) as HTMLButtonElement).disabled).toBe(true)
    act(() => usePrefs.setState({ reducedMotionOverride: null }))
  })
})
