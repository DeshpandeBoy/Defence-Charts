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
    expect(findBuiltInPlanner('bar')?.family).toBe('bar')
    expect(findBuiltInPlanner('timebar')?.family).toBe('bar')
    expect(findBuiltInPlanner('scatter')?.family).toBe('scatter')
    expect(findBuiltInPlanner('donut')?.family).toBe('donut')
    expect(findBuiltInPlanner('kpi')?.family).toBe('kpi')
    expect(findBuiltInPlanner('progress')?.family).toBe('progress')
    expect(findBuiltInPlanner('heatmap')?.family).toBe('heatmap')
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

  it('resolves the registered bar family and keeps unsupported types on the explicit failure path', () => {
    const bar = planChart('bar', sizeContextFromPixels(900, 520), describeShape(DATA))
    expect(bar.type).toBe('bar')
    expect(bar.marks.primary.kind).toBe('bar')
    const funnel = planChart('funnel', sizeContextFromPixels(900, 520), describeShape(DATA))
    expect(funnel.type).toBe('funnel')
    expect(funnel.marks.primary.kind).toBe('funnel')
  })

  it('resolves the registered scatter family without falling back to a line', () => {
    const scatter = planChart('scatter', sizeContextFromPixels(900, 520), describeShape(DATA))
    expect(scatter.type).toBe('scatter')
    expect(scatter.marks.primary.kind).toBe('point')
  })

  it('resolves the registered donut family without falling back to a line', () => {
    const donut = planChart('donut', sizeContextFromPixels(900, 520), describeShape(DATA))
    expect(donut.type).toBe('donut')
    expect(donut.marks.primary.kind).toBe('arc')
  })

  it('resolves the registered KPI family as a value composition', () => {
    const kpi = planChart('kpi', sizeContextFromPixels(240, 80), describeShape(DATA))
    expect(kpi.type).toBe('kpi')
    expect(kpi.narrative.valueDisplay).toBe('latest+delta')
    expect(kpi.marks.primary.kind).toBe('line')
  })

  it('resolves the registered progress family without falling back to another mark', () => {
    const progress = planChart('progress', sizeContextFromPixels(900, 520), describeShape(DATA))
    expect(progress.type).toBe('progress')
    expect(progress.marks.primary).toEqual({ kind: 'progress', orientation: 'horizontal' })
  })

  it('resolves the registered heatmap family without falling back to a line or bar', () => {
    const heatmapData = [
      { id: 'activity', points: [{ x: new Date('2026-01-01'), y: 1 }, { x: new Date('2026-01-02'), y: 4 }] },
    ]
    const heatmap = planChart('heatmap', sizeContextFromPixels(900, 520), describeShape(heatmapData))
    expect(heatmap.type).toBe('heatmap')
    expect(heatmap.marks.primary.kind).toBe('cell')
  })
})
