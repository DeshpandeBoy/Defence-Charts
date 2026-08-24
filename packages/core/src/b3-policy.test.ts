import { describe, expect, it } from 'vitest'

import { planChart } from './plan-chart.ts'
import type { PlanPolicy } from './policy.ts'
import { DEFAULT_POLICY, resolvePolicy } from './policy.ts'
import { CANVAS, PANEL, SHAPE, STAGE } from './rungs/fixtures.ts'
import { tickCountForWidth } from './ticks.ts'

describe('B3 — planner thresholds are typed inputs', () => {
  it('round-trips the complete policy without browser-only values', () => {
    const policy = resolvePolicy({
      tickTargetSpacingX: 140,
      yTickCount: 5,
      directLabelMaxSeries: 5,
      secondaryAxisMinSeries: 3,
      pointBudget: 500,
      pointAutoHideDensityThreshold: 1.5,
    })

    const revived = JSON.parse(JSON.stringify(policy)) as PlanPolicy
    expect(revived).toStrictEqual(policy)
    expect(Object.values(policy).some((value) => typeof value === 'function')).toBe(false)
  })

  it('routes the horizontal tick budget through PlanPolicy', () => {
    expect(tickCountForWidth(394, DEFAULT_POLICY)).toBe(4)
    expect(tickCountForWidth(394, resolvePolicy({ tickTargetSpacingX: 200 }))).toBe(2)

    const plan = planChart('line', PANEL, SHAPE, { tickTargetSpacingX: 200 })
    expect(plan.axes.x.ticks).toEqual({ mode: 'count', count: 2 })
  })

  it('routes Y tick count and series switches through PlanPolicy', () => {
    const yDense = planChart('line', CANVAS, SHAPE, { yTickCount: 6 })
    expect(yDense.axes.y.ticks).toEqual({ mode: 'count', count: 6 })

    const defaultLegend = planChart('line', CANVAS, { ...SHAPE, series: 5 })
    const directLegend = planChart('line', CANVAS, { ...SHAPE, series: 5 }, { directLabelMaxSeries: 5 })
    expect(defaultLegend.legend.placement).toBe('external')
    expect(directLegend.legend).toEqual({ placement: 'direct' })

    const defaultSecondaryAxis = planChart('line', STAGE, { ...SHAPE, series: 2 })
    const deferredSecondaryAxis = planChart('line', STAGE, { ...SHAPE, series: 2 }, { secondaryAxisMinSeries: 3 })
    expect(defaultSecondaryAxis.axes.y2).not.toBeNull()
    expect(deferredSecondaryAxis.axes.y2).toBeNull()

    const compactFacets = planChart('line', STAGE, { ...SHAPE, series: 5 }, {
      facetColumnsByAspect: { ...DEFAULT_POLICY.facetColumnsByAspect, landscape: 2 },
    })
    expect(compactFacets.marks.facet).toEqual({ mode: 'series', columns: 2 })
  })

  it('routes point budget and density thresholds into the resolved plan', () => {
    const plan = planChart('line', CANVAS, SHAPE, {
      pointBudget: 10,
      pointAutoHideDensityThreshold: 1,
    })

    expect(plan.marks.renderer).toBe('canvas')
    expect(plan.marks.pointBudget).toBe(10)
    expect(plan.marks.points).toEqual({ mode: 'all', autoHideDensityThreshold: 1 })
  })
})
