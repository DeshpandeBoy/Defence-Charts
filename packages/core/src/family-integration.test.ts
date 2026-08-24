import { describe, expect, it } from 'vitest'

import {
  describeShape,
  planChart,
  sizeContextFromPixels,
  type ChartType,
  type Series,
} from './index.ts'
import { BUILT_IN_PLANNER_REGISTRY } from './planner-registry.ts'

const TYPES: readonly ChartType[] = [
  'line',
  'area',
  'bar',
  'timebar',
  'scatter',
  'donut',
  'kpi',
  'progress',
  'heatmap',
  'funnel',
]

const EXPECTED_MARKS: Readonly<Record<ChartType, string>> = {
  line: 'line',
  area: 'line',
  bar: 'bar',
  timebar: 'bar',
  scatter: 'point',
  donut: 'arc',
  kpi: 'line',
  progress: 'progress',
  heatmap: 'cell',
  funnel: 'funnel',
}

const DATA: Readonly<Record<ChartType, readonly Series[]>> = {
  line: [{ id: 'line', points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  area: [{ id: 'area', points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  bar: [{ id: 'bar', points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  timebar: [{ id: 'timebar', points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  scatter: [{ id: 'scatter', points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  donut: [{ id: 'donut', points: [{ x: 0, y: 3 }, { x: 1, y: 2 }] }],
  kpi: [{ id: 'kpi', target: 4, points: [{ x: 0, y: 1 }, { x: 1, y: 3 }] }],
  progress: [{ id: 'progress', target: 4, points: [{ x: 0, y: 3 }] }],
  heatmap: [{
    id: 'heatmap',
    points: [{ x: new Date('2026-01-01'), y: 1 }, { x: new Date('2026-01-02'), y: 2 }],
  }],
  funnel: [{ id: 'funnel', points: [{ x: 0, y: 100 }, { x: 1, y: 50 }] }],
}

describe('D7.1 central family integration', () => {
  it('registers every shipped type exactly once with its intended mark boundary', () => {
    const registeredTypes = BUILT_IN_PLANNER_REGISTRY.flatMap((registration) => registration.chartTypes)
    expect(registeredTypes).toEqual(TYPES)
    expect(new Set(registeredTypes).size).toBe(TYPES.length)

    const ctx = sizeContextFromPixels(900, 520)
    for (const type of TYPES) {
      const plan = planChart(type, ctx, describeShape(DATA[type]))
      expect(plan.type).toBe(type)
      expect(plan.marks.primary.kind).toBe(EXPECTED_MARKS[type])
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
    }
  })

  it('keeps registry entries and chart type list immutable', () => {
    expect(Object.isFrozen(BUILT_IN_PLANNER_REGISTRY)).toBe(true)
    expect(BUILT_IN_PLANNER_REGISTRY.every((entry) => Object.isFrozen(entry))).toBe(true)
    expect(BUILT_IN_PLANNER_REGISTRY.every((entry) => Object.isFrozen(entry.chartTypes))).toBe(true)
  })
})
