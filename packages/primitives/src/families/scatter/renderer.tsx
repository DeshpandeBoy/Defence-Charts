/**
 * Scatter family mark renderer.
 *
 * Every point in `SeriesFrame.points` is emitted for the SVG path. The frame already excludes
 * null/non-finite observations, and the stable key combines series identity with the data index.
 * A canvas plan is an explicit future-renderer boundary, not a reason to sample silently.
 */

import type { MarkRenderer, MarkRendererRegistration } from '../../renderer-seam.ts'
import { classes, roundCoord } from '../../svg.ts'

const renderNone: MarkRenderer = () => null

const renderScatter: MarkRenderer = ({ frame, plan }) => {
  if (plan.marks.renderer === 'canvas') {
    throw new Error('@shiftcharts/primitives: scatter canvas rendering is not implemented; refusing to sample points.')
  }

  return (
    <>
      {frame.points.map((point, index) => (
        <circle
          className={classes('shiftcharts-point', 'shiftcharts-scatter-point')}
          data-scatter-index={index}
          key={`${frame.id}:${index}`}
          cx={roundCoord(point.x)}
          cy={roundCoord(point.y)}
        />
      ))}
    </>
  )
}

export const SCATTER_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'scatter',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'scatter',
    markKinds: Object.freeze(['point'] as const),
    render: renderScatter,
  }),
])

export { renderScatter }
