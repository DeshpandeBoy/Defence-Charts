/**
 * Bar/timebar family renderer.
 *
 * The family owns rectangles and stable keys. `SeriesFrame.cells` is the serialisable geometry
 * seam populated by `resolveFrame()` for `MarkSpec['bar']`; an empty cell array remains an
 * intentionally empty result rather than silently drawing a line.
 */

import type { MarkRenderer, MarkRendererRegistration } from '../../renderer-seam.ts'
import { classes, roundCoord } from '../../svg.ts'

const renderNone: MarkRenderer = () => null

const renderBar: MarkRenderer = ({ frame }) => (
  <>
    {frame.cells.map((cell, index) => (
      <rect
        className={classes('shiftcharts-bar')}
        data-bar-index={index}
        data-series-id={frame.id}
        data-series-index={frame.index}
        key={`${frame.id}:${index}`}
        x={roundCoord(cell.x)}
        y={roundCoord(cell.y)}
        width={roundCoord(cell.width)}
        height={roundCoord(cell.height)}
      />
    ))}
  </>
)

export const BAR_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'bar',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'bar',
    markKinds: Object.freeze(['bar'] as const),
    render: renderBar,
  }),
])

export { renderBar }
