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
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Journey tests simulate a whole flight; CI runners are slower than a laptop.
    testTimeout: 30_000,
  },
})
