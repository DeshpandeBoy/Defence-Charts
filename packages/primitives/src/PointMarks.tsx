/**
 * Point marks.
 *
 * ⚠ **`<circle>` is safe where `<line>` is not, and the difference is the whole of decision
 * 012.** SVG2 promoted `cx`, `cy` and `r` to CSS properties and browsers shipped them; it did
 * *not* promote `x1`/`y1`/`x2`/`y2`. So `r` can be a token — `circle { r: var(--gx-point-radius) }`
 * both parses and works — and no `r` attribute is emitted here. `cx`/`cy` stay attributes
 * because they are data.
 *
 * ## The filtering happens here, not in the frame
 *
 * `SeriesFrame.points` carries **every** defined point regardless of `marks.points.mode`, and
 * `frame.ts` says why: geometry belongs to the frame and the decision to draw belongs to the
 * plan. So `mode` is applied at render time. It is also what A5's crosshair searches over
 * while `mode` is `'none'` — the points exist, they are simply not painted.
 */

import type { PointPlan, PointPos, SeriesFrame } from '@gx/core'

import { classes, roundCoord } from './svg.ts'

export type PointMarksProps = {
  readonly points: readonly PointPos[]
  /** `SeriesFrame.extrema` — indices into `points`. Required by `mode: 'extrema'`. */
  readonly extrema?: SeriesFrame['extrema']
  readonly mode: PointPlan['mode']
  /**
   * `MarksPlan.pointBudget`. ⚠ A hard ceiling, not a hint: past it nothing is drawn rather
   * than a sample being drawn. A thinned scatter looks like data and is not, which is the
   * failure species this project keeps naming — and the plan already degrades the *mark* when
   * the budget is exceeded, so a renderer that quietly draws a subset would be contradicting
   * a decision the resolver already took.
   */
  readonly budget?: number
  readonly className?: string
}

export function PointMarks({ points, extrema, mode, budget, className }: PointMarksProps) {
  if (mode === 'none') return null

  const visible = selectIndices(points, extrema, mode)
  if (budget !== undefined && visible.length > budget) return null

  return (
    <>
      {visible.map((i) => {
        const p = points[i]
        if (p === undefined) return null
        return (
          <circle
            className={classes('gx-point', className)}
            key={i}
            data-index={i}
            cx={roundCoord(p.x)}
            cy={roundCoord(p.y)}
          />
        )
      })}
    </>
  )
}

/**
 * ⚠ Returned in ascending index order, and de-duplicated. A flat series has `min === max`, and
 * a two-point series can have `min === last`; emitting the same circle twice is invisible on
 * screen and doubles the element count G14 snapshots, so the bug would surface as an
 * unexplained snapshot churn rather than as anything you could see.
 */
function selectIndices(
  points: readonly PointPos[],
  extrema: SeriesFrame['extrema'] | undefined,
  mode: PointPlan['mode'],
): readonly number[] {
  if (mode === 'all') return points.map((_, i) => i)
  if (extrema === null || extrema === undefined) return []
  return [...new Set([extrema.min, extrema.max, extrema.last])].sort((a, b) => a - b)
}
