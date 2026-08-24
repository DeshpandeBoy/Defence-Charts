/**
 * KPI family planner.
 *
 * KPI is a composition, not a new mark. It combines the existing value band with the settled
 * line-family rung semantics: Micro is value-only, Tile and Strip use the measured
 * line/horizon/none sparkline path with all axes off, and Panel through Stage retain the full
 * line chart. Unit, target, status, and the actual delta direction remain data/frame concerns;
 * this pure planner records the value and comparison contract that makes those fields visible.
 */

import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import type { ChartPlan, ChartType, RegionName } from '../../plan.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  tileRung,
} from '../../rungs/line.ts'

export type KPIChartType = Extract<ChartType, 'kpi'>

export const KPI_CHART_TYPES: readonly KPIChartType[] = Object.freeze(['kpi'])

const KPI_RUNGS = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: tileRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})

/**
 * Precedence-aware composition of the value region with a complete line rung.
 *
 * A Tile rung already has a value region, so remove it before prepending rather than allowing
 * the composition to produce duplicate region names. `regionOrder` remains vertical content
 * order; side-by-side presentation is a renderer/layout concern already settled by the plan
 * contract.
 */
function withValueRegion(plan: ChartPlan): readonly RegionName[] {
  return Object.freeze(['value', ...plan.regionOrder.filter((region) => region !== 'value')])
}

function planKPI(input: FamilyPlannerInput<KPIChartType>): ChartPlan {
  if (input.type !== 'kpi') {
    throw new Error(`@gx/core: KPI planner does not accept chart type '${input.type}'.`)
  }

  const seed = KPI_RUNGS[input.ctx.sizeClass]({
    // The line rung is the source of the existing line/horizon semantics. The family type is
    // applied below so no new mark or chart type is smuggled into the shared rung functions.
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })
  const micro = input.ctx.sizeClass === 'micro'
  const valueDisplay = micro ? 'latest' : 'latest+delta'

  return Object.freeze({
    ...seed,
    type: input.type,
    valueLegibility: micro || input.ctx.sizeClass === 'tile' || input.ctx.sizeClass === 'strip' ? 'single-value' : 'values',
    regionOrder: withValueRegion(seed),
    narrative: Object.freeze({
      ...seed.narrative,
      valueDisplay,
      // The central value frame uses this to expose the comparison basis beside the delta.
      deltaBasis: !micro,
    }),
  })
}

/** Pure, serialisable planner for the KPI family. */
export const kpiFamilyPlanner: FamilyPlanner<KPIChartType> = (input) => planKPI(input)

export const KPI_PLANNER_FIXTURE = Object.freeze({
  type: 'kpi' as const,
  microValueDisplay: 'latest' as const,
  comparisonValueDisplay: 'latest+delta' as const,
  comparisonBasis: true,
  sparklineAxes: 'off' as const,
})
