import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('./interaction-fixture/', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5185,
    strictPort: true,
    open: false,
  },
  resolve: {
    alias: [
      { find: '@shiftcharts/core', replacement: repositoryRoot + '/packages/core/src/index.ts' },
      { find: '@shiftcharts/primitives', replacement: repositoryRoot + '/packages/primitives/src/index.ts' },
      { find: '@shiftcharts/react', replacement: repositoryRoot + '/packages/react/src/index.ts' },
      { find: '@shiftcharts/tokens', replacement: repositoryRoot + '/packages/tokens/src/index.ts' },
    ],
  },
})
