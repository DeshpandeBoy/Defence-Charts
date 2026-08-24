import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { KPI_FAMILY_FIXTURE } from './fixture.ts'
import {
  KPI_CHART_TYPES,
  KPI_PLANNER_FIXTURE,
  kpiFamilyPlanner,
} from './planner.ts'

const data = [KPI_FAMILY_FIXTURE.series] as const
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

describe('KPI family planner', () => {
  it('keeps the deterministic metric fixture and planner contract explicit', () => {
    expect(KPI_FAMILY_FIXTURE.series).toMatchObject({
      id: 'conversion',
      unit: '%',
      target: 75,
      status: 'positive',
    })
    expect(KPI_CHART_TYPES).toEqual(['kpi'])
    expect(KPI_PLANNER_FIXTURE).toEqual({
      type: 'kpi',
      microValueDisplay: 'latest',
      comparisonValueDisplay: 'latest+delta',
      comparisonBasis: true,
      sparklineAxes: 'off',
    })
  })

  it('covers Micro through Stage with complete serialisable plans', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = kpiFamilyPlanner({ type: 'kpi', ctx: context(sizeClass), shape, policy })
      expect(plan.type).toBe('kpi')
      expect(plan.sizeClass).toBe(sizeClass)
      expect(plan.regionOrder[0]).toBe('value')
      expect(plan.regionOrder.filter((region) => region === 'value')).toHaveLength(1)
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
    }
  })

  it('makes Micro value-only and exposes comparison semantics from Tile onward', () => {
    const micro = kpiFamilyPlanner({ type: 'kpi', ctx: context('micro'), shape, policy })
    expect(micro.valueLegibility).toBe('single-value')
    expect(micro.marks.primary).toEqual({ kind: 'none' })
    expect(micro.narrative).toMatchObject({
      valueDisplay: 'latest',
      deltaBasis: false,
      valueTypeScale: 'fit',
    })
    expect(micro.regionOrder).toEqual(['value', 'table'])

    for (const sizeClass of ['tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = kpiFamilyPlanner({ type: 'kpi', ctx: context(sizeClass), shape, policy })
      expect(plan.narrative.valueDisplay).toBe('latest+delta')
      expect(plan.narrative.deltaBasis).toBe(true)
      expect(plan.regionOrder).toContain('plot')
    }
  })

  it('uses existing line/horizon semantics for sparkline rungs with axes suppressed', () => {
    for (const sizeClass of ['tile', 'strip'] as const) {
      const plan = kpiFamilyPlanner({ type: 'kpi', ctx: context(sizeClass), shape, policy })
      expect(['line', 'horizon', 'none']).toContain(plan.marks.primary.kind)
      expect(plan.axes.x).toEqual({
        visible: false,
        domainLine: false,
        ticks: { mode: 'none' },
        title: false,
        gridlines: false,
        labelFlush: false,
        labelBound: false,
        tickBand: 'center',
        tickExtra: false,
        minExtent: 0,
        maxExtent: 0,
        translate: 0,
        strokeCap: 'butt',
        dashPhase: 0,
      })
      expect(plan.axes.y.visible).toBe(false)
      expect(plan.valueLegibility).toBe('single-value')
    }
  })

  it('keeps Panel through Stage as value-plus-full-line chart compositions', () => {
    for (const sizeClass of ['panel', 'canvas', 'stage'] as const) {
      const plan = kpiFamilyPlanner({ type: 'kpi', ctx: context(sizeClass), shape, policy })
      expect(plan.valueLegibility).toBe('values')
      expect(plan.marks.primary).toEqual({ kind: 'line', area: false })
      expect(plan.axes.y.visible).toBe(true)
      expect(plan.narrative.valueDisplay).toBe('latest+delta')
      expect(plan.narrative.deltaBasis).toBe(true)
    }
  })

  it('keeps negative metric values valid while preserving stable series metadata', () => {
    const negative = describeShape([
      {
        id: 'margin',
        label: 'Margin',
        unit: '%',
        target: 0,
        status: 'warning',
        points: [
          { x: 0, y: -4 },
          { x: 1, y: -2 },
        ],
      },
    ])
    const plan = kpiFamilyPlanner({ type: 'kpi', ctx: context('panel'), shape: negative, policy })
    expect(negative.hasNegative).toBe(true)
    expect(plan.marks.primary).toEqual({ kind: 'line', area: false })
    expect(plan.motion.objectConstancy).toBe(false)
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
  })

  it('rejects a wrong family type instead of silently planning it as a KPI', () => {
    expect(() =>
      kpiFamilyPlanner({
        type: 'line',
        ctx: context('panel'),
        shape,
        policy,
      } as never),
    ).toThrow(/KPI planner does not accept chart type 'line'/)
  })
})
