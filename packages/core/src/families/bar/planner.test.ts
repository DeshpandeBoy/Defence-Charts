import { describe, expect, it } from 'vitest'

import { describeShape } from '../../data.ts'
import type { SizeContext } from '../../context.ts'
import { resolvePolicy } from '../../policy.ts'
import { barFamilyPlanner, BAR_CHART_TYPES } from './planner.ts'

const data = [
  {
    id: 'north',
    label: 'North',
    points: [
      { x: 0, y: 12 },
      { x: 1, y: -4 },
      { x: 2, y: 9 },
    ],
  },
  {
    id: 'south',
    label: 'South',
    points: [
      { x: 0, y: 8 },
      { x: 1, y: 5 },
      { x: 2, y: null },
    ],
  },
] as const

const shape = describeShape(data)
const policy = resolvePolicy()

function context(sizeClass: Parameters<typeof barFamilyPlanner>[0]['ctx']['sizeClass']) {
  const pixels = {
    micro: [110, 80],
    tile: [220, 120],
    strip: [360, 150],
    panel: [520, 320],
    canvas: [760, 480],
    stage: [1100, 700],
  } as const
  const [width, height] = pixels[sizeClass]
  const footprint = {
    micro: [1, 1],
    tile: [2, 1],
    strip: [3, 1],
    panel: [3, 3],
    canvas: [6, 5],
    stage: [9, 6],
  } as const
  const [cols, rows] = footprint[sizeClass]
  return { width, height, cols, rows, aspect: 'landscape', sizeClass } satisfies SizeContext
}

describe('bar/timebar family planner', () => {
  it('declares exactly the two family types', () => {
    expect(BAR_CHART_TYPES).toEqual(['bar', 'timebar'])
  })

  it('covers every size rung without a partial plan', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = barFamilyPlanner({ type: 'bar', ctx: context(sizeClass), shape, policy })
      expect(plan.type).toBe('bar')
      expect(plan.sizeClass).toBe(sizeClass)
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
      expect(plan.marks.primary.kind).not.toBe('line')
      expect(plan.marks.primary.kind === 'none' || plan.regionOrder.includes('plot')).toBe(true)
    }
  })

  it('keeps negative values on a zero-baseline contract and groups multiple series', () => {
    const plan = barFamilyPlanner({ type: 'bar', ctx: context('panel'), shape, policy })
    expect(shape.hasNegative).toBe(true)
    expect(plan.marks.primary).toEqual({ kind: 'bar', stacked: false, grouped: true })
    expect(plan.axes.y.visible).toBe(true)
  })

  it('keeps timebar identity and temporal shape metadata separate from the plan type', () => {
    const temporalShape = describeShape([
      { id: 'readiness', points: [{ x: new Date('2026-01-01T00:00:00Z'), y: 4 }] },
    ])
    const plan = barFamilyPlanner({ type: 'timebar', ctx: context('stage'), shape: temporalShape, policy })
    expect(plan.type).toBe('timebar')
    expect(temporalShape.temporal).toBe(true)
    expect(plan.marks.primary).toEqual({ kind: 'bar', stacked: false, grouped: false })
  })

  it('does not invent a bar mark when Micro has no plot region', () => {
    const plan = barFamilyPlanner({ type: 'bar', ctx: context('micro'), shape, policy })
    expect(plan.marks.primary).toEqual({ kind: 'none' })
    expect(plan.valueLegibility).toBe('single-value')
  })
})
