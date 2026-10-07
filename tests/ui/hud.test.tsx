// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhaseTimeline } from '@/hud/PhaseTimeline'
import { MissionClock } from '@/hud/MissionClock'
import { AGED_NOTE, StatusPanel } from '@/page/panels'
import { viewModel } from '@/page/model'
import { JourneyEngine } from '@/journey/engine'

afterEach(cleanup)

const PHASES = [
  { id: 'gate', label: 'Gate' },
  { id: 'climb', label: 'Climb' },
  { id: 'final', label: 'Final' },
]

function Timeline() {
  const [active, setActive] = useState('climb')
  return <PhaseTimeline phases={PHASES} active={active} onSelect={setActive} />
}

describe('PhaseTimeline', () => {
  it('clicks and arrow keys move the active phase and keep focus on it', () => {
    render(<Timeline />)
    const current = () => screen.getByRole('button', { current: 'step' }).getAttribute('aria-label')
    expect(current()).toBe('Phase 2: Climb')
    fireEvent.click(screen.getByRole('button', { name: 'Phase 1: Gate' }))
    expect(current()).toBe('Phase 1: Gate')
    const first = screen.getByRole('button', { name: 'Phase 1: Gate' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(current()).toBe('Phase 1: Gate') // clamps at the start
    fireEvent.keyDown(first, { key: 'End' })
    expect(current()).toBe('Phase 3: Final')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Phase 3: Final')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(current()).toBe('Phase 3: Final') // clamps at the end
  })

  it('a NaN progress draws at the start instead of breaking the layout', () => {
    const { container } = render(<PhaseTimeline phases={PHASES} active="gate" onSelect={() => {}} progress={Number.NaN} />)
    expect(container.innerHTML).not.toMatch(/NaN/)
  })
})

describe('MissionClock', () => {
  it('shows time, the time-lapse factor, slow motion and pause, never NaN', () => {
    const { rerender } = render(<MissionClock getTimeS={() => 125} speed={16} running />)
    const timer = screen.getByRole('timer')
    expect(timer.getAttribute('aria-label')).toBe('Journey time T+00:02:05, time-lapse ×16')
    rerender(<MissionClock getTimeS={() => 125} speed={16} frozen running />)
    expect(screen.getByText('Slow motion')).toBeTruthy()
    rerender(<MissionClock getTimeS={() => Number.NaN} speed={Number.NaN} running={false} />)
    expect(screen.getByRole('timer').textContent).not.toMatch(/NaN/)
    expect(screen.getByRole('timer').getAttribute('aria-label')).toMatch(/paused$/)
  })
})

describe('StatusPanel', () => {
  // design.md §6: a simplification is labelled on screen. The page does not degrade the
  // protection levels as the last corrections age (claim sbas.protection-levels).
  it('labels the missing degradation while no SBAS message arrives, and only then', () => {
    const e = new JourneyEngine({ guidedStops: false, running: true })
    e.jumpTo('final', { running: true })
    const fresh = viewModel(e)
    expect(fresh.messageAgeS).toBe(0)
    render(<StatusPanel m={fresh} />)
    expect(screen.queryByText(AGED_NOTE)).toBeNull()
    cleanup()
    e.setFailure('geoLost', true)
    for (let i = 0; i < 40 && viewModel(e).messageAgeS < 2; i++) e.advance(0.1)
    const aged = viewModel(e)
    expect(aged.messageAgeS).toBeGreaterThan(0)
    render(<StatusPanel m={aged} />)
    expect(screen.getByText(AGED_NOTE)).toBeTruthy()
  })
})
