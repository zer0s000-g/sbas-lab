// @vitest-environment jsdom
/**
 * The controller's view, with a real journey engine: the arrivals on the scope, the
 * failure flags them, and the controller's call is checked against the picture and
 * written to the session log. Runs in both scenario projects.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JourneyEngine } from '@/journey/engine'
import { AtcPanel } from '@/page/atc/AtcPanel'
import { useSessionLog } from '@/journey/sessionLog'
import { SCENARIO } from '@/scenarios/active'
import { claim } from '@/content/claims'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useSessionLog.getState().reset('test', null)
})

const atFinal = () => {
  const e = new JourneyEngine({ guidedStops: false, running: false })
  e.jumpTo('final')
  return e
}

describe(`the controller's view (${SCENARIO.id})`, () => {
  it('shows the arrivals on an approach scope with a text alternative', () => {
    render(<AtcPanel engine={atFinal()} />)
    const scope = screen.getByRole('img', { name: /Approach scope around/ })
    expect(scope.getAttribute('aria-label')).toMatch(/arrivals: \w+/)
  })

  it('takes no action as the right call when nothing is broken, and logs it', () => {
    const e = atFinal()
    render(<AtcPanel engine={e} />)
    fireEvent.click(screen.getByRole('button', { name: 'No action needed' }))
    expect(screen.getByText('Right call')).toBeTruthy()
    const last = useSessionLog.getState().log.entries.at(-1)!
    expect(last.event).toEqual({ kind: 'action', area: 'atc', what: 'no-action', correct: true })
  })

  it('under jamming flags the GNSS arrivals, and "GNSS reported unreliable" is right while holding is not', () => {
    vi.useFakeTimers()
    const e = atFinal()
    render(<AtcPanel engine={e} />)
    act(() => e.setFailure('jamming', true))
    act(() => vi.advanceTimersByTime(1100))
    expect(screen.getByRole('img', { name: /Approach scope/ }).getAttribute('aria-label')).not.toMatch(/None flagged/)
    fireEvent.click(screen.getByRole('button', { name: 'Hold all arrivals' }))
    expect(screen.getByText('Not the best call')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Warn: GNSS unreliable' }))
    expect(screen.getByText('Right call')).toBeTruthy()
    expect(screen.getByText(/GNSS REPORTED UNRELIABLE IN THE VICINITY OF/)).toBeTruthy()
  })

  it('names its sources', () => {
    for (const id of ['atc.phraseology', 'atc.traffic', 'atc.conventional-approach']) expect(claim(id), id).toBeDefined()
  })
})

describe('outages in a scenario without a Break panel', () => {
  it.runIf(SCENARIO.id !== 'essp')('switches the outage in the engine from the controller’s view', () => {
    const e = atFinal()
    render(<AtcPanel engine={e} />)
    fireEvent.click(screen.getByRole('radio', { name: /Outage: GPS jamming/ }))
    expect(e.state.failures.jamming).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'No outage' }))
    expect(e.state.failures.jamming).toBe(false)
  })
})
