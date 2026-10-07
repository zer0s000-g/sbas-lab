/// <reference types="vitest/config" />
import path from 'node:path'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Preloads the main text face (Inter Tight, latin) so the first paint uses it without a swap. */
function preloadTextFont(): Plugin {
  let base = '/'
  return {
    name: 'sbaslab:preload-text-font',
    apply: 'build',
    configResolved: (c) => void (base = c.base),
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.values(ctx.bundle ?? {}).find((f) => f.type === 'asset' && f.originalFileNames.some((n) => n.endsWith('inter-tight-latin-wght-normal.woff2')))
        if (!font) throw new Error('preload-text-font: the Inter Tight latin font is missing from the build')
        return [{ tag: 'link', attrs: { rel: 'preload', href: base + font.fileName, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }]
      },
    },
  }
}

/** Test files that hold for any scenario: they also run in the ESSP-SAS project. */
const SCENARIO_AGNOSTIC_TESTS = [
  'tests/core/clock.test.ts',
  'tests/core/errors.test.ts',
  'tests/core/fuzz.test.ts',
  'tests/core/geo.test.ts',
  'tests/core/ground.test.ts',
  'tests/core/guard.test.ts',
  'tests/core/messages.test.ts',
  'tests/core/orbits.test.ts',
  'tests/core/random.test.ts',
  'tests/core/receiver.test.ts',
  'tests/core/sun.test.ts',
  'tests/core/units.test.ts',
  'tests/core/service.test.ts',
  'tests/core/traffic.test.ts',
  'tests/ui/systems-page.test.tsx',
  'tests/ui/atc-panel.test.tsx',
  'tests/journey/sessionLog.test.ts',
  'tests/lib/*.test.{ts,tsx}',
  'tests/ui/animation-frame.test.tsx',
  'tests/ui/dial.test.tsx',
  'tests/ui/failure-recovery.test.tsx',
  'tests/ui/hud.test.tsx',
  'tests/content/**/*.test.{ts,tsx}',
]

// https://vite.dev/config/
export default defineConfig({
  // Sub-path the site is served from, e.g. BASE_PATH=/sbas-lab/ for GitHub Pages (CI sets it).
  base: process.env.BASE_PATH || '/',
  plugins: [
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react', remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
    preloadTextFont(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // three.js, drei and postprocessing load in their own chunk after the page is idle
  // (src/stage/LazyStage.tsx); scripts/budget.mjs checks the first load.
  build: {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      // @react-three/postprocessing imports n8ao (an ambient-occlusion pass this site never
      // uses), and n8ao does not declare itself side-effect free, so it would ship anyway.
      treeshake: { moduleSideEffects: [{ test: /[\\/]node_modules[\\/]n8ao[\\/]/, sideEffects: false }] },
    },
  },
  test: {
    environment: 'node',
    // Journey tests simulate a whole flight; CI runners are slower than a laptop.
    testTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
    // The suite runs once per scenario (src/scenarios/id.ts reads SBAS_SCENARIO). The
    // AirNav Indonesia run is the whole original suite; the ESSP-SAS run takes the tests
    // that hold for any scenario, plus its own (tests/essp).
    projects: [
      {
        extends: true,
        test: { name: 'indonesia', env: { SBAS_SCENARIO: 'indonesia' }, include: ['tests/**/*.test.{ts,tsx}'], exclude: ['tests/essp/**', 'tests/_validation/**'] },
      },
      {
        extends: true,
        test: { name: 'essp', env: { SBAS_SCENARIO: 'essp' }, include: ['tests/essp/**/*.test.{ts,tsx}', ...SCENARIO_AGNOSTIC_TESTS] },
      },
    ],
  },
})
