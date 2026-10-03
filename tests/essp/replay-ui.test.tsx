// @vitest-environment jsdom
/**
 * The replay of the recorded EGNOS broadcast: the recording module (indexing, the
 * cached picture) and the rendered panel on the journey clock.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { egnosRecording } from '@/replay/recording'
import { applyMessage, emptyState } from '@/core/sbasDecode'
import { JourneyEngine } from '@/journey/engine'
import { ReplayPanel } from '@/page/essp/ReplayPanel'

afterEach(cleanup)
const rec = egnosRecording()

describe('the recording', () => {
  it('has 900 valid messages over 901 seconds', () => {
    expect(rec.messages).toHaveLength(900)
    expect(rec.messages.every((m) => m.crcValid)).toBe(true)
    expect(rec.durationS).toBe(901)
  })
  it('finds the message of a second, also across a missing second', () => {
    expect(rec.indexAt(0)).toBe(0)
    expect(rec.indexAt(-5)).toBe(0)
    for (const s of [1, 100, 450, 899, 900, 5000]) expect(rec.messages[rec.indexAt(s)].tS).toBeLessThanOrEqual(s)
    expect(rec.indexAt(5000)).toBe(899)
  })
  it('gives the same picture played forward, after a jump back, and decoded from scratch', () => {
    const late = rec.stateAfter(700)
    const lateGrid = JSON.stringify([...late.grid.entries()])
    const early = rec.stateAfter(200)
    const fresh = emptyState()
    for (let i = 0; i <= 200; i++) applyMessage(fresh, rec.messages[i].decoded, rec.messages[i].tS)
    expect(JSON.stringify([...early.grid.entries()])).toBe(JSON.stringify([...fresh.grid.entries()]))
    expect(JSON.stringify([...early.fast.entries()])).toBe(JSON.stringify([...fresh.fast.entries()]))
    expect(JSON.stringify([...rec.stateAfter(700).grid.entries()])).toBe(lateGrid)
  })
})

describe('the Real EGNOS signal panel', () => {
  const engine = new JourneyEngine({ guidedStops: false, running: false })
  it('shows the message of the second on the journey clock, valid, with what a receiver had decoded', () => {
    render(<ReplayPanel engine={engine} nowS={0} />)
    expect(screen.getByText(/Recorded EGNOS broadcast · PRN 124 · 29 March 2011/)).toBeTruthy()
    expect(screen.getByText('MT2')).toBeTruthy()
    expect(screen.getByText('valid')).toBeTruthy()
    expect(screen.getByText(/second 0 of 901/)).toBeTruthy()
  })
  it('wraps the 15-minute recording around the journey clock, and builds up the grid', () => {
    render(<ReplayPanel engine={engine} nowS={901 + 600} />)
    expect(screen.getByText(/second 600 of 901/)).toBeTruthy()
    const map = screen.getByRole('img', { name: /Recorded EGNOS ionospheric grid over Europe/ })
    expect(map.getAttribute('aria-label')).toMatch(/\d+ of 287 grid points monitored/)
    expect(map.querySelectorAll('circle').length).toBeGreaterThan(50)
  })
  it('never shows NaN', () => {
    for (const t of [0, 3, 450, 899, 900, 2702]) {
      const { container, unmount } = render(<ReplayPanel engine={engine} nowS={t} />)
      expect(container.textContent).not.toMatch(/NaN|undefined/)
      unmount()
    }
  })
})
