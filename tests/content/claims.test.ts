/**
 * The claims registry is the record of what SBAS Lab asserts. These tests keep it and
 * the code in step (src/content/claims/types.ts). They run in both scenario projects:
 * value bindings are checked for the claims of the scenario under test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLAIMS, claim, claimsFor, STATUS_LABEL } from '@/content/claims'
import { AI_CHECKED_IDS } from '@/content/claims/aiChecks'
import { renderClaimsCsv, renderExpertReview } from '@/content/claims/report'
import { SOURCES } from '@/content/sources'
import { ACTIVE_SCENARIO } from '@/scenarios/id'
import { SCENARIOS } from '@/scenarios/active'

const ROOT = join(import.meta.dirname, '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

/** Every `TODO(expert-review)` comment in src, with its file. */
const TODOS = walk(join(ROOT, 'src')).flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .map((line, i) => ({ file: relative(ROOT, file), line: i + 1, text: line }))
    .filter((l) => /\/\/ TODO\(expert-review\):/.test(l.text)),
)

const close = (a: number, b: number, tol: number) => (tol === 0 ? a === b : Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-12))

describe('the claims registry', () => {
  it('has unique ids, known sources and well-formed entries', () => {
    const ids = CLAIMS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CLAIMS) {
      expect(c.id, c.id).toMatch(/^[a-z0-9]+\.[a-z0-9-]+$/)
      expect(c.text.length, c.id).toBeGreaterThan(20)
      expect(c.refs.length, c.id).toBeGreaterThan(0)
      for (const r of c.refs) expect(SOURCES[r.source], `${c.id} → ${r.source}`).toBeDefined()
      expect(c.scenarios.length, c.id).toBeGreaterThan(0)
      if (c.status === 'reviewed') expect(c.review?.by && c.review.on, `${c.id} needs a reviewer and a date`).toBeTruthy()
      if (c.review) expect(c.status, c.id).toBe('reviewed')
      if (c.status === 'ai-checked') {
        expect(c.aiCheck, `${c.id} needs its AI check`).toBeDefined()
        expect(c.aiCheck!.rationale.length, c.id).toBeGreaterThan(30)
        expect(c.aiCheck!.checked.length, `${c.id}: what the AI check read`).toBeGreaterThan(0)
        expect(c.aiCheck!.on, c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
      if (c.aiCheck) expect(c.status, `${c.id}: an AI check is shown only on a claim no person has signed off`).toBe('ai-checked')
    }
  })

  it('the AI check covers only claims that exist, and never stands in for a sign-off', () => {
    const ids = new Set(CLAIMS.map((c) => c.id))
    for (const id of AI_CHECKED_IDS) expect(ids.has(id), id).toBe(true)
    expect(STATUS_LABEL['ai-checked']).not.toMatch(/review/i)
  })

  it(`every value it states matches the code (${ACTIVE_SCENARIO} scenario)`, () => {
    let checked = 0
    for (const c of claimsFor(ACTIVE_SCENARIO)) {
      if (c.value === undefined || !c.actual) continue
      const got = c.actual()
      const tol = c.tolerance ?? 0
      if (Array.isArray(c.value)) {
        expect(Array.isArray(got), c.id).toBe(true)
        const g = got as readonly number[]
        expect(g.length, c.id).toBe(c.value.length)
        c.value.forEach((v, i) => expect(close(g[i], v as number, tol), `${c.id}[${i}]: code ${g[i]}, claim ${v}`).toBe(true))
      } else if (typeof c.value === 'number') expect(close(got as number, c.value, tol), `${c.id}: code ${got}, claim ${c.value}`).toBe(true)
      else expect(got, c.id).toBe(c.value)
      checked++
    }
    expect(checked).toBeGreaterThan(10)
  })

  it('every TODO(expert-review) in the code belongs to exactly one claim still awaiting an expert, and the other way round', () => {
    expect(TODOS.length).toBeGreaterThan(30)
    for (const t of TODOS) {
      const owners = CLAIMS.filter((c) => c.todo && c.code && t.file === c.code.split(' ')[0] && t.text.includes(c.todo))
      expect(owners.map((c) => c.id), `${t.file}:${t.line} ${t.text.trim().slice(0, 90)}`).toHaveLength(1)
      expect(['to-confirm', 'ai-checked'], owners[0].id).toContain(owners[0].status)
    }
    for (const c of CLAIMS.filter((x) => x.todo)) {
      const hits = TODOS.filter((t) => t.file === c.code!.split(' ')[0] && t.text.includes(c.todo!))
      expect(hits, `${c.id}: its TODO(expert-review) is gone; sign the claim off or update it`).toHaveLength(1)
    }
  })

  it('every claim a scenario cites exists, and is shown in that scenario', () => {
    for (const [id, s] of Object.entries(SCENARIOS)) {
      const cited = [...Object.values(s.narration).flatMap((n) => n.claims ?? []), ...s.failures.list.flatMap((f) => f.claims ?? [])]
      for (const c of cited) {
        expect(claim(c), `${id} cites ${c}`).toBeDefined()
        expect(claim(c)!.scenarios, `${c} must list ${id}`).toContain(id)
      }
    }
  })

  it('the ESSP-SAS story cites claims in every phase and for every failure', () => {
    const s = SCENARIOS.essp
    for (const [phase, n] of Object.entries(s.narration)) expect(n.claims?.length, phase).toBeGreaterThan(0)
    for (const f of s.failures.list) expect(f.claims?.length, f.id).toBeGreaterThan(0)
  })

  it('docs/EXPERT_REVIEW.md and docs/claims.csv are generated from the registry (run npm run claims)', () => {
    expect(readFileSync(join(ROOT, 'docs', 'EXPERT_REVIEW.md'), 'utf8')).toBe(renderExpertReview())
    expect(readFileSync(join(ROOT, 'docs', 'claims.csv'), 'utf8')).toBe(renderClaimsCsv())
  })
})
