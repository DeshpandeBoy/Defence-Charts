/**
 * B3 acceptance coverage — typed plan inputs must change decisions before rendering.
 *
 * The thresholds in this file are TypeScript policy inputs, not CSS custom properties:
 * `planChart()` must produce the same result on the server and in the browser. The one
 * `PlanOverrides` assertion below deliberately demonstrates the separate post-resolution
 * escape hatch rather than treating a decided value as a threshold.
 *
 * Research contract: `research/30-implementation-plan.md` §B3 and
 * `research/20-architecture.md` §3.2. Provenance for the defaults lives beside each field
 * in `packages/core/src/policy.ts`; the acceptance cases focus on the observable contract.
 */

import { describe, expect, it } from 'vitest'

import { sizeContextFromPixels } from './context.ts'
import { planChart } from './plan-chart.ts'
import type { PlanOverrides } from './policy.ts'
import { CANVAS, PANEL, SHAPE, TILE, TILE_SHORT } from './rungs/fixtures.ts'

describe('B3 — typed threshold acceptance', () => {
  it('routes tick density through the policy before resolving the axis', () => {
    const defaultPlan = planChart('line', PANEL, SHAPE)
    const densePlan = planChart('line', PANEL, SHAPE, { tickTargetSpacingX: 50 })

    expect(defaultPlan.axes.x.ticks.mode).toBe('count')
    expect(densePlan.axes.x.ticks.mode).toBe('count')
    if (defaultPlan.axes.x.ticks.mode !== 'count' || densePlan.axes.x.ticks.mode !== 'count') {
      throw new Error('B3 fixture must resolve a counted x axis')
    }
    expect(densePlan.axes.x.ticks.count).toBeGreaterThan(defaultPlan.axes.x.ticks.count)
  })

  it('lets the value-region share change the measured plot-height decision', () => {
    const defaultPlan = planChart('line', TILE, SHAPE)
    const compressedPlot = planChart('line', TILE, SHAPE, { valueRegionMaxShare: 0.95 })

    expect(defaultPlan.marks.primary).toEqual({ kind: 'line', area: false })
    expect(compressedPlot.marks.primary).toEqual({ kind: 'horizon', bands: 1 })
  })

  it('allows policy to disable encoding substitution at every Tile height', () => {
    const pinned = planChart('line', TILE_SHORT, SHAPE, { substitute: false })

    expect(planChart('line', TILE_SHORT, SHAPE).marks.primary).toEqual({
      kind: 'horizon',
      bands: 1,
    })
    expect(pinned.marks.primary).toEqual({ kind: 'line', area: false })
  })

  it('moves the renderer boundary with the typed point budget without sampling data', () => {
    const points = { ...SHAPE, points: 120 }
    const plan = planChart('line', CANVAS, points, { pointBudget: 100 })

    expect(plan.marks.renderer).toBe('canvas')
    expect(plan.marks.pointBudget).toBe(100)
  })

  it('uses the nominal cell size only for standalone pixel-to-cell conversion', () => {
    const defaultCell = sizeContextFromPixels(399, 199)
    const largerCell = sizeContextFromPixels(399, 199, 200)

    expect(defaultCell).toMatchObject({ cols: 3, rows: 1, sizeClass: 'strip' })
    expect(largerCell).toMatchObject({ cols: 1, rows: 1, sizeClass: 'micro' })
  })

  it('keeps post-resolution PlanOverrides distinct from pre-resolution policy', () => {
    const override = { marks: { pointBudget: 2_000 } } satisfies PlanOverrides
    const plan = planChart('line', PANEL, { ...SHAPE, points: 120 }, { pointBudget: 100 }, override)

    // The policy makes the renderer choose Canvas before the override is applied.
    expect(plan.marks.renderer).toBe('canvas')
    // The override changes the decided plan field afterward; it does not re-run the resolver.
    expect(plan.marks.pointBudget).toBe(2_000)
  })
})
