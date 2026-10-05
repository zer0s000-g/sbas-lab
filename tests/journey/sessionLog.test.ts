/**
 * The session log: the engine's events are recorded on the world clock as the learner
 * causes them, actions from the panels join them, the debrief measures the response to
 * each failure, and an exported log reads back (anything else is refused).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { JourneyEngine } from '@/journey/engine'
import { attachSessionLog, debrief, emptyLog, failuresAfter, journeyEvents, logAction, parseLog, useSessionLog } from '@/journey/sessionLog'
import { initialJourney } from '@/journey/engine'

afterEach(() => useSessionLog.getState().reset('test', null))

describe('engine events', () => {
  it('turns a change of discrete state into events', () => {
    const a = initialJourney({ running: true })
    const b = { ...a, phase: 'final' as const, failures: { ...a.failures, jamming: true }, speedMode: 4 }
    expect(journeyEvents(a, b)).toEqual([
      { kind: 'phase', phase: 'final' },
      { kind: 'failure', id: 'jamming', on: true },
      { kind: 'speed', mode: '4' },
    ])
    expect(journeyEvents(a, a)).toEqual([])
  })

  it('records what the learner does, on the journey clock, and the actions of the panels', () => {
    const engine = new JourneyEngine({ guidedStops: false, running: true })
    const detach = attachSessionLog(engine)
    engine.jumpTo('final')
    engine.setFailure('jamming', true)
    logAction(engine, 'atc', 'gnss-unreliable', true)
    engine.setFailure('jamming', false)
    detach()
    engine.setFailure('storm', true) // after detaching: not recorded
    const log = useSessionLog.getState().log
    const kinds = log.entries.map((e) => e.event.kind)
    expect(kinds).toEqual(['phase', 'failure', 'action', 'failure'])
    expect(log.entries.every((e) => e.phase === 'final')).toBe(true)
    expect(log.entries[1].tS).toBeCloseTo(engine.worldS, 1)
    expect(failuresAfter(log, 1)).toEqual(['jamming'])
    expect(failuresAfter(log, 3)).toEqual([])
  })
})

describe('the debrief', () => {
  it('measures the time from each failure to the first action, and counts right and wrong', () => {
    const log = emptyLog('essp', 42, '2026-10-05T00:00:00Z')
    log.entries.push(
      { tS: 100, phase: 'final', event: { kind: 'failure', id: 'geoLost', on: true } },
      { tS: 103, phase: 'final', event: { kind: 'action', area: 'instructor', what: 'note' } },
      { tS: 112.5, phase: 'final', event: { kind: 'action', area: 'atc', what: 'sbas-unavailable', correct: true } },
      { tS: 130, phase: 'final', event: { kind: 'action', area: 'atc', what: 'hold', correct: false } },
    )
    const d = debrief(log)
    expect(d.failures).toEqual([{ id: 'geoLost', onS: 100, firstActionS: 112.5, firstAction: 'sbas-unavailable', responseS: 12.5 }])
    expect(d.right).toBe(1)
    expect(d.wrong).toBe(1)
  })

  it('reports no response when the learner did nothing', () => {
    const log = emptyLog('essp')
    log.entries.push({ tS: 5, phase: 'final', event: { kind: 'failure', id: 'jamming', on: true } })
    expect(debrief(log).failures[0].responseS).toBeNull()
  })
})

describe('exported logs', () => {
  it('read back, and anything else is refused', () => {
    const log = emptyLog('essp', 7)
    log.entries.push({ tS: 1, phase: 'gate', event: { kind: 'running', on: false } })
    expect(parseLog(JSON.stringify(log))).toEqual(log)
    expect(parseLog('not json')).toBeNull()
    expect(parseLog('{"format":"other","entries":[]}')).toBeNull()
    expect(parseLog(JSON.stringify({ ...log, entries: [{ tS: 'x' }] }))).toBeNull()
  })
})
