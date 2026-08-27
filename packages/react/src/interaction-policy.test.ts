import { describe, expect, it } from 'vitest'

import { resolveInteractionMode } from './interaction-policy.ts'

function plan(renderer: 'svg' | 'canvas', pointBudget = 2) {
  return {
    marks: { renderer, pointBudget },
  } as Parameters<typeof resolveInteractionMode>[0]
}

describe('resolveInteractionMode', () => {
  it('keeps rich adornments under the SVG point budget', () => {
    expect(resolveInteractionMode(plan('svg'), 2)).toBe('rich')
    expect(resolveInteractionMode(plan('svg'), 0)).toBe('rich')
  })

  it('reduces transient adornments once the budget is exceeded', () => {
    expect(resolveInteractionMode(plan('svg'), 3)).toBe('reduced')
  })

  it('honours an explicit canvas renderer even when the sample is small', () => {
    expect(resolveInteractionMode(plan('canvas'), 1)).toBe('reduced')
  })

  it('treats invalid counts and budgets conservatively', () => {
    expect(resolveInteractionMode(plan('svg', Number.NaN), 0)).toBe('reduced')
    expect(resolveInteractionMode(plan('svg', -1), Number.NaN)).toBe('reduced')
  })
})
