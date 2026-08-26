import { describe, expect, it } from 'vitest'

import { assertBuiltArtifacts, assertPackedConsumer, JS_SPECIFIERS } from './check-built-artifacts.mjs'

describe('built artifact contract', () => {
  it('maps development exports to source and publish exports to existing dist files', async () => {
    const reports = await assertBuiltArtifacts()
    expect(reports).toHaveLength(6)
  })

  it('resolves packed JS, declarations, CSS, and runtime entries without installing', async () => {
    expect(JS_SPECIFIERS).toEqual([
      '@shiftcharts/core',
      '@shiftcharts/grid',
      '@shiftcharts/primitives',
      '@shiftcharts/react',
      '@shiftcharts/testing',
      '@shiftcharts/tokens',
      '@shiftcharts/primitives/line',
      '@shiftcharts/primitives/bar',
      '@shiftcharts/primitives/donut',
    ])
    await expect(assertPackedConsumer()).resolves.toContain('packed consumer: resolved 9')
  })
})
