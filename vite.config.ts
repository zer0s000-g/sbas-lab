/// <reference types="vitest/config" />
import path from 'node:path'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Sub-path the site is served from, e.g. BASE_PATH=/sbas-lab/ for GitHub Pages (CI sets it).
  base: process.env.BASE_PATH || '/',
  plugins: [
    { enforce: 'pre', ...mdx({ providerImportSource: '@mdx-js/react', remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // three.js, drei and postprocessing load in their own chunk after the page is idle
  // (src/stage/LazyStage.tsx); scripts/budget.mjs checks the first load.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Journey tests simulate a whole flight; CI runners are slower than a laptop.
    testTimeout: 30_000,
  },
})
