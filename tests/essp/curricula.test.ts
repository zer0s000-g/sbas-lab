/**
 * The curriculum mapping: every objective of the ESSP-SAS assessment is mapped to at
 * least one formal framework, every link names a framework that exists, and the CSV export
 * holds one row per link.
 */
import { describe, expect, it } from 'vitest'
import { CURRICULUM_GAPS, CURRICULUM_LINKS, FRAMEWORKS, curriculaCsv } from '@/content/curricula'
import { OBJECTIVES } from '@/scenarios/essp/questions'
import { examSeedFromSearch, instructorFromSearch } from '@/page/essp/instructor'

describe('the curriculum mapping', () => {
  it('maps every objective, to frameworks that exist', () => {
    for (const o of OBJECTIVES) expect(CURRICULUM_LINKS.filter((l) => l.objective === o.id).length, o.id).toBeGreaterThan(1)
    const ids = new Set(FRAMEWORKS.map((f) => f.id))
    for (const l of CURRICULUM_LINKS) {
      expect(ids.has(l.framework), l.framework).toBe(true)
      expect(OBJECTIVES.some((o) => o.id === l.objective), l.objective).toBe(true)
      expect(l.item.length).toBeGreaterThan(3)
    }
    expect(CURRICULUM_GAPS.length).toBeGreaterThan(0)
  })

  it('exports one CSV row per link, quoting what needs it', () => {
    const csv = curriculaCsv(OBJECTIVES).trimEnd().split('\n')
    expect(csv).toHaveLength(CURRICULUM_LINKS.length + 1)
    expect(csv[0]).toBe('objective_id,objective,framework,item,item_text,fit')
  })
})

describe('instructor settings from the address', () => {
  it('reads a valid seed and ignores anything else', () => {
    expect(examSeedFromSearch('?seed=1234')).toBe(1234)
    expect(examSeedFromSearch('?seed=0')).toBeNull()
    expect(examSeedFromSearch('?seed=-3')).toBeNull()
    expect(examSeedFromSearch('?seed=12abc')).toBeNull()
    expect(examSeedFromSearch('?seed=99999999999')).toBeNull()
    expect(examSeedFromSearch('')).toBeNull()
    expect(instructorFromSearch('?scenario=essp&instructor')).toBe(true)
    expect(instructorFromSearch('?scenario=essp')).toBe(false)
  })
})
