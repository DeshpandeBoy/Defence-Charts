/**
 * One series' area fill.
 *
 * Separate from `<LinePath>` rather than a `filled` prop on it, because the plan treats them
 * as separate decisions: `MarkSpec` is `{ kind: 'line', area: boolean }`, and the rungs turn
 * `area` on at Strip and off again at Canvas when series count rises. Two components make
 * that switch a presence question in the element snapshot instead of an attribute question.
 *
 * ⚠ Rendered *before* the line by every caller, so the stroke sits on top of its own fill.
 * Paint order in SVG is document order; there is no `z-index`.
 */

import { classes } from './svg.ts'

export type AreaPathProps = {
  /** `SeriesFrame.area`. `null` unless the plan asked for an area. */
  readonly d: string | null
  readonly className?: string
}

export function AreaPath({ d, className }: AreaPathProps) {
  if (d === null || d === '') return null
  return <path className={classes('shiftcharts-area', className)} d={d} />
}
