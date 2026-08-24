import {
  describeShape,
  planChart,
  resolvePolicy,
  sizeContextFromPixels,
  type Series,
} from './index.ts'
import { BUILT_IN_PLANNER_REGISTRY, findBuiltInPlanner } from './planner-registry.ts'
import { LINE_RUNGS, type LineChartType } from './rungs/line.ts'
import { describe, expect, it } from 'vitest'

const DATA: readonly Series[] = [
  { id: 'alpha', points: [{ x: 0, y: 1 }, { x: 1, y: 4 }, { x: 2, y: 2 }] },
]

const SIZES = [
  [60, 24],
  [240, 80],
  [420, 140],
  [520, 360],
  [900, 520],
  [1400, 760],
] as const

describe('D0.1 planner seam', () => {
  it('keeps the built-in table and every nested registration immutable', () => {
    expect(Object.isFrozen(BUILT_IN_PLANNER_REGISTRY)).toBe(true)
    const registration = BUILT_IN_PLANNER_REGISTRY[0]
    expect(registration).toBeDefined()
    expect(Object.isFrozen(registration)).toBe(true)
    expect(Object.isFrozen(registration?.chartTypes)).toBe(true)
  })

  it('declares line and area as one family without a runtime registration call', () => {
    const registration = BUILT_IN_PLANNER_REGISTRY[0]
    expect(registration?.family).toBe('line')
    expect(registration?.chartTypes).toEqual(['line', 'area'])
    expect(findBuiltInPlanner('line')?.plan).toBe(registration?.plan)
    expect(findBuiltInPlanner('area')?.plan).toBe(registration?.plan)
    expect(findBuiltInPlanner('bar')).toBeUndefined()
  })

  it.each(['line', 'area'] as const)(
    'preserves the existing %s rung output for every size family',
    (type: LineChartType) => {
      for (const [width, height] of SIZES) {
        const ctx = sizeContextFromPixels(width, height)
        const shape = describeShape(DATA)
        const policy = resolvePolicy()
        const direct = LINE_RUNGS[ctx.sizeClass]({ type, ctx, shape, policy })
        const registered = planChart(type, ctx, shape)
        expect(registered).toEqual(direct)
        expect(JSON.parse(JSON.stringify(registered))).toEqual(registered)
      }
    },
  )

  it('keeps unsupported chart types on the existing explicit failure path', () => {
    expect(() => planChart('bar', sizeContextFromPixels(900, 520), describeShape(DATA))).toThrow(
      /chart type "bar" has no rung set yet; it lands at milestone D/,
    )
  })
})
