/**
 * The value display: the big number in the band above the plot.
 *
 * ⚠ **This component exists because the band was already being reserved and nothing was
 * painting into it.** `layout.ts`'s `valueBand()` subtracts a strip off the top of the plot
 * whenever `narrative.valueDisplay` is not `'none'`, and `resolveFrame()` uses it as the
 * plot's `y` origin — so at Micro, whose plan is `marks.primary.kind: 'none'` and
 * `regionOrder: ['value','table']`, the *entire content of the rung* was a value display that
 * did not exist. The rendered output was an empty `<svg>` with three empty
 * `<g class="gx-series">` and a data table below it. Nothing in the geometry suite could see
 * it, because the geometry was right.
 *
 * ⚠ **Every number here was computed in `@gx/core` and none of it is recomputed.** The
 * fitted font size, each entry's x, the band's vertical centre, the formatted value, the
 * formatted delta and its direction all arrive on `ChartFrame['value']`. That is not
 * fastidiousness: the size the text is painted at is the exact inverse of the equation that
 * sized the band the plot was pushed down by, so a second opinion computed in a React render
 * would be a second opinion about the *plot*, arriving too late for anything to reconcile it.
 * `frame.ts`'s `fitValueDisplay()` carries the arithmetic and the proof.
 *
 * ## `font-size` is an attribute, and that is not a rule-2 exception
 *
 * ⚠ Rule 2 of `./index.ts` says every visual property comes from a class. `font-size` here
 * comes from an attribute, because it is computed per render from the height of the box the
 * chart was measured at — **it is data, not theme**. The rule's own note draws the line the
 * same way: *"rule 2 governs what a theme controls, not what the data controls"*, which is
 * why `d`, `cx`, `x` and `y` are attributes too. A stylesheet that could set this size could
 * make the text overflow a band that `valueBand()` already subtracted from the plot, and the
 * plot would not move — the same silent-overflow failure the whole file is written against.
 *
 * Everything a theme *does* control — fill, weight, letter-spacing, anchoring, the delta's
 * relative weight — is in `chart.css` under `.gx-value`.
 *
 * ## What is deliberately absent
 *
 * ⚠ No `<title>` and no `aria-label`. The value display is a *summary of the series*, and the
 * accessible equivalent is already in the tree: `./rungs/line.ts` keeps `dataTable.present`
 * true at both rungs that ask for a value display, and `<DataTable>` renders it in a real
 * `<table>` outside the `<svg>` with the series label beside the value. Naming a role-less
 * SVG `<text>` would duplicate that for some assistive technologies and be dropped by
 * others; the `<table>` works in all of them.
 */

import type { ValueFrame } from '@gx/core'

import { classes, roundCoord } from './svg.ts'

export type ValueDisplayProps = {
  /**
   * `ChartFrame['value']` — `null` when the plan asked for no value display, and the
   * component absorbs that rather than making every call site branch, exactly as
   * `<PointMarks>` absorbs `mode: 'none'`.
   */
  readonly value: ValueFrame | null
  readonly className?: string
}

export function ValueDisplay({ value, className }: ValueDisplayProps) {
  // Three ways to have nothing to draw, and all three are states rather than errors: no value
  // display in the plan, no series with a value to report, and a band with no area to paint
  // in. `<text font-size="0">` is an element that claims to paint and does not.
  if (value === null || value.fontSize <= 0 || value.entries.length === 0) return null

  const fontSize = roundCoord(value.fontSize)
  const { overflow } = value

  return (
    <g className={classes('gx-value-display', className)}>
      {value.entries.map((entry) => (
        <text
          className="gx-value"
          key={entry.seriesId}
          data-series-id={entry.seriesId}
          // ⚠ The series' index, straight off the frame — never the map's index. It is what
          // `chart.css` binds `--gx-series-color` from, and a series with no defined value
          // contributes no entry, so the two differ exactly when a chart has a silent series.
          data-series-index={entry.seriesIndex}
          x={roundCoord(entry.x)}
          y={roundCoord(entry.y)}
          fontSize={fontSize}
        >
          {entry.text}
          {entry.unit === null || entry.unit.length === 0 ? null : (
            <tspan className="gx-value__unit">{` ${entry.unit}`}</tspan>
          )}
          {entry.delta === null ? null : (
            /*
             * ⚠ The separating space is inside the string, not a `dx` on the tspan. `@gx/core`
             * fitted the width of `"36 +4"` including that space; a gap introduced here would
             * be a gap the fit never measured, and the text would run wider than the column it
             * was sized for.
            */
            <tspan className="gx-value__delta" data-direction={entry.delta.direction}>
              {` ${entry.delta.text}${entry.comparison === null ? '' : ` (${entry.comparison})`}`}
            </tspan>
          )}
          {entry.target === null ? null : (
            <tspan className="gx-value__target">{` target ${entry.target.text}`}</tspan>
          )}
          {entry.status === null ? null : (
            <tspan className="gx-value__status" data-status={entry.status}>
              {` status ${entry.status}`}
            </tspan>
          )}
          {entry.progress === undefined || entry.progress === null ? null : (
            <tspan
              className="gx-value__progress"
              data-progress-state={entry.progress.indeterminate ? 'indeterminate' : 'determinate'}
            >
              {entry.progress.indeterminate
                ? ' indeterminate'
                : entry.progress.overTarget !== null && entry.progress.overTarget > 0
                  ? ` over target ${entry.progress.overTargetText ?? ''}`
                  : entry.progress.remaining === null
                    ? ''
                    : ` remaining ${entry.progress.remainingText ?? ''}`}
            </tspan>
          )}
        </text>
      ))}

      {overflow === null ? null : (
        /*
         * ⚠ The entries that did not fit, said out loud. The alternative — showing one of
         * three series and looking complete — is a chart that lies about how many series it
         * has. `fitValueDisplay()` gives this marker a column of its own so it displaces
         * rather than overlaps, and the hidden values stay in the data table.
         */
        <text
          className="gx-value__overflow"
          data-hidden={overflow.hidden}
          x={roundCoord(overflow.x)}
          y={roundCoord(overflow.y)}
          fontSize={fontSize}
        >
          {overflow.text}
        </text>
      )}
    </g>
  )
}
