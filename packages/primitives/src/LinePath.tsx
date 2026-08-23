/**
 * One series' line.
 *
 * ⚠ **No d3 import in this package.** The `d` string arrives already built by
 * `@gx/core`'s `resolveFrame()`, which pins d3-shape's `.digits(2)` so the same data
 * produces the same characters on every run. Building the path here would put a numeric
 * generator on both sides of the RSC boundary and give the server and the client two
 * chances to disagree about a float.
 *
 * `d` is a genuine CSS property in SVG2 (decision 012's table) — but it is *data*, so it
 * stays an attribute. Rule 2 governs what a **theme** controls, not what the values control.
 */

import { classes } from './svg.ts'

export type LinePathProps = {
  /** `SeriesFrame.line`. `null` when the plan's mark kind is not `'line'`. */
  readonly d: string | null
  readonly className?: string
}

export function LinePath({ d, className }: LinePathProps) {
  // ⚠ `null` is the plan saying "not this mark", and the empty string is d3-shape saying
  // "nothing was defined". Both render nothing; neither is an error. An empty `<path d="">`
  // would still be an element in G14's snapshot, so it is not emitted.
  if (d === null || d === '') return null
  return <path className={classes('gx-line', className)} d={d} />
}
