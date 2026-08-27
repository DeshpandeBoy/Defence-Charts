import type { ChartPlan } from '@shiftcharts/core'

/**
 * Interaction presentation mode for dense charts.
 *
 * `rich` keeps the optional active-point circles in the transient layer. `reduced` still
 * resolves a semantic tooltip and crosshair, but avoids emitting one extra DOM node per shared
 * series while the chart is at (or beyond) its rendering budget. The plan remains the authority:
 * a canvas renderer is an explicit signal that the SVG mark layer is no longer the cheap path.
 */
export type InteractionMode = 'rich' | 'reduced'

/**
 * Resolve the client interaction policy from the already-resolved plan and finite frame count.
 *
 * This is intentionally a tiny pure seam rather than a second budget in React. `pointBudget`
 * lives in `ChartPlan.marks` and is the same value that selected the mark renderer; this helper
 * only chooses transient interaction adornments, never drops data or changes chart content.
 */
export function resolveInteractionMode(plan: ChartPlan, pointCount: number): InteractionMode {
  if (!Number.isFinite(pointCount) || pointCount < 0) return 'reduced'
  if (!Number.isFinite(plan.marks.pointBudget) || plan.marks.pointBudget < 0) return 'reduced'
  const finitePointCount = pointCount
  const budget = plan.marks.pointBudget
  return plan.marks.renderer === 'canvas' || finitePointCount > budget ? 'reduced' : 'rich'
}
