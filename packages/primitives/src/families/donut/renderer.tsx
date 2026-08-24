/**
 * Donut family mark renderer.
 *
 * `resolveFrame()` owns category validation, aggregation, angles, and the d3-generated local
 * path. This renderer consumes that shared `SeriesFrame.arcs` seam and only places each path at
 * its frame-provided centre. It intentionally does not derive slices from line points: that would
 * be a second render path with different identity and aggregation semantics.
 *
 * The SVG marks are not the non-color equivalent. The existing `<Chart>` data table remains the
 * text representation for assistive technology and does not depend on arc colour.
 */

import type { MarkRenderer, MarkRendererRegistration, MarkRendererInput } from '../../renderer-seam.ts'
import { classes, translate } from '../../svg.ts'

const renderNone: MarkRenderer = () => null

/**
 * Render the supplied shared-frame arcs. The explicit checks keep malformed plans/frames and the
 * future canvas boundary from degrading into an empty or line-shaped chart.
 */
export const renderDonut: MarkRenderer = ({ frame, plan }) => {
  const mark = plan.marks.primary
  if (mark.kind !== 'arc') {
    throw new Error(`@gx/primitives: donut renderer requires an arc mark; received '${mark.kind}'.`)
  }
  if (!mark.donut) {
    throw new Error('@gx/primitives: non-donut arc/pie rendering is not implemented.')
  }
  if (plan.marks.renderer !== 'svg') {
    throw new Error('@gx/primitives: donut canvas rendering is not implemented; refusing to rasterize arcs.')
  }

  // The runtime guard is intentional even though the current TypeScript seam requires `arcs`: it
  // gives an explicit integration failure if an older/shared frame reaches this family renderer.
  if (!Array.isArray(frame.arcs)) {
    throw new Error('@gx/primitives: donut rendering requires shared SeriesFrame.arcs geometry.')
  }
  if (frame.arcs.length === 0) return null

  const ids = new Set<string>()
  return (
    <>
      {frame.arcs.map((arc, index) => {
        validateArc(arc, index, ids)
        const isOther = arc.other || arc.label === 'Other'
        return (
          <path
            className={classes('gx-arc', isOther && 'gx-arc--other')}
            data-slice-id={arc.id}
            data-slice-index={index}
            data-slice-kind={isOther ? 'other' : 'value'}
            data-slice-label={arc.label}
            d={arc.d}
            key={arc.id}
            transform={translate(arc.cx, arc.cy)}
          />
        )
      })}
    </>
  )
}

function validateArc(
  arc: MarkRendererInput['frame']['arcs'][number],
  index: number,
  ids: Set<string>,
): void {
  if (typeof arc.id !== 'string' || arc.id.length === 0) {
    throw new Error(`@gx/primitives: donut slice ${index} requires a stable non-empty id.`)
  }
  if (ids.has(arc.id)) {
    throw new Error(`@gx/primitives: donut slice id '${arc.id}' is duplicated.`)
  }
  ids.add(arc.id)

  if (typeof arc.label !== 'string' || arc.label.length === 0) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' requires a non-empty label.`)
  }
  if (!Number.isFinite(arc.value) || arc.value < 0) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' requires a finite non-negative value.`)
  }
  if (!Number.isFinite(arc.share) || arc.share < 0 || arc.share > 1) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' has an invalid share.`)
  }
  if (!Number.isFinite(arc.startAngle) || !Number.isFinite(arc.endAngle) || arc.endAngle <= arc.startAngle) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' has invalid angle geometry.`)
  }
  if (
    !Number.isFinite(arc.cx) ||
    !Number.isFinite(arc.cy) ||
    !Number.isFinite(arc.innerRadius) ||
    !Number.isFinite(arc.outerRadius) ||
    arc.innerRadius < 0 ||
    arc.outerRadius <= 0 ||
    arc.innerRadius > arc.outerRadius
  ) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' has invalid radius geometry.`)
  }
  if (typeof arc.d !== 'string' || arc.d.length === 0) {
    throw new Error(`@gx/primitives: donut slice '${arc.id}' requires shared local path geometry.`)
  }
}

export const DONUT_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'donut',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'donut',
    markKinds: Object.freeze(['arc'] as const),
    render: renderDonut,
  }),
])
