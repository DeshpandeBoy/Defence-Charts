import { defineConfig } from 'tsdown'
import { cssExportsFor } from '../../scripts/emit-package-assets.mjs'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  unbundle: true,
  dts: true,
  clean: true,
  platform: 'browser',
  exports: { devExports: true, customExports: cssExportsFor('@shiftcharts/motion') },
})
