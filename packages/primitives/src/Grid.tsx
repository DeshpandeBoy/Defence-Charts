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
}

export function Grid({ plot, xTicks = [], yTicks = [], zeroLine = null, className }: GridProps) {
  const { axisRuleWidth } = CHROME_METRICS
  const width = roundCoord(plot.width)
  const height = roundCoord(plot.height)

  return (
    <g className={classes('gx-grid', className)} transform={translate(plot.x, plot.y)}>
      {yTicks.map((tick, i) => (
        <rect
          className="gx-grid__line"
          data-axis="y"
          key={`y-${tick.offset}-${i}`}
          x={0}
          y={roundCoord(tick.offset)}
          width={width}
          height={axisRuleWidth}
        />
      ))}
      {xTicks.map((tick, i) => (
        <rect
          className="gx-grid__line"
          data-axis="x"
          key={`x-${tick.offset}-${i}`}
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
