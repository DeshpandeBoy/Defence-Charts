/**
 * Line/area family mark renderer.
 *
 * These are the same three mark branches that Chart previously rendered inline. Keeping them
 * beside the family registration makes the add-a-family boundary visible without changing the
 * existing SVG element order or mark behavior.
 */

import type { MarkRenderer, MarkRendererRegistration } from '../../renderer-seam.ts'
import { AreaPath } from '../../AreaPath.tsx'
import { HorizonBands } from '../../HorizonBands.tsx'
import { LinePath } from '../../LinePath.tsx'

const renderNone: MarkRenderer = () => null

const renderLine: MarkRenderer = ({ frame }) => (
  <>
    <AreaPath d={frame.area} />
    <LinePath d={frame.line} />
  </>
)

const renderHorizon: MarkRenderer = ({ frame }) => <HorizonBands bands={frame.bands} />

export const LINE_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'line',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'line',
    markKinds: Object.freeze(['line'] as const),
    render: renderLine,
  }),
  Object.freeze({
    family: 'line',
    markKinds: Object.freeze(['horizon'] as const),
    render: renderHorizon,
  }),
])
