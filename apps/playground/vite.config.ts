import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * ⚠ No `resolve.alias` for `@shiftcharts/*`. The workspace packages set
 * `"exports": { ".": "./src/index.ts" }`, so pnpm's symlink already points Vite at source
 * — a hand-written alias would be a second copy of that mapping, free to drift from the
 * one the build actually uses. The playground must exercise the same resolution a
 * consumer does, or it stops being evidence.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
