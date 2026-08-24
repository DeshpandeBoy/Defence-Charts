import { describe, expect, it } from 'vitest'

import { AXIS_OFF } from './plan.ts'
import { DEFAULT_POLICY } from './policy.ts'
import { lineHeight, xAxisBand, yAxisGutter } from './layout.ts'

const AXIS = {
  ...AXIS_OFF,
  visible: true,
  domainLine: true,
  ticks: { mode: 'count', count: 4 } as const,
}

describe('axis extent controls', () => {
  it('bounds horizontal axis bands with minExtent and maxExtent', () => {
    const natural = xAxisBand(AXIS, DEFAULT_POLICY)
    expect(natural).toBeGreaterThan(0)
    expect(xAxisBand({ ...AXIS, minExtent: natural + 12 }, DEFAULT_POLICY)).toBe(natural + 12)
    expect(xAxisBand({ ...AXIS, maxExtent: natural - 4 }, DEFAULT_POLICY)).toBe(natural - 4)
  })

  it('bounds vertical gutters with the same contract', () => {
    const natural = yAxisGutter(AXIS, DEFAULT_POLICY)
    expect(natural).toBeGreaterThan(lineHeight('D', DEFAULT_POLICY))
    expect(yAxisGutter({ ...AXIS, minExtent: natural + 12 }, DEFAULT_POLICY)).toBe(natural + 12)
    expect(yAxisGutter({ ...AXIS, maxExtent: natural - 4 }, DEFAULT_POLICY)).toBe(natural - 4)
  })
})
