/**
 * Instructor settings from the page address: `?instructor` shows the instructor's panel,
 * `?seed=N` fixes the exam's hidden failure (assessment.examPlan) so a class gets the same
 * exam. Read once per page load; anything malformed is ignored.
 */
export function examSeedFromSearch(search: string): number | null {
  const v = new URLSearchParams(search).get('seed')
  if (v === null || !/^\d{1,10}$/.test(v)) return null
  const n = Number(v)
  return n > 0 && n < 2 ** 31 ? n : null
}

export const instructorFromSearch = (search: string) => new URLSearchParams(search).has('instructor')

const search = () => (typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : '')
export const examSeedFromUrl = () => examSeedFromSearch(search())
export const instructorMode = () => instructorFromSearch(search())
