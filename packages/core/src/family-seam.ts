/**
 * Internal D0.1 contracts for chart-family planners.
 *
 * A family owns a pure planner function and names the chart-type literals that it accepts.
 * The function is an implementation boundary, not a serializable value: only its ChartPlan
 * result crosses the core boundary into a renderer or an RSC.
 */

import type { DataShape, SizeContext } from './context.ts'
import type { ChartPlan } from './plan.ts'
import type { PlanPolicy } from './policy.ts'

/** A stable family label used only by the static built-in registration tables. */
export type ChartFamilyId = string & {}

/** Pure inputs owned by a family-local planner. */
export type FamilyPlannerInput<TChartType extends string = string> = {
  readonly type: TChartType
  readonly ctx: SizeContext
  readonly shape: DataShape
  readonly policy: PlanPolicy
}

/** A family-local planner whose serializable result is a ChartPlan. */
export type FamilyPlanner<TChartType extends string = string> = (
  input: FamilyPlannerInput<TChartType>,
) => ChartPlan

/** One statically declared family entry. */
export type PlannerRegistration<TChartType extends string = string> = {
  readonly family: ChartFamilyId
  readonly chartTypes: readonly TChartType[]
  readonly plan: FamilyPlanner<TChartType>
}

/** The registry shape is an immutable value, not a mutable plugin API. */
export type BuiltInPlannerRegistry<TChartType extends string = string> =
  readonly PlannerRegistration<TChartType>[]
