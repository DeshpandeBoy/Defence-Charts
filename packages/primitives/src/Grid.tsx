/**
 * Gridlines, and the zero rule.
 *
 * `<rect>` for the same reason `<Axis>` uses one — decision 012. A gridline is the purest
 * case of the trap: it is one CSS length thick, that length is exactly the kind of thing a
 * theme wants to set, and `line { stroke-width: var(--gx-grid-width) }` would have worked,
 * which is what makes reaching for `<line>` so natural here.
 *
 * ⚠ **The zero rule is the one coordinate in this package that arrives absolute.**
 * `ChartFrame.zeroLine` is `yScale(0)` and every scale in `frame.ts` is built in absolute SVG
 * coordinates, whereas `ComputedTick.offset` has the origin subtracted back off. Both are
 * documented in `frame.ts`; the mismatch is real and the fix is to do the subtraction exactly
 * once, here, with this comment next to it. `frame.ts` names the failure mode directly:
 * *"every mark position depend[ing] on remembering to add the origin exactly once."*
 *
 * ## ⚠ Keyed by `tick.value`, never by `tick.offset`
 *
 * `offset` is a **pixel** position, so it changes on every resize. Keyed by it, React sees a
 * different key for the same gridline on every frame of a drag, unmounts it, and mounts a
 * replacement — and **a freshly mounted element has no previous value, so it cannot
 * transition**. That is measured, not assumed: the replaced-element case in
 * `research/decisions/016-what-svg-geometry-actually-transitions.md` produced no interpolated
 * frame at all, against seven geometry properties that all interpolate cleanly when the *same*
 * element is updated.
 *
 * So this is not a performance tidy-up. It is the precondition for
 * `MotionPlan.persistGridlines`, already `true` from the Panel rung up, and for
 * `research/10-responsive-ladder.md` §7's requirement: *"persist gridlines through a
 * densify/sparsify change — they are the landmarks that make an axis change comprehensible.
 * Do not remove and redraw."* Keyed by value, a gridline that survives a densify keeps its
 * identity and slides; one that genuinely leaves is a leave rather than part of a churn.
 *
 * ⚠ **No index suffix, and adding one back would reintroduce the bug.** An index changes when
 * the tick *count* changes, which is exactly the densify case this exists to survive.
 * Uniqueness comes from `computeTicks()` in `@gx/core`, which de-duplicates by value — d3's
 * `scale.ticks()` can repeat a value when the domain span is tiny relative to its magnitude.
 */

import { CHROME_METRICS, type ComputedTick, type Rect } from '@gx/core'

import { classes, roundCoord, translate } from './svg.ts'

export type GridProps = {
  readonly plot: Rect
  /** Vertical lines. Empty or omitted draws none. */
  readonly xTicks?: readonly ComputedTick[]
  /** Horizontal lines. */
  readonly yTicks?: readonly ComputedTick[]
  /** `ChartFrame.zeroLine`, in absolute SVG coordinates. `null` when 0 is outside the domain. */
  readonly zeroLine?: number | null
  readonly className?: string
  readonly xDashPhase?: number
  readonly xStrokeCap?: 'butt' | 'round' | 'square'
  readonly yDashPhase?: number
  readonly yStrokeCap?: 'butt' | 'round' | 'square'
}

export function Grid({
  plot,
  xTicks = [],
  yTicks = [],
  zeroLine = null,
  className,
  xDashPhase = 0,
  xStrokeCap = 'butt',
  yDashPhase = 0,
  yStrokeCap = 'butt',
}: GridProps) {
  const { axisRuleWidth } = CHROME_METRICS
  const width = roundCoord(plot.width)
  const height = roundCoord(plot.height)

  return (
    <g className={classes('gx-grid', className)} transform={translate(plot.x, plot.y)}>
      {yTicks.map((tick) => (
        <rect
          className="gx-grid__line"
          data-axis="y"
          key={`y-${tick.value}`}
          data-dash-phase={yDashPhase}
          data-stroke-cap={yStrokeCap}
          x={0}
          y={roundCoord(tick.offset)}
          width={width}
          height={axisRuleWidth}
        />
      ))}
      {xTicks.map((tick) => (
        <rect
          className="gx-grid__line"
          data-axis="x"
          key={`x-${tick.value}`}
          data-dash-phase={xDashPhase}
          data-stroke-cap={xStrokeCap}
          x={roundCoord(tick.offset)}
          y={0}
          width={axisRuleWidth}
          height={height}
        />
      ))}
      {zeroLine === null ? null : (
        <rect
          className="gx-grid__zero"
          x={0}
          // The single subtraction. See the module docblock.
          y={roundCoord(zeroLine - plot.y)}
          width={width}
          height={axisRuleWidth}
        />
      )}
    </g>
  )
}
