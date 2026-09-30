// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhaseTimeline } from '@/hud/PhaseTimeline'
import { MissionClock } from '@/hud/MissionClock'

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
