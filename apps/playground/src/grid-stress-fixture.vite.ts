import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('./grid-stress-fixture/', import.meta.url))
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
      { find: '@gx/core', replacement: `${repositoryRoot}/packages/core/src/index.ts` },
      { find: '@gx/grid', replacement: `${repositoryRoot}/packages/grid/src/index.ts` },
      { find: '@gx/primitives', replacement: `${repositoryRoot}/packages/primitives/src/index.ts` },
      { find: '@gx/react', replacement: `${repositoryRoot}/packages/react/src/index.ts` },
      { find: '@gx/tokens', replacement: `${repositoryRoot}/packages/tokens/src/index.ts` },
    ],
  },
})
