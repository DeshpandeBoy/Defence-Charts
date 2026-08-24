import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { SCATTER_FAMILY_FIXTURE } from './fixture.ts'
import { SCATTER_PLANNER_FIXTURE, scatterFamilyPlanner } from './planner.ts'

const data = [
  {
    id: 'risk',
    points: [
      { x: 3, y: 9 },
      { x: 1, y: -2 },
      { x: 2, y: null },
      { x: 4, y: 12 },
    ],
  },
] as const

const shape = describeShape(data)
const policy = resolvePolicy()

function context(sizeClass: SizeContext['sizeClass']): SizeContext {
  const sizes = {
    micro: [100, 100, 1, 1],
    tile: [200, 200, 2, 1],
    strip: [400, 200, 3, 1],
    panel: [500, 300, 3, 3],
    canvas: [700, 500, 6, 5],
    stage: [1000, 700, 9, 6],
  } as const
  const [width, height, cols, rows] = sizes[sizeClass]
  return { width, height, cols, rows, aspect: 'landscape', sizeClass }
}

describe('scatter family planner', () => {
  it('keeps the deterministic fixture inside the family test surface', () => {
    expect(SCATTER_FAMILY_FIXTURE.type).toBe('scatter')
    expect(SCATTER_FAMILY_FIXTURE.points).toHaveLength(3)
  })

  it('keeps the deterministic family fixture explicit', () => {
    expect(SCATTER_PLANNER_FIXTURE).toEqual({ type: 'scatter', pointBudget: 2000, overBudget: false })
  })

  it('uses no plot at Micro and point marks from Tile through Stage', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = scatterFamilyPlanner({ type: 'scatter', ctx: context(sizeClass), shape, policy })
      expect(plan.type).toBe('scatter')
      expect(plan.marks.primary.kind).toBe(sizeClass === 'micro' ? 'none' : 'point')
      expect(plan.marks.points.mode).toBe('none')
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
    }
  })

  it('preserves negative, missing, unsorted, and duplicate-safe shape metadata', () => {
    expect(shape.hasNegative).toBe(true)
    expect(shape.points).toBe(4)
    expect(shape.categories).toBe(4)
    const plan = scatterFamilyPlanner({ type: 'scatter', ctx: context('panel'), shape, policy })
    expect(plan.marks.primary).toEqual({ kind: 'point' })
  })

  it('records the canvas boundary without changing the point budget', () => {
    const plan = scatterFamilyPlanner({
      type: 'scatter',
      ctx: context('canvas'),
      shape: { ...shape, points: policy.pointBudget + 1 },
      policy,
    })
    expect(plan.marks.renderer).toBe('canvas')
    expect(plan.marks.pointBudget).toBe(policy.pointBudget)
  })
})
