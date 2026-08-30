/**
 * An axis: a rule, and a tick per `ComputedTick`.
 *
 * ⚠ **Every tick is a `<rect>`, never a `<line>`.** `x1`/`y1`/`x2`/`y2` are not CSS-settable
 * in any browser and none is planned, so `line { y2: var(--shiftcharts-tick-length) }` parses, passes
 * the token gate, builds, warns about nothing, and does nothing — see
 * `research/decisions/012-no-line-element-for-tokened-geometry.md` for the SVG2 property
 * table and the element census (Vega ships 28 `<line>` elements, Observable Plot ships 0).
 * A `<rect>` gives two plain CSS lengths instead. Gate **G14** asserts the absence.
 *
 * ## Why the tick geometry arrives as attributes and not as CSS
 *
 * It looks like the exception to rule 2 — *everything visual comes from a class* — and it is
 * not, because tick length is not visual. `xAxisBand()` in `@shiftcharts/core`'s `layout.ts` folds
 * `PlanPolicy.tickLength` into the vertical band it subtracts from the plot. A theme that set a tick
 * length in CSS would move the glyphs and leave the band where it was, and the chart would be
 * subtly, unfixably wrong in a way no stylesheet-parsing gate can see. So the numbers come
 * from the resolved `PlanPolicy`, which is the same policy the resolver subtracted against.
 *
 * Everything genuinely visual — colour, stroke, font, `text-anchor`, `dominant-baseline` — is
 * a class, as the rule requires.
 *
 * ## The render prop
 *
 * `children` is visx's `tickLabelProps`-as-function pattern, one level up: a consumer that
 * wants different tick content gets the resolved ticks and returns its own nodes, without
 * having to re-derive an offset or re-read the plan. Absent, the default ticks render.
 */

import {
  DEFAULT_POLICY,
  lineHeight,
  type ComputedTick,
  type PlanPolicy,
  type Rect,
} from '@shiftcharts/core'
import type { ReactNode } from 'react'

import { classes, roundCoord, translate } from './svg.ts'

export type AxisProps = {
  readonly orientation: 'x' | 'y'
  readonly ticks: readonly ComputedTick[]
  /** The plot rect, in absolute SVG coordinates. The axis places itself against it. */
  readonly plot: Rect
  /** Draw the domain rule. `AxisPlan.domainLine`. */
  readonly rule?: boolean
  /** Draw the tick marks themselves. Labels without marks is a legitimate sparse style. */
  readonly marks?: boolean
  readonly labels?: boolean
  /** Visible axis title; geometry is rendered only when the resolved plan reserved it. */
  readonly title?: string | undefined
  /** Optional measured gutter offset for a rotated y-axis title. */
  readonly titleOffset?: number | undefined
  readonly className?: string
  readonly children?: (ticks: readonly ComputedTick[]) => ReactNode
  readonly labelFlush?: boolean | number
  /** Clip axis content to the plot-aligned viewport along the axis direction. */
  readonly labelBound?: boolean | number
  readonly tickBand?: 'center' | 'extent'
  readonly translateOffset?: number
  /** The same resolved policy used to produce the frame and plot box. */
  readonly policy?: PlanPolicy
  /** Stable id supplied by `<Chart>` so multiple charts cannot share a clip path. */
  readonly clipId?: string
}

export function Axis({
  orientation,
  ticks,
  plot,
  rule = true,
  marks = true,
  labels = true,
  title,
  titleOffset,
  className,
  children,
  labelFlush = false,
  labelBound = false,
  tickBand = 'center',
  translateOffset = 0,
  clipId,
  policy = DEFAULT_POLICY,
}: AxisProps) {
  const horizontal = orientation === 'x'
  const { tickLength, tickLabelGap, axisRuleWidth } = policy
  const flushLabels = labelFlush === true || (typeof labelFlush === 'number' && labelFlush > 0)
  const boundLabels = labelBound === true || (typeof labelBound === 'number' && labelBound > 0)
  const axisClipId = clipId ?? `shiftcharts-axis-${orientation}-bound`
  // Band ticks are positioned at the edge of their cell; the half-pixel correction keeps the
  // rect's visible edge on the same coordinate as the continuous-axis center position.
  const tickBandOffset = tickBand === 'extent' ? -0.5 : 0

  // ⚠ The x axis hangs off the *bottom* of the plot and the y axis stands at its *left*, so
  // only the x translate carries the plot height. Tick offsets are already plot-relative
  // (`ComputedTick.offset` — "px along the axis from the plot's origin"), which is what lets
  // the group move as a unit and the ticks travel with it.
  const origin = horizontal
    ? translate(plot.x + translateOffset, plot.y + plot.height + translateOffset)
    : translate(plot.x - translateOffset, plot.y + translateOffset)

  // The label sits past the tick on the far side from the plot. Its alignment is a class,
  // because alignment is visual; its distance is an attribute, because the resolver already
  // subtracted that distance from the plot.
  const labelOffset = tickLength + tickLabelGap
  const titleDistance = horizontal
    ? labelOffset + (labels ? lineHeight('D', policy) : 0) + policy.axisTitleGap
    : titleOffset ?? labelOffset + lineHeight('D', policy) + policy.axisTitleGap

  return (
    <g
      className={classes('shiftcharts-axis', `shiftcharts-axis--${orientation}`, className)}
      data-axis={orientation}
      data-tick-band={tickBand}
      data-label-bound={boundLabels ? '' : undefined}
      clipPath={boundLabels ? `url(#${axisClipId})` : undefined}
      transform={origin}
    >
      {boundLabels ? (
        <clipPath id={axisClipId} clipPathUnits="userSpaceOnUse">
          <rect
            x={horizontal ? 0 : -roundCoord(plot.width)}
            y={0}
            width={horizontal ? roundCoord(plot.width) : roundCoord(plot.width)}
            height={roundCoord(plot.height)}
          />
        </clipPath>
      ) : null}

      {rule ? (
          <rect
            className="shiftcharts-axis__rule"
            x={horizontal ? 0 : -axisRuleWidth}
            y={0}
            width={horizontal ? roundCoord(plot.width) : axisRuleWidth}
            height={horizontal ? axisRuleWidth : roundCoord(plot.height)}
          />
        ) : null}

      {children
          ? children(ticks)
          : ticks.map((tick, i) => (
            // ⚠ **Keyed by value.** This read `${tick.offset}-${i}` until A6, and the old
            // reasoning was sound but aimed one step short: offset alone does collide when two
            // ticks land on the same pixel, and index alone does break object constancy. The
            // index suffix fixed the collision and *kept* the deeper problem — `offset` is a
            // pixel position, so every tick was replaced on every frame of a drag, and a
            // replaced element cannot transition at all. Measured in
            // `research/decisions/016-what-svg-geometry-actually-transitions.md`: seven
            // geometry properties interpolate when the same element is updated, and none do
            // when it is swapped.
            //
            // `value` is stable across a resize by construction — it is the domain value, not
            // a rendering of it — and `computeTicks()` in `@shiftcharts/core` de-duplicates by it, so
            // the pixel collision the old key defended against cannot reach here.
            <g
              className="shiftcharts-axis__tick"
              key={String(tick.value)}
              data-value={String(tick.value)}
              transform={
                horizontal
                  ? translate(tick.offset + tickBandOffset, 0)
                  : translate(0, tick.offset + tickBandOffset)
              }
            >
              {marks ? (
                <rect
                  className="shiftcharts-axis__tick-mark"
                  x={horizontal ? -axisRuleWidth / 2 : -tickLength}
                  y={horizontal ? 0 : -axisRuleWidth / 2}
                  width={horizontal ? axisRuleWidth : tickLength}
                  height={horizontal ? tickLength : axisRuleWidth}
                />
              ) : null}
              {labels && tick.label !== '' ? (
                <text
                  className="shiftcharts-axis__tick-label"
                  x={horizontal ? 0 : -labelOffset}
                  y={horizontal ? labelOffset : 0}
                  // ⚠ An anchor hint, not an anchor. CSS reads it
                  // (`[data-anchor='start'] { text-anchor: start }`) so that rule 2 holds and a
                  // theme can still override it. The first and last x labels anchor inward
                  // because a middle-anchored label at offset 0 overhangs the plot by half its
                  // width, and the y gutter was never sized for it.
                  data-anchor={
                    horizontal
                      ? (flushLabels && i === 0)
                        ? 'start'
                        : (flushLabels && i === ticks.length - 1)
                          ? 'end'
                          : 'middle'
                      : 'end'
                  }
                >
                  {tick.label}
                </text>
              ) : null}
            </g>
        ))}
      {title === undefined || title === '' ? null : (
        <text
          className="shiftcharts-axis__title"
          x={horizontal ? plot.width / 2 : -titleDistance}
          y={horizontal ? titleDistance : plot.height / 2}
          transform={horizontal ? undefined : `rotate(-90 ${roundCoord(-titleDistance)} ${roundCoord(plot.height / 2)})`}
        >
          {title}
        </text>
      )}
    </g>
  )
}
