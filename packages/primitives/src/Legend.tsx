import { formatYLabel, type ChartPlan, type Series } from '@gx/core'

export type LegendProps = {
  readonly plan: ChartPlan['legend']
  readonly series: readonly Series[]
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
export function Legend({ plan, series, className }: LegendProps) {
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
  const rootClass = ['gx-legend', `gx-legend--${placement}`, className]
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
            className="gx-legend__item"
            data-series-id={item.id}
            data-series-index={index}
            key={item.id}
            role="listitem"
          >
            <span className="gx-legend__symbol" aria-hidden="true" />
            <span className="gx-legend__label" title={label}>{label}</span>
            {detail === null ? null : <span className="gx-legend__detail">{detail}</span>}
          </div>
        )
      })}
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
