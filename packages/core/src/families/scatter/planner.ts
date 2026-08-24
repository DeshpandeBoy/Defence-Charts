/**
 * Scatter family planner.
 *
 * Scatter reuses the line ladder's chrome and value-legibility decisions, but changes the
 * primary encoding to points once a plot exists. The point budget is preserved in the plan: a
 * caller over that budget receives the existing `renderer: 'canvas'` decision, and the family
 * renderer refuses that unimplemented path rather than silently thinning the data.
 */

import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import type { ChartPlan, ChartType, MarkSpec } from '../../plan.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from '../../rungs/line.ts'

export type ScatterChartType = Extract<ChartType, 'scatter'>

export const SCATTER_CHART_TYPES: readonly ScatterChartType[] = Object.freeze(['scatter'])

const SCATTER_RUNGS = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: stripRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})

function scatterMark(seed: ChartPlan): MarkSpec {
  return seed.marks.primary.kind === 'none' ? Object.freeze({ kind: 'none' }) : Object.freeze({ kind: 'point' })
}

function planScatter(input: FamilyPlannerInput<ScatterChartType>): ChartPlan {
  const seed = SCATTER_RUNGS[input.ctx.sizeClass]({
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })

  return Object.freeze({
    ...seed,
    type: input.type,
    marks: Object.freeze({
      ...seed.marks,
      primary: scatterMark(seed),
      // The family renderer owns the points so Chart does not paint a second point layer.
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
    }),
  })
}

/** Pure, serialisable planner for scatter. */
export const scatterFamilyPlanner: FamilyPlanner<ScatterChartType> = (input) => planScatter(input)

export const SCATTER_PLANNER_FIXTURE = Object.freeze({
  type: 'scatter' as const,
  pointBudget: 2000,
  overBudget: false,
})
