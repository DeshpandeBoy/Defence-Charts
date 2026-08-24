/**
 * Line/area family adapter.
 *
 * The existing six rung functions remain the source of line and area behavior. This small
 * family-local adapter gives the coordinator a stable registration seam without changing any
 * rung output or introducing a second resolver.
 */

import type { FamilyPlanner } from '../../family-seam.ts'
import { LINE_RUNGS, type LineChartType } from '../../rungs/line.ts'

/** The chart types owned by this family, declared beside its planner. */
export const LINE_CHART_TYPES: readonly LineChartType[] = Object.freeze(['line', 'area'])

/** Resolve one existing line/area rung through the family contract. */
export const lineFamilyPlanner: FamilyPlanner<LineChartType> = ({
  type,
  ctx,
  shape,
  policy,
}) => LINE_RUNGS[ctx.sizeClass]({ type, ctx, shape, policy })
