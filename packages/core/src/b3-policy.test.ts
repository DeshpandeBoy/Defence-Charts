import { describe, expect, it } from 'vitest'

import { resolveFrame } from './frame.ts'
import { lineHeight, xAxisBand, yAxisGutter } from './layout.ts'
import { planChart } from './plan-chart.ts'
import type { PlanPolicy } from './policy.ts'
import { DEFAULT_POLICY, resolvePolicy } from './policy.ts'
import { CANVAS, MICRO, PANEL, SHAPE, STAGE } from './rungs/fixtures.ts'
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

  it('routes custom typography and region gaps through layout geometry', () => {
    const typography = {
      ...DEFAULT_POLICY.typography,
      byRank: {
        ...DEFAULT_POLICY.typography.byRank,
        D: { ...DEFAULT_POLICY.typography.byRank.D, fontSize: 20, letterSpacing: 1 },
      },
    }
    const policy = resolvePolicy({ typography, regionGap: 20 })
    const defaultPlan = planChart('line', PANEL, SHAPE)

    expect(lineHeight('D', policy)).toBeGreaterThan(lineHeight('D', DEFAULT_POLICY))
    expect(xAxisBand(defaultPlan.axes.x, policy)).toBeGreaterThan(
      xAxisBand(defaultPlan.axes.x, DEFAULT_POLICY),
    )
    expect(yAxisGutter(defaultPlan.axes.y, policy)).toBeGreaterThan(
      yAxisGutter(defaultPlan.axes.y, DEFAULT_POLICY),
    )
  })

  it('uses the policy value rank style when fitting the value frame', () => {
    const typography = {
      ...DEFAULT_POLICY.typography,
      byRank: {
        ...DEFAULT_POLICY.typography.byRank,
        A: { ...DEFAULT_POLICY.typography.byRank.A, letterSpacing: 50 },
      },
    }
    const policy = resolvePolicy({ typography })
    const defaultPlan = planChart('line', MICRO, SHAPE)
    const customPlan = planChart('line', MICRO, SHAPE, policy)
    const defaultFrame = resolveFrame(defaultPlan, [{ id: 'a', points: [{ x: 0, y: 10 }] }], MICRO)
    const customFrame = resolveFrame(customPlan, [{ id: 'a', points: [{ x: 0, y: 10 }] }], MICRO, policy)

    expect(customFrame.value?.fontSize ?? 0).toBeLessThan(defaultFrame.value?.fontSize ?? 0)
  })
})
