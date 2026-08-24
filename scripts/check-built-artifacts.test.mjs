import { describe, expect, it } from 'vitest'

import { assertBuiltArtifacts, assertPackedConsumer } from './check-built-artifacts.mjs'

describe('built artifact contract', () => {
  it('maps development exports to source and publish exports to existing dist files', async () => {
    const reports = await assertBuiltArtifacts()
    expect(reports).toHaveLength(6)
  })

  it('resolves packed JS, declarations, CSS, and runtime entries without installing', async () => {
    await expect(assertPackedConsumer()).resolves.toContain('packed consumer: resolved 6')
  })
})
