/**
 * The data table — the chart's text equivalent, and the only part of this package a screen
 * reader can actually read row by row.
 *
 * ⚠ **It lives in `<figcaption>`, outside the `<svg>`, and that placement is load-bearing.**
 * A `<table>` inside an `<svg>` is not a table: SVG's content model does not include HTML
 * flow content, so browsers parse it into the SVG namespace where `<tr>` and `<td>` have no
 * meaning and no table semantics reach the accessibility tree. It renders as nothing and
 * announces as nothing. Outside the `<svg>` and inside the `<figure>`, it is an ordinary
 * table associated with an ordinary figure.
 *
 * ⚠ **`<details>` and not a button with state.** `DataTablePlan.disclosure` asks for a
 * disclosure control, and this package may not hold state — rule 1. `<details>`/`<summary>` is
 * the disclosure widget the platform already ships: it toggles with **zero client JavaScript**,
 * which is the same property gate G4 exists to defend, and it is keyboard-operable and
 * correctly announced without an `aria-expanded` of our own. A `<button onClick>` here would
 * have made the package client-only to save nothing.
 *
 * ⚠ **`x` values come from the raw `Series`, not from the frame.** `PointPos` carries pixel
 * coordinates and the `y` value, but the `x` *value* is spent by the time the frame is built.
 * A table of pixel offsets is a table that looks right and says nothing.
 */

import {
  type DataTablePlan,
  formatXLabel,
  formatYLabel,
  type Series,
} from '@gx/core'

import { classes } from './svg.ts'

export type DataTableProps = {
  readonly data: readonly Series[]
  readonly plan: DataTablePlan
  /** Names the table for assistive technology. `<Chart>` passes its own title through. */
  readonly caption: string
  /** Progress asks the summary table to expose target-relative state text. */
  readonly progress?: boolean | undefined
  /** Heatmap keeps the static value table as the non-colour equivalent. */
  readonly heatmap?: boolean | undefined
  /** Funnel exposes ordered stage conversion and drop-off as text, not colour-only shape. */
  readonly funnel?: boolean | undefined
  readonly className?: string
}

export function DataTable({ data, plan, caption, progress = false, heatmap = false, funnel = false, className }: DataTableProps) {
  if (!plan.present) return null

  const table =
    funnel ? (
      <FunnelTable data={data} caption={caption} />
    ) : plan.columns === 'summary' || progress ? (
      <SummaryTable data={data} caption={caption} progress={progress} heatmap={heatmap} />
    ) : (
      <FullTable data={data} caption={caption} />
    )

  return (
    <details className={classes('gx-data-table', className)} open={plan.initiallyExpanded}>
      <summary className="gx-data-table__summary">{caption}</summary>
      {table}
    </details>
  )
}

/** One row per x value, one column per series. The chart, transcribed. */
function FullTable({ data, caption }: { data: readonly Series[]; caption: string }) {
  // ⚠ Sorted, de-duplicated, and taken across *all* series — series need not share an x axis
  // sampling, and a table keyed off the first series silently drops every point the others
  // have and it does not.
  const xs = [...new Set(data.flatMap((s) => s.points.map((p) => key(p.x))))].sort(
    (a, b) => a - b,
  )
  const temporal = data.length > 0 && data.every((s) => s.points.every((p) => p.x instanceof Date))
  const byX = data.map((s) => new Map(s.points.map((p) => [key(p.x), p.y])))

  return (
    <table className="gx-data-table__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{temporal ? 'Time' : 'X'}</th>
          {data.map((s) => (
            <th key={s.id} scope="col">
              {s.label ?? s.id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {xs.map((x) => (
          <tr key={x}>
            <th scope="row">{formatXLabel(temporal ? new Date(x) : x)}</th>
            {byX.map((m, i) => {
              const y = m.get(x)
              return (
                <td key={data[i]?.id ?? i}>
                  {/* ⚠ An em dash, not `0` and not the empty string. `y: null` is a gap —
                      §1.4's rule that null is a value rather than an absence — and a blank
                      cell reads as "not measured yet" while a zero reads as "measured, and it
                      was zero". Only one of those is true. */}
                  {y === undefined || y === null ? '—' : formatYLabel(y)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** One row per series: min, max, last. What `DataTablePlan.columns: 'summary'` asks for. */
function SummaryTable({
  data,
  caption,
  progress,
  heatmap,
}: {
  readonly data: readonly Series[]
  readonly caption: string
  readonly progress: boolean
  readonly heatmap: boolean
}) {
  const metric = progress || heatmap || data.some(
    (series) =>
      (series.unit !== undefined && series.unit !== null && series.unit.length > 0) ||
      series.target !== undefined ||
      (series.status !== undefined && series.status !== null),
  )
  return (
    <table className="gx-data-table__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Series</th>
          <th scope="col">Min</th>
          <th scope="col">Max</th>
          <th scope="col">Latest</th>
          {metric ? <th scope="col">Unit</th> : null}
          {metric ? <th scope="col">Target</th> : null}
          {metric ? <th scope="col">Status</th> : null}
          {metric ? <th scope="col">Direction</th> : null}
          {progress ? <th scope="col">Remaining</th> : null}
          {progress ? <th scope="col">Over target</th> : null}
          {progress ? <th scope="col">Progress state</th> : null}
        </tr>
      </thead>
      <tbody>
        {data.map((s) => {
          const ys = s.points
            .map((p) => p.y)
            .filter((y): y is number => y !== null && Number.isFinite(y))
          const latest = ys[ys.length - 1]
          const previous = ys[ys.length - 2]
          const direction =
            latest === undefined || previous === undefined
              ? '—'
              : latest > previous
                ? 'up'
                : latest < previous
                ? 'down'
                : 'flat'
          const target =
            s.target !== undefined && s.target !== null && Number.isFinite(s.target) && s.target > 0
              ? s.target
              : null
          const remaining = latest === undefined || target === null ? null : Math.max(0, target - latest)
          const overTarget = latest === undefined || target === null ? null : Math.max(0, latest - target)
          return (
            <tr key={s.id}>
              <th scope="row">{s.label ?? s.id}</th>
              <td>{ys.length === 0 ? '—' : formatYLabel(Math.min(...ys))}</td>
              <td>{ys.length === 0 ? '—' : formatYLabel(Math.max(...ys))}</td>
              <td>{latest === undefined ? '—' : formatYLabel(latest)}</td>
              {metric ? (
                <td>{s.unit === undefined || s.unit === null || s.unit === '' ? '—' : s.unit}</td>
              ) : null}
              {metric ? (
                <td>
                  {s.target !== undefined && s.target !== null && Number.isFinite(s.target)
                    ? formatYLabel(s.target)
                    : '—'}
                </td>
              ) : null}
              {metric ? <td>{s.status ?? '—'}</td> : null}
              {metric ? <td>{direction}</td> : null}
              {progress ? <td>{remaining === null ? '—' : formatYLabel(remaining)}</td> : null}
              {progress ? <td>{overTarget === null ? '—' : formatYLabel(overTarget)}</td> : null}
              {progress ? <td>{remaining === null ? 'indeterminate' : 'determinate'}</td> : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FunnelTable({ data, caption }: { readonly data: readonly Series[]; readonly caption: string }) {
  const series = data[0]
  const stages = [...(series?.points ?? [])].sort((a, b) => key(a.x) - key(b.x))
  const first = stages.find((point) => point.y !== null && Number.isFinite(point.y))?.y ?? null

  return (
    <table className="gx-data-table__table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Stage</th>
          <th scope="col">Value</th>
          <th scope="col">Conversion</th>
          <th scope="col">Drop-off</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((point, index) => {
          const previous = stages[index - 1]?.y
          const conversion = point.y !== null && first !== null && first > 0 ? point.y / first : null
          const dropoff = point.y !== null && previous !== null && previous !== undefined && previous > 0
            ? Math.max(0, (previous - point.y) / previous)
            : null
          return (
            <tr key={`${key(point.x)}:${index}`}>
              <th scope="row">{formatXLabel(point.x)}</th>
              <td>{point.y === null ? '—' : formatYLabel(point.y)}</td>
              <td>{conversion === null ? '—' : `${formatPercent(conversion)}`}</td>
              <td>{dropoff === null ? '—' : `${formatPercent(dropoff)}`}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

function key(x: number | Date): number {
  return x instanceof Date ? x.getTime() : x
}
