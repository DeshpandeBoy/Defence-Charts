import { describe, expect, it } from 'vitest'

import { assertPackedMetadata, assertPackageMetadata } from './check-package-metadata.mjs'

describe('package publication metadata', () => {
  it('describes the actual exports, dependencies, and publishable files', async () => {
    await expect(assertPackageMetadata()).resolves.toHaveLength(6)
  })

  it('keeps packed README, LICENSE, dist, and dependency metadata intact offline', async () => {
    await expect(assertPackedMetadata()).resolves.toHaveLength(6)
  })
})
