import { describe, expect, it } from 'vitest'

import { describeShape, type Series } from '../../data.ts'
import { resolveFrame } from '../../frame.ts'
import { planChart } from '../../plan-chart.ts'
import { sizeContextFromPixels } from '../../context.ts'

function frame(series: Series, width = 400, height = 200) {
  const ctx = sizeContextFromPixels(width, height)
  return resolveFrame(planChart('progress', ctx, describeShape([series])), [series], ctx)
}

const base = (overrides: Partial<Series> = {}): Series => ({
  id: 'readiness',
  points: [{ x: 0, y: 75 }],
  target: 100,
  ...overrides,
})

describe('progress frame', () => {
  it('resolves a finite partial completion with remaining work', () => {
    const progress = frame(base()).series[0]?.progress
    expect(progress).toMatchObject({
      orientation: 'horizontal',
      current: 75,
      target: 100,
      ratio: 0.75,
      remaining: 25,
      overTarget: 0,
      indeterminate: false,
    })
    expect(progress?.track).not.toBeNull()
    expect(progress?.fill?.width).toBeCloseTo((progress?.track?.width ?? 0) * 0.75)
    expect(JSON.parse(JSON.stringify(progress))).toEqual(progress)
  })

  it('clamps over-target geometry while preserving over-target semantics', () => {
    const progress = frame(base({ points: [{ x: 0, y: 120 }] })).series[0]?.progress
    expect(progress).toMatchObject({ ratio: 1, remaining: 0, overTarget: 20, indeterminate: false })
    expect(progress?.fill?.width).toBe(progress?.track?.width)
  })

  it('keeps a negative current value explicit while clamping its fill to zero', () => {
    const progress = frame(base({ points: [{ x: 0, y: -10 }] })).series[0]?.progress
    expect(progress).toMatchObject({ ratio: 0, remaining: 110, overTarget: 0, indeterminate: false })
    expect(progress?.fill?.width).toBe(0)
  })

  it.each([
    ['missing current', base({ points: [{ x: 0, y: null }] })],
    ['non-finite current', base({ points: [{ x: 0, y: Number.NaN }] })],
    ['missing target', base({ target: null })],
    ['zero target', base({ target: 0 })],
    ['negative target', base({ target: -10 })],
    ['non-finite target', base({ target: Number.NaN })],
  ])('keeps %s explicitly indeterminate', (_name, series) => {
    const progress = frame(series).series[0]?.progress
    expect(progress?.indeterminate).toBe(true)
    expect(progress?.ratio).toBeNull()
    expect(progress?.fill).toBeNull()
  })

  it('uses radial geometry at the Micro rung', () => {
    const progress = frame(base(), 100, 100).series[0]?.progress
    expect(progress?.orientation).toBe('radial')
    expect(progress?.trackPath).toMatch(/^M/)
    expect(progress?.fillPath).toMatch(/^M/)
    expect(progress?.track).toBeNull()
  })
})
