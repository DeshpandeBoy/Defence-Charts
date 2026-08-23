/**
 * Direct labels: the series' name at the end of its own line, and values on the marks.
 *
 * ⚠ **Direct labelling is not a decoration, it is the small-size legend.** `LegendPlan` has a
 * `'direct'` placement precisely so that the ladder can drop the legend band and put the name
 * where the eye already is; `layout.ts`'s `legendBands()` returns nothing for it. So a plan
 * with `labels.seriesLabels: 'direct-end'` and no `<Labels>` in the tree renders a
 * multi-series chart with no way to tell the series apart, and every geometry assertion still
 * passes.
 *
 * ⚠ **The label is drawn outside the plot rect, on purpose.** `yAxisGutter()` reserves space
 * on the left and nothing reserves it on the right, because at A3 there was no renderer to
 * reserve it for. The text therefore overhangs into whatever margin the box has. That is a
 * known, bounded imprecision — `LabelsPlan.maxChars` caps the width — and the honest fix is a
 * right gutter in `layout.ts`, which moves all six G9 rung snapshots and is therefore a
 * B-milestone change, not an A4 one.
 */

import { CHROME_METRICS, formatYLabel, type LabelsPlan, type SeriesFrame } from '@gx/core'

import { classes, roundCoord } from './svg.ts'

export type LabelsProps = {
  readonly series: SeriesFrame
  readonly seriesLabels: LabelsPlan['seriesLabels']
  readonly valueLabels: LabelsPlan['valueLabels']
  /** `LabelsPlan.maxChars`. `null` means no cap. */
  readonly maxChars?: number | null
  readonly className?: string
}

export function Labels({
  series,
  seriesLabels,
  valueLabels,
  maxChars = null,
  className,
}: LabelsProps) {
  const last = series.points.at(-1)
  const indices = valueIndices(series, valueLabels)

  return (
    <>
      {seriesLabels === 'direct-end' && last !== undefined ? (
        <text
          className={classes('gx-label', className)}
          x={roundCoord(last.x + CHROME_METRICS.regionGap)}
          y={roundCoord(last.y)}
        >
          {truncate(series.label, maxChars)}
        </text>
      ) : null}

      {indices.map((i) => {
        const p = series.points[i]
        if (p === undefined) return null
        return (
          <text
            className={classes('gx-value-label', className)}
            key={i}
            data-index={i}
            x={roundCoord(p.x)}
            // Above the mark. `CHROME_METRICS.regionGap` and not a new constant, because a
            // fifth Tier-C number would need its own argument and this one already means
            // "the smallest gap that reads as separation".
            y={roundCoord(p.y - CHROME_METRICS.regionGap)}
          >
            {formatYLabel(p.value)}
          </text>
        )
      })}
    </>
  )
}

function valueIndices(
  series: SeriesFrame,
  mode: LabelsPlan['valueLabels'],
): readonly number[] {
  if (mode === 'none') return []
  if (mode === 'all') return series.points.map((_, i) => i)
  if (series.extrema === null) return []
  return [...new Set([series.extrema.min, series.extrema.max, series.extrema.last])].sort(
    (a, b) => a - b,
  )
}

/**
 * ⚠ **`…` (U+2026), and it counts as one of the `maxChars`.** `LabelsPlan.maxChars` is what
 * `measureText()` sized the space against, so a truncation that appends an ellipsis *past* the
 * cap produces a label wider than the one the resolver approved — the overflow the cap exists
 * to prevent, introduced by the code enforcing it.
 */
function truncate(text: string, maxChars: number | null): string {
  if (maxChars === null || maxChars <= 0 || text.length <= maxChars) return text
  if (maxChars === 1) return '…'
  return `${text.slice(0, maxChars - 1)}…`
}
