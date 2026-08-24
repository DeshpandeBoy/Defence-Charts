/**
 * Built-in mark renderer registration.
 *
 * Like the core planner table, this is a frozen literal assembled from direct family imports.
 * It is not a plugin API: a family becomes available only through an explicit source change and
 * a reviewed registration entry.
 */

import type { ReactNode } from 'react'

import { LINE_MARK_RENDERERS } from './families/line/renderer.tsx'
import type { MarkRendererInput, MarkRendererRegistration } from './renderer-seam.ts'

type BuiltInMarkRenderer = MarkRendererRegistration

const BUILT_IN_MARK_RENDERERS: readonly BuiltInMarkRenderer[] = Object.freeze([
  ...LINE_MARK_RENDERERS,
])

export function renderBuiltInMark(input: MarkRendererInput): ReactNode {
  const kind = input.plan.marks.primary.kind
  for (const registration of BUILT_IN_MARK_RENDERERS) {
    if (registration.markKinds.some((candidate) => candidate === kind)) {
      return registration.render(input)
    }
  }

  throw new Error(
    "@gx/primitives: mark kind '" + kind + "' is not implemented. A4 renders 'line', 'horizon' and 'none' only; bar and arc land in D chart breadth.",
  )
}

export { BUILT_IN_MARK_RENDERERS }
