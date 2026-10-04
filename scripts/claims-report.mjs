// Writes docs/EXPERT_REVIEW.md and docs/claims.csv from the claims registry
// (src/content/claims). Run after changing a claim:
//
//   npm run claims
//
// The registry is TypeScript with path aliases, so it is loaded through Vite's module
// loader rather than plain Node.
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const report = await server.ssrLoadModule('/src/content/claims/report.ts')
  writeFileSync(join(root, 'docs', 'EXPERT_REVIEW.md'), report.renderExpertReview())
  writeFileSync(join(root, 'docs', 'claims.csv'), report.renderClaimsCsv())
  console.log('claims: wrote docs/EXPERT_REVIEW.md and docs/claims.csv')
} finally {
  await server.close()
}
