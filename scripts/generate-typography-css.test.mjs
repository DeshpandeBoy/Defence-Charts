import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { DEFAULT_TYPOGRAPHY } from '../packages/core/src/text.ts'
import { renderTypographyCss } from './generate-typography-css.mjs'

const TARGET = fileURLToPath(
  new URL('../packages/tokens/src/themes/typography.css', import.meta.url),
)

describe('generated typography CSS', () => {
  it('is byte-for-byte current with the typed planner input', async () => {
    expect(await readFile(TARGET, 'utf8')).toBe(renderTypographyCss(DEFAULT_TYPOGRAPHY))
  })

  it('keeps provisional CSS features aligned with provisional metrics', () => {
    expect(DEFAULT_TYPOGRAPHY.featureSettings).toBe(
      DEFAULT_TYPOGRAPHY.metrics.generatedWith.featureSettings,
    )
    expect(DEFAULT_TYPOGRAPHY.stretch).toBe(DEFAULT_TYPOGRAPHY.metrics.generatedWith.stretch)
    expect(DEFAULT_TYPOGRAPHY.opticalSizing).toBe(
      DEFAULT_TYPOGRAPHY.metrics.generatedWith.opticalSizing,
    )
  })
})