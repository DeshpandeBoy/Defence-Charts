import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}

/**
 * ⚠ No `resolve.alias` for `@shiftcharts/*`. The workspace packages set
 * `"exports": { ".": "./src/index.ts" }`, so pnpm's symlink already points Vite at source
 * — a hand-written alias would be a second copy of that mapping, free to drift from the
 * one the build actually uses. The playground must exercise the same resolution a
 * consumer does, or it stops being evidence.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false, headers: { ...securityHeaders } },
  preview: { headers: { ...securityHeaders } },
  build: { outDir: 'dist', emptyOutDir: true },
})
