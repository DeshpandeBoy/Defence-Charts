import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('./family-matrix-fixture/', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  define: {
    __SHIFTCHARTS_FAMILY_MATRIX_REPOSITORY_ROOT__: JSON.stringify(repositoryRoot),
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.SHIFTCHARTS_FAMILY_MATRIX_PORT ?? '5186'),
    strictPort: true,
    open: false,
  },
  resolve: {
    alias: [
      { find: '@shiftcharts/tokens/theme.css', replacement: repositoryRoot + '/packages/tokens/src/themes/theme.css' },
      { find: '@shiftcharts/primitives/chart.css', replacement: repositoryRoot + '/packages/primitives/src/chart.css' },
      { find: '@shiftcharts/react/auto-chart.css', replacement: repositoryRoot + '/packages/react/src/auto-chart.css' },
      { find: '@shiftcharts/react/interaction-overlay.css', replacement: repositoryRoot + '/packages/react/src/interaction-overlay.css' },
      { find: '@shiftcharts/core', replacement: repositoryRoot + '/packages/core/src/index.ts' },
      { find: '@shiftcharts/primitives', replacement: repositoryRoot + '/packages/primitives/src/index.ts' },
      { find: '@shiftcharts/react', replacement: repositoryRoot + '/packages/react/src/index.ts' },
      { find: '@shiftcharts/tokens', replacement: repositoryRoot + '/packages/tokens/src/index.ts' },
    ],
  },
})
