#!/usr/bin/env node
// Bundles src/entry.tsx with esbuild and copies the packages' own CSS files verbatim.
// No dev server, no watch mode, no CDN — the output is a self-contained dist/ that
// index.html loads as plain <link>/<script type="module"> tags.

import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const outDir = path.join(here, 'dist')

await rm(outDir, { recursive: true, force: true })
await mkdir(path.join(outDir, 'styles'), { recursive: true })

await build({
  entryPoints: [path.join(here, 'src/entry.tsx')],
  outfile: path.join(outDir, 'entry.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  // 'development' keeps React's own invariant messages spelled out — this build exists
  // to be poked at in devtools, not to be fast.
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  logLevel: 'info',
})

const styleFiles = [
  ['packages/tokens/src/themes/theme.css', 'theme.css'],
  ['packages/tokens/src/themes/typography.css', 'typography.css'],
  ['packages/primitives/src/chart.css', 'chart.css'],
  ['packages/react/src/auto-chart.css', 'auto-chart.css'],
  ['packages/react/src/interaction-overlay.css', 'interaction-overlay.css'],
]

for (const [source, dest] of styleFiles) {
  await cp(path.join(repoRoot, source), path.join(outDir, 'styles', dest))
}

console.log(`raw-demo build complete -> ${path.relative(repoRoot, outDir)}`)
console.log('Serve this directory with any static file server and open index.html, e.g.:')
console.log('  npx serve apps/raw-demo')
