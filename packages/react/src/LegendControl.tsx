'use client'

import type { ChartPlan, Series } from '@gx/core'

export type LegendControlProps = {
  readonly plan: ChartPlan
  readonly series: readonly Series[]
  readonly hiddenSeriesIds: readonly string[]
  readonly onVisibilityChange: (seriesId: string, visible: boolean) => void
  readonly className?: string | undefined
}

/** Controlled client legend. The parent owns visibility; this component emits intent only. */
export function LegendControl({
  plan,
  series,
  hiddenSeriesIds,
  onVisibilityChange,
  className,
}: LegendControlProps) {
  if (!plan.interaction.legendToggle) return null
  if (plan.legend.placement === 'absent' || plan.legend.placement === 'direct') return null

  const hidden = new Set(hiddenSeriesIds)
  const limit = Math.max(0, Math.floor(plan.legend.maxEntries))
  const entries = series.slice(0, limit)
  if (entries.length === 0) return null

  const rootClass = [
    'gx-legend',
    'gx-legend--control',
    `gx-legend--${plan.legend.placement}`,
    className,
  ].filter(Boolean).join(' ')
  const position = plan.legend.placement === 'external' ? plan.legend.position : undefined

  return (
    <div
      className={rootClass}
      data-legend-placement={plan.legend.placement}
      data-legend-position={position}
      role="list"
      aria-label="Chart legend"
    >
      {entries.map((item, index) => {
        const label = displayLabel(item)
        const visible = !hidden.has(item.id)
        return (
          <div
            className="gx-legend__item"
            data-series-id={item.id}
            data-series-index={index}
            key={item.id}
            role="listitem"
          >
            <button
              aria-pressed={visible}
              className="gx-legend__control"
              onClick={() => onVisibilityChange(item.id, !visible)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.currentTarget.click()
              }}
              type="button"
            >
              <span className="gx-legend__symbol" aria-hidden="true" />
              <span className="gx-legend__label">{label}</span>
            </button>
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
