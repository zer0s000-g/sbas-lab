// @vitest-environment jsdom
/**
 * The ESSP-SAS panels, rendered with a real journey engine: Break something drives the
 * engine's failures; Service provision forecasts LPV at Nice, proposes a NOTAM for a
 * storm, and says what each role does; both keep quiet during an assessment.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { JourneyEngine } from '@/journey/engine'
import { BreakPanel } from '@/page/essp/BreakPanel'
import { ServicePanel } from '@/page/essp/ServicePanel'
import { useExamLock } from '@/page/essp/examLock'
import { claim } from '@/content/claims'
import { ROLE_NOTES, SERVICE_NOTICES, EWA_FACTS } from '@/scenarios/essp/provision'

afterEach(() => {
  cleanup()
  act(() => useExamLock.getState().setLocked(false))
})

describe('Break something (ESSP-SAS)', () => {
  it('switches a failure on in the engine and shows what to notice and what the crew and ATC do', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<BreakPanel engine={e} />)
    fireEvent.click(screen.getByRole('switch', { name: /Ionospheric storm/ }))
    expect(e.state.failures.storm).toBe(true)
    expect(screen.getByText(/VPL goes above VAL and LPV-200 becomes unavailable/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Mend everything/ }))
    expect(e.state.failures.storm).toBe(false)
  })
  it('offers no equatorial failures and is locked during an assessment', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<BreakPanel engine={e} />)
    expect(screen.queryByRole('switch', { name: /scintillation/i })).toBeNull()
    expect(screen.getByRole('switch', { name: /EGNOS v3 preview/ })).toBeTruthy()
    act(() => useExamLock.getState().setLocked(true))
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByText(/Locked while the assessment runs/)).toBeTruthy()
  })
})

describe('Service provision (ESSP-SAS)', () => {
  it('forecasts LPV available at Nice with no NOTAM, then proposes one when a storm is forecast', async () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<ServicePanel engine={e} nowS={0} />)
    expect(await screen.findByText(/None: APV-I is predicted available at Nice/, {}, { timeout: 10_000 })).toBeTruthy()
    expect(screen.getByRole('img', { name: /APV-I 100 % available; LPV-200 100 % available/ })).toBeTruthy()
    act(() => e.setFailure('storm', true))
    const notam = await screen.findByText(/A\) LFMN\s+B\) 0700 UTC\s+C\) 1005 UTC/, {}, { timeout: 10_000 })
    expect(notam.textContent).toMatch(/E\) EGNOS APV-I SERVICE PREDICTED NOT AVBL. RNP RWY 04L LPV MINIMA NOT AVBL./)
  })
  it('a sudden failure (a lost GEO) is not in the forecast, but changes what each role does', async () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<ServicePanel engine={e} nowS={0} />)
    act(() => e.setFailure('geoLost', true))
    expect(await screen.findByText(/None: APV-I is predicted available/, {}, { timeout: 10_000 })).toBeTruthy()
    expect(screen.getByText(ROLE_NOTES.geoLost.pilot.text, { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Air traffic controller' }))
    expect(screen.getByText(ROLE_NOTES.geoLost.atco.text, { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'SBAS service provider (ESSP for EGNOS)' }))
    expect(screen.getByText(ROLE_NOTES.geoLost.provider.text, { exact: false })).toBeTruthy()
  })
  it('shows the EGNOS service notices and the EWA figures', () => {
    const e = new JourneyEngine({ guidedStops: false, running: false })
    render(<ServicePanel engine={e} nowS={0} />)
    for (const n of SERVICE_NOTICES) expect(screen.getByText(n.date)).toBeTruthy()
    const ewa = screen.getByText(/EGNOS Working Agreement with ESSP/)
    expect(within(ewa).getByText(String(EWA_FACTS.procedures))).toBeTruthy()
  })
  it('every role note, notice and figure cites claims that exist and belong to the ESSP-SAS scenario', () => {
    const cited = [...Object.values(ROLE_NOTES).flatMap((r) => Object.values(r).flatMap((n) => n.claims)), ...SERVICE_NOTICES.flatMap((n) => n.claims), ...EWA_FACTS.claims]
    for (const id of cited) {
      expect(claim(id), id).toBeDefined()
      expect(claim(id)!.scenarios).toContain('essp')
    }
  })
})
