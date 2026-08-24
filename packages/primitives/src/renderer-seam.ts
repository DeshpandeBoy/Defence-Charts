/**
 * Internal D0.1 contracts for family-local mark renderers.
 *
 * A renderer receives a resolved ChartPlan, a serializable SeriesFrame, and the same policy
 * used to resolve the chart. It returns RSC-safe React elements and owns no state, effects, refs,
 * DOM access, or registration side effects.
 */

import type { ChartFrame, ChartPlan, PlanPolicy } from '@gx/core'
import type { ReactNode } from 'react'

export type MarkKind = ChartPlan['marks']['primary']['kind']

export type MarkRendererInput = {
  readonly frame: ChartFrame['series'][number]
  readonly plan: ChartPlan
  readonly policy: PlanPolicy
}

export type MarkRenderer = (input: MarkRendererInput) => ReactNode

export type MarkRendererRegistration<TMarkKind extends MarkKind = MarkKind> = {
  readonly family: string & {}
  readonly markKinds: readonly TMarkKind[]
  readonly render: MarkRenderer
}
