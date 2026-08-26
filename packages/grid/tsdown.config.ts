import { defineConfig } from 'tsdown'
import { cssExportsFor } from '../../scripts/emit-package-assets.mjs'

// `unbundle: true` is the only config in which a `"use client"` directive survives a
// Rolldown build on a non-entry file (30-implementation-plan.md A1). It is load-bearing
// for decision 7, not an optimisation — do not remove it to "simplify the build".
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  unbundle: true,
  dts: true,
  clean: true,
  platform: 'browser',
  exports: { devExports: true, customExports: cssExportsFor('@shiftcharts/grid') },
})
