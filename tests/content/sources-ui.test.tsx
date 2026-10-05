// @vitest-environment jsdom
/**
 * The Sources sheet, rendered: it opens from the top bar, lists the scenario's claims
 * with their review status, filters them, and focuses on one phase's claims. Runs in
 * both scenario projects.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SourcesButton, SourcesSheet } from '@/page/sources/SourcesSheet'
import { useSources } from '@/page/sources/store'
import { claimsFor, statusCounts } from '@/content/claims'
import { SCENARIO } from '@/scenarios/active'

afterEach(() => {
  cleanup()
  act(() => useSources.getState().setOpen(false))
})

const mine = claimsFor(SCENARIO.id)

describe(`the Sources sheet (${SCENARIO.id})`, () => {
  it('opens from the top bar button and lists every claim of the scenario with its status', async () => {
    render(
      <>
        <SourcesButton />
        <SourcesSheet />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sources and review status' }))
    expect(await screen.findByRole('heading', { name: 'Sources and review status' })).toBeTruthy()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(mine.length)
    const n = statusCounts(mine)
    expect(screen.getAllByText('To confirm').length).toBeGreaterThanOrEqual(n['to-confirm'])
    // Nothing has been signed off: the sheet says so instead of implying it.
    expect(screen.getByText(/No claim has been signed off/)).toBeTruthy()
  })

  it('filters by status', async () => {
    render(<SourcesSheet />)
    act(() => useSources.getState().show())
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Show the claims to confirm' }))
    expect(screen.getAllByRole('article')).toHaveLength(statusCounts(mine)['to-confirm'])
    fireEvent.click(screen.getByRole('radio', { name: 'Show the claims checked by AI' }))
    expect(screen.queryAllByRole('article')).toHaveLength(statusCounts(mine)['ai-checked'])
    fireEvent.click(screen.getByRole('radio', { name: 'Show the reviewed claims' }))
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(screen.getByText('No claims with this status.')).toBeTruthy()
  })

  it('focuses on the claims behind one phase, and can show them all again', async () => {
    const focus = [mine[0].id, mine[1].id]
    render(<SourcesSheet />)
    act(() => useSources.getState().show(focus))
    expect(await screen.findAllByRole('article')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: `Show all ${mine.length}` }))
    expect(screen.getAllByRole('article')).toHaveLength(mine.length)
  })
})
