import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { DONUT_FAMILY_FIXTURE } from './fixture.ts'
import { DONUT_PLANNER_FIXTURE, donutFamilyPlanner, DONUT_CHART_TYPES } from './planner.ts'

const data = [
  {
    id: 'programs',
    points: [
      { x: 0, y: 40 },
      { x: 1, y: 24 },
      { x: 2, y: 16 },
      { x: 3, y: 10 },
      { x: 4, y: 6 },
      { x: 5, y: 4 },
      { x: 6, y: 3 },
      { x: 7, y: 2 },
      { x: 8, y: 1 },
      { x: 9, y: 1 },
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

describe('donut family planner', () => {
  it('keeps the deterministic fixture and family type list explicit', () => {
    expect(DONUT_FAMILY_FIXTURE.categories).toBe(10)
    expect(DONUT_PLANNER_FIXTURE).toEqual({
      type: 'donut',
      canvasAggregateAfter: 8,
      canvasMinShare: 0.02,
      stageExpandable: true,
    })
    expect(DONUT_CHART_TYPES).toEqual(['donut'])
  })

  it('covers all six rungs with a complete serialisable plan', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = donutFamilyPlanner({ type: 'donut', ctx: context(sizeClass), shape, policy })
      expect(plan.type).toBe('donut')
      expect(plan.marks.primary.kind).toBe(sizeClass === 'micro' ? 'none' : 'arc')
      expect(plan.axes.y.visible).toBe(false)
      expect(plan.marks.points.mode).toBe('none')
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
    }
  })

  it('keeps the visible Other contract at Canvas and makes it expandable at Stage', () => {
    const canvas = donutFamilyPlanner({ type: 'donut', ctx: context('canvas'), shape, policy })
    const stage = donutFamilyPlanner({ type: 'donut', ctx: context('stage'), shape, policy })
    expect(canvas.legend).toEqual({ placement: 'external', position: 'left', maxEntries: 8, showValues: true, showPercent: true })
    expect(canvas.aggregate).toEqual({ after: 8, minShare: 0.02, otherBucket: true, expandable: false, temporalBin: 'none' })
    expect(canvas.motion.objectConstancy).toBe(true)
    expect(stage.aggregate.expandable).toBe(true)
  })

  it('keeps Micro as the explicit value-only end and Tile as the total-plus-arc end', () => {
    const micro = donutFamilyPlanner({ type: 'donut', ctx: context('micro'), shape, policy })
    const tile = donutFamilyPlanner({ type: 'donut', ctx: context('tile'), shape, policy })
    expect(micro.regionOrder).toEqual(['value', 'table'])
    expect(micro.narrative.valueDisplay).toBe('latest')
    expect(tile.marks.primary).toEqual({ kind: 'arc', donut: true })
    expect(tile.narrative.valueDisplay).toBe('latest')
    expect(tile.regionOrder).toEqual(['value', 'plot', 'table'])
    expect(tile.legend).toEqual({ placement: 'absent' })
  })

  it('rejects negative data through the shape contract rather than taking absolute values', () => {
    const negative = describeShape([{ id: 'bad', points: [{ x: 0, y: -1 }] }])
    expect(negative.hasNegative).toBe(true)
    expect(() => donutFamilyPlanner({ type: 'donut', ctx: context('panel'), shape: negative, policy })).toThrow(
      /donut requires non-negative/,
    )
  })
})
