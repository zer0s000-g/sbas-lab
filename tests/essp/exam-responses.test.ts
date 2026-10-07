/**
 * The exam's second question, "LAB201 is on final: what do the crew and the controller do
 * now?", has exactly one defensible right answer (validation finding H-1). On final the
 * crew act on what the cockpit shows: several failures end the same way (LPV drops to
 * LNAV), so they share one response, and that response is never offered as a wrong option.
 */
import { describe, expect, it } from 'vitest'
import { EXAMABLE, examPlan, gradeExam, rightResponse } from '@/assessment/assessment'
import { IN_FLIGHT_RESPONSES } from '@/scenarios/essp/examResponses'
import { claim } from '@/content/claims'
import { FAILURES, type FailureId } from '@/journey/failures'
import { JourneyEngine } from '@/journey/engine'
import { viewModel } from '@/page/model'

/** What the cockpit shows on final 20 s after the failure (a lost GEO times out after 12 s). */
function cockpitOnFinal(id: FailureId) {
  const e = new JourneyEngine({ guidedStops: false, running: false })
  e.jumpTo('final')
  e.setFailure(id, true)
  for (let i = 0; i < 400 && e.state.phase === 'final'; i++) {
    e.play()
    e.advance(0.05)
  }
  const m = viewModel(e)
  return `${m.mode} · position ${m.navSource === 'none' ? 'none' : 'yes'} · alarm ${m.alarmed.length > 0 ? 'yes' : 'no'}`
}

const responseOf = (id: string) => IN_FLIGHT_RESPONSES.find((r) => r.id === id)!

describe('the in-flight responses', () => {
  it('have unique ids and texts, rest on claims of the scenario, and none is a pre-flight action', () => {
    expect(new Set(IN_FLIGHT_RESPONSES.map((r) => r.id)).size).toBe(IN_FLIGHT_RESPONSES.length)
    expect(new Set(IN_FLIGHT_RESPONSES.map((r) => r.text)).size).toBe(IN_FLIGHT_RESPONSES.length)
    for (const r of IN_FLIGHT_RESPONSES) {
      expect(r.claims.length, r.id).toBeGreaterThan(0)
      for (const c of r.claims) expect(claim(c)?.scenarios, `${r.id} → ${c}`).toContain('essp')
      expect(r.text, r.id).not.toMatch(/before the flight|NOTAM|crews plan/i)
    }
  })

  it('give every examable failure exactly one right response on final', () => {
    for (const id of EXAMABLE) expect(IN_FLIGHT_RESPONSES.filter((r) => r.rightFor.includes(id)).length, id).toBe(1)
    // Enough wrong responses for three wrong options whatever is hidden.
    expect(IN_FLIGHT_RESPONSES.length - 1).toBeGreaterThanOrEqual(3)
  })

  it('follow what the simulation shows on final: one response per cockpit picture', () => {
    const picture = new Map(EXAMABLE.map((id) => [id, cockpitOnFinal(id)]))
    // The simulation: four of the six look the same (LPV drops to LNAV).
    expect(EXAMABLE.filter((id) => picture.get(id)!.startsWith('LNAV')).sort()).toEqual(['geoLost', 'sbasOff', 'stationOffline', 'storm'])
    expect(rightResponse('geoLost', IN_FLIGHT_RESPONSES).text).toMatch(/report the loss of LPV to ATC and continue to LNAV minima/)
    for (const a of EXAMABLE)
      for (const b of EXAMABLE) {
        const same = rightResponse(a, IN_FLIGHT_RESPONSES).id === rightResponse(b, IN_FLIGHT_RESPONSES).id
        expect(same, `${a} (${picture.get(a)}) vs ${b} (${picture.get(b)})`).toBe(picture.get(a) === picture.get(b))
      }
  })
})

describe('the exam action question over seeds 1 to 1000', () => {
  it('offers four distinct responses, exactly one of them right for the hidden failure, and grades only that one right', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const p = examPlan(seed, FAILURES, IN_FLIGHT_RESPONSES)
      expect(p.actionOptions).toHaveLength(4)
      expect(new Set(p.actionOptions).size).toBe(4)
      const right = p.actionOptions.filter((id) => responseOf(id).rightFor.includes(p.failure))
      expect(right, `seed ${seed}`).toEqual([p.action])
      for (const id of p.actionOptions) expect(gradeExam(p, p.failure, id).actionRight, `seed ${seed}, ${id}`).toBe(id === p.action)
    }
  })

  it('never grades wrong the response that is right for what the learner sees (H-1)', () => {
    const lpvToLnav: FailureId[] = ['geoLost', 'storm', 'stationOffline', 'sbasOff']
    const report = rightResponse('geoLost', IN_FLIGHT_RESPONSES).id
    const wrongly: number[] = []
    for (let seed = 1; seed <= 1000; seed++) {
      const p = examPlan(seed, FAILURES, IN_FLIGHT_RESPONSES)
      if (lpvToLnav.includes(p.failure) && !gradeExam(p, p.failure, report).actionRight) wrongly.push(seed)
    }
    expect(wrongly).toEqual([])
  })

  it('keeps the hidden failure of a seed, so an instructor link still hides the same failure', () => {
    // Seed 1 hid "RIMS offline" before the responses had their own ids, and still does.
    expect(examPlan(1, FAILURES, IN_FLIGHT_RESPONSES).failure).toBe('stationOffline')
    expect(examPlan(1, FAILURES, IN_FLIGHT_RESPONSES).action).toBe('reportLpvLoss')
  })
})
