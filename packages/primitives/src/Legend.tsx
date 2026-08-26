import {
  formatYLabel,
  type ArcFrame,
  type CellFrame,
  type ChartPlan,
  type Series,
} from '@shiftcharts/core'

export type LegendProps = {
  readonly plan: ChartPlan['legend']
  readonly series: readonly Series[]
  /** Donut categories are slices, not a single source series. */
  readonly arcs?: readonly ArcFrame[] | undefined
  /** Heatmap cells are one intensity field, not a set of coloured source series. */
  readonly heatmapCells?: readonly CellFrame[] | undefined
  readonly className?: string | undefined
}

export type LegendEntry = {
  readonly series: Series
  readonly index: number
  readonly label: string
}

/** Resolve the entries a legend plan is allowed to expose. */
export function legendEntries(
  plan: ChartPlan['legend'],
  series: readonly Series[],
): readonly LegendEntry[] {
  if (plan.placement === 'absent' || plan.placement === 'direct') return []

  const limit = Math.max(0, Math.floor(plan.maxEntries))
  return series.slice(0, limit).map((item, index) => ({
    series: item,
    index,
    label: displayLabel(item),
  }))
}

/** Hook-free, static legend output; safe to render in an RSC. */
export function Legend({ plan, series, arcs, heatmapCells, className }: LegendProps) {
  if (heatmapCells !== undefined && heatmapCells.length > 0) {
    return <HeatmapLegend plan={plan} cells={heatmapCells} className={className} />
  }

  if (arcs !== undefined && arcs.length > 0) {
    return <ArcLegend plan={plan} arcs={arcs} className={className} />
  }

  const entries = legendEntries(plan, series)
  if (entries.length === 0) return null

  const values = entries.map(({ series: item }) => latestValue(item))
  const total = values.reduce<number>(
    (sum, value) => sum + (value === null ? 0 : Math.abs(value)),
    0,
  )
  const showValues = plan.placement === 'external' && plan.showValues
  const showPercent = plan.placement === 'external' && plan.showPercent
  const placement = plan.placement
  const position = plan.placement === 'external' ? plan.position : undefined
  const rootClass = ['shiftcharts-legend', `shiftcharts-legend--${placement}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      data-legend-placement={placement}
      data-legend-position={position}
      role="list"
      aria-label="Chart legend"
    >
      {entries.map(({ series: item, index, label }, entryIndex) => {
        const value = values[entryIndex] ?? null
        const percent = value === null || total === 0 ? null : (Math.abs(value) / total) * 100
        const detail = legendDetail(showValues, showPercent, value, percent)
        return (
          <div
            className="shiftcharts-legend__item"
            data-series-id={item.id}
            data-series-index={index}
            key={item.id}
            role="listitem"
          >
            <span className="shiftcharts-legend__symbol" aria-hidden="true" />
            <span className="shiftcharts-legend__label" title={label}>{label}</span>
            {detail === null ? null : <span className="shiftcharts-legend__detail">{detail}</span>}
          </div>
        )
      })}
    </div>
  )
}

function HeatmapLegend({
  plan,
  cells,
  className,
}: {
  readonly plan: ChartPlan['legend']
  readonly cells: readonly CellFrame[]
  readonly className?: string | undefined
}) {
  if (plan.placement === 'absent' || plan.placement === 'direct') return null
  const values = cells.flatMap((cell) =>
    cell.value !== null && cell.value !== undefined && Number.isFinite(cell.value)
      ? [cell.value]
      : [],
  )
  const minimum = values.length === 0 ? null : Math.min(...values)
  const maximum = values.length === 0 ? null : Math.max(...values)
  const rootClass = ['shiftcharts-legend', `shiftcharts-legend--${plan.placement}`, className]
    .filter(Boolean)
    .join(' ')
  const entries = [0, 1, 2, 3, 4] as const

  return (
    <div
      className={rootClass}
      data-legend-placement={plan.placement}
      data-legend-position={plan.placement === 'external' ? plan.position : undefined}
      data-legend-family="heatmap"
      role="list"
      aria-label="Heatmap intensity"
    >
      <span className="shiftcharts-legend__title">Intensity</span>
      {entries.map((intensity) => (
        <div
          className="shiftcharts-legend__item"
          data-heatmap-intensity={intensity}
          key={intensity}
          role="listitem"
        >
          <span className="shiftcharts-legend__symbol" aria-hidden="true" />
          <span className="shiftcharts-legend__label">{intensity === 0 ? 'Low' : intensity === 4 ? 'High' : ''}</span>
          {intensity === 0 && minimum !== null ? (
            <span className="shiftcharts-legend__detail">{formatYLabel(minimum)}</span>
          ) : intensity === 4 && maximum !== null ? (
            <span className="shiftcharts-legend__detail">{formatYLabel(maximum)}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ArcLegend({
  plan,
  arcs,
  className,
}: {
  readonly plan: ChartPlan['legend']
  readonly arcs: readonly ArcFrame[]
  readonly className?: string | undefined
}) {
  if (plan.placement === 'absent' || plan.placement === 'direct') return null
  const limit = Math.max(0, Math.floor(plan.maxEntries))
  const entries = arcs.slice(0, limit)
  const rootClass = ['shiftcharts-legend', `shiftcharts-legend--${plan.placement}`, className]
    .filter(Boolean)
    .join(' ')
  const showValues = plan.placement === 'external' && plan.showValues
  const showPercent = plan.placement === 'external' && plan.showPercent

  return (
    <div
      className={rootClass}
      data-legend-placement={plan.placement}
      data-legend-position={plan.placement === 'external' ? plan.position : undefined}
      data-legend-family="donut"
      role="list"
      aria-label="Donut categories"
    >
      {entries.map((arc, index) => (
        <div
          className="shiftcharts-legend__item"
          data-slice-id={arc.id}
          data-slice-index={index}
          data-slice-kind={arc.other ? 'other' : 'value'}
          data-slice-label={arc.label}
          key={arc.id}
          role="listitem"
        >
          <span className="shiftcharts-legend__symbol" aria-hidden="true" />
          <span className="shiftcharts-legend__label" title={arc.label}>{arc.label}</span>
          {showValues || showPercent ? (
            <span className="shiftcharts-legend__detail">
              {showValues ? formatYLabel(arc.value) : null}
              {showValues && showPercent ? ' · ' : null}
              {showPercent ? `${Math.round(arc.share * 100)}%` : null}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function displayLabel(series: Series): string {
  return typeof series.label === 'string' && series.label.trim().length > 0
    ? series.label
    : series.id
}

function latestValue(series: Series): number | null {
  for (let index = series.points.length - 1; index >= 0; index -= 1) {
    const value = series.points[index]?.y
    if (value !== null && value !== undefined && Number.isFinite(value)) return value
  }
  return null
}

function legendDetail(
  showValues: boolean,
  showPercent: boolean,
  value: number | null,
  percent: number | null,
): string | null {
  if (!showValues && !showPercent) return null

  const parts: string[] = []
  if (showValues) parts.push(value === null ? '—' : formatYLabel(value))
  if (showPercent) parts.push(percent === null ? '—' : `${Math.round(percent)}%`)
  return parts.join(' · ')
}
