import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5176, open: false, headers: securityHeaders },
  preview: { headers: securityHeaders },
  build: { outDir: 'dist', emptyOutDir: true },
})
