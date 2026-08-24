import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('./family-matrix-fixture/', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5186,
    strictPort: true,
    open: false,
  },
  resolve: {
    alias: [
      { find: '@gx/tokens/theme.css', replacement: repositoryRoot + '/packages/tokens/src/themes/theme.css' },
      { find: '@gx/primitives/chart.css', replacement: repositoryRoot + '/packages/primitives/src/chart.css' },
      { find: '@gx/react/auto-chart.css', replacement: repositoryRoot + '/packages/react/src/auto-chart.css' },
      { find: '@gx/react/interaction-overlay.css', replacement: repositoryRoot + '/packages/react/src/interaction-overlay.css' },
      { find: '@gx/core', replacement: repositoryRoot + '/packages/core/src/index.ts' },
      { find: '@gx/primitives', replacement: repositoryRoot + '/packages/primitives/src/index.ts' },
      { find: '@gx/react', replacement: repositoryRoot + '/packages/react/src/index.ts' },
      { find: '@gx/tokens', replacement: repositoryRoot + '/packages/tokens/src/index.ts' },
    ],
  },
})
