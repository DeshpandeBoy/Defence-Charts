/**
 * Built-in planner registration.
 *
 * This is deliberately a literal tuple: adding a family means adding one visible entry here
 * after its family-local planner and fixture tests exist. There is no runtime registration,
 * mutable map, or side-effect import to make a family discoverable.
 */

import type { ChartType } from './plan.ts'
import type { BuiltInPlannerRegistry, PlannerRegistration } from './family-seam.ts'
import { BAR_CHART_TYPES, barFamilyPlanner } from './families/bar/planner.ts'
import { LINE_CHART_TYPES, lineFamilyPlanner } from './families/line/planner.ts'
import type { LineChartType } from './rungs/line.ts'

type BuiltInPlanner = PlannerRegistration<ChartType>

const LINE_PLANNER: BuiltInPlanner = Object.freeze({
  family: 'line',
  chartTypes: LINE_CHART_TYPES,
  plan: ({ type, ctx, shape, policy }) =>
    lineFamilyPlanner({ type: type as LineChartType, ctx, shape, policy }),
})

const BAR_PLANNER: BuiltInPlanner = Object.freeze({
  family: 'bar',
  chartTypes: BAR_CHART_TYPES,
  plan: ({ type, ctx, shape, policy }) =>
    barFamilyPlanner({ type: type as 'bar' | 'timebar', ctx, shape, policy }),
})

/** The only built-in planner table. Every nested value is immutable. */
export const BUILT_IN_PLANNER_REGISTRY: BuiltInPlannerRegistry<ChartType> = Object.freeze([
  LINE_PLANNER,
  BAR_PLANNER,
])

/** Find a built-in planner without constructing or mutating a registry at runtime. */
export function findBuiltInPlanner(type: ChartType): BuiltInPlanner | undefined {
  for (const registration of BUILT_IN_PLANNER_REGISTRY) {
    if (registration.chartTypes.some((candidate) => candidate === type)) return registration
  }
  return undefined
}
