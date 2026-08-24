/**
 * Built-in mark renderer registration.
 *
 * Like the core planner table, this is a frozen literal assembled from direct family imports.
 * It is not a plugin API: a family becomes available only through an explicit source change and
 * a reviewed registration entry.
 */

import type { ReactNode } from 'react'

import { BAR_MARK_RENDERERS } from './families/bar/renderer.tsx'
import { DONUT_MARK_RENDERERS } from './families/donut/renderer.tsx'
import { LINE_MARK_RENDERERS } from './families/line/renderer.tsx'
import { PROGRESS_MARK_RENDERERS } from './families/progress/renderer.tsx'
import { SCATTER_MARK_RENDERERS } from './families/scatter/renderer.tsx'
import { HEATMAP_MARK_RENDERERS } from './families/heatmap/renderer.tsx'
import { FUNNEL_MARK_RENDERERS } from './families/funnel/renderer.tsx'
import type { MarkRendererInput, MarkRendererRegistration } from './renderer-seam.ts'

type BuiltInMarkRenderer = MarkRendererRegistration

const BUILT_IN_MARK_RENDERERS: readonly BuiltInMarkRenderer[] = Object.freeze([
  ...LINE_MARK_RENDERERS,
  ...BAR_MARK_RENDERERS,
  ...SCATTER_MARK_RENDERERS,
  ...DONUT_MARK_RENDERERS,
  ...PROGRESS_MARK_RENDERERS,
  ...HEATMAP_MARK_RENDERERS,
  ...FUNNEL_MARK_RENDERERS,
])

export function renderBuiltInMark(input: MarkRendererInput): ReactNode {
  const kind = input.plan.marks.primary.kind
  for (const registration of BUILT_IN_MARK_RENDERERS) {
    if (registration.markKinds.some((candidate) => candidate === kind)) {
      return registration.render(input)
    }
  }

  throw new Error(
    "@gx/primitives: mark kind '" + kind + "' is not implemented. A4 renders 'line', 'horizon', 'none', D1.1 renders 'bar', D3.2 renders 'progress', D4.1 renders 'point', D2.1 renders donut 'arc', D5.1 renders heatmap 'cell', D6.1 renders funnel; future marks remain explicit.",
  )
}

export { BUILT_IN_MARK_RENDERERS }
