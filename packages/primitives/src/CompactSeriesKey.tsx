/**
 * The identity rail used when a compact chart has more series than its value band can name.
 *
 * This is deliberately SVG, not an absolutely positioned HTML legend. An HTML overlay has no
 * relationship to the plot coordinates and can sit on top of a line after the SVG is resized.
 * The key consumes the plan's internal-legend state when present. A reserved core rail is
 * reconstructed from the same policy metrics and painted above the already-shifted plot; legacy
 * overlay and Tile fallback states use the plot origin as a compatibility anchor and transform
 * the plot into the remaining rail below it. Both paths preserve static/RSC rendering.
 */

import {
  lineHeight,
  measureText,
  type ChartFrame,
  type ChartPlan,
  type PlanPolicy,
} from '@gx/core'

import { classes, roundCoord } from './svg.ts'

type RectLike = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type LegendRegionState = {
  readonly region: RectLike
}

type FrameWithLegend = ChartFrame & {
  /** Compatibility shape for a future core frame that charges an internal legend explicitly. */
  readonly legend?: LegendRegionState | undefined
}

type CompactSeriesKeyItem = {
  readonly id: string
  readonly index: number
  readonly label: string
  readonly kind: 'series' | 'slice'
  readonly other?: boolean | undefined
}

export type CompactSeriesKeyLayout = {
  readonly source: 'core' | 'fallback'
  readonly region: RectLike
  readonly plotTransform: string | null
  readonly entries: readonly CompactSeriesKeyEntry[]
  readonly hidden: number
  readonly more: { readonly x: number; readonly y: number } | null
}

export type CompactSeriesKeyEntry = {
  readonly id: string
  readonly index: number
  readonly label: string
  readonly visibleLabel: string
  readonly kind: CompactSeriesKeyItem['kind']
  readonly other: boolean
  readonly x: number
  readonly y: number
  readonly swatch: number
}

export type CompactSeriesKeyProps = {
  readonly layout: CompactSeriesKeyLayout
  readonly className?: string | undefined
}

/**
 * Resolve whether a compact identity rail is needed and where it can safely live.
 *
 * `frame.legend.region` is intentionally read structurally. The current core frame does not yet
 * expose that region, but accepting it here means a later core contract can charge the legend
 * without making this renderer invent a second layout path. The fallback is only used for an
 * internal legend or a multi-series Tile with no explicit legend state.
 */
export function compactSeriesKeyLayout(
  frame: ChartFrame,
  plan: ChartPlan,
  policy: PlanPolicy,
): CompactSeriesKeyLayout | null {
  const internal = plan.legend.placement === 'internal'
  const tileFallback =
    plan.sizeClass === 'tile' &&
    plan.legend.placement === 'absent' &&
    frame.series.length > 1 &&
    // Heatmap Tile already names each row beside its summary value. A second identity rail has
    // no new information and, with no plotted cells, competes with the disclosure caption.
    !(plan.type === 'heatmap' && (frame.value?.entries.length ?? 0) > 0)
  if (!internal && !tileFallback) return null

  const items: readonly CompactSeriesKeyItem[] =
    plan.type === 'donut'
      ? frame.series.flatMap((series) =>
          series.arcs.map((arc, index) => ({
            id: arc.id,
            index,
            label: arc.label,
            kind: 'slice' as const,
            other: arc.other,
          })),
        )
      : frame.series.map((item) => ({ id: item.id, index: item.index, label: item.label, kind: 'series' as const }))

  const explicit = (frame as FrameWithLegend).legend?.region
  if (isRectLike(explicit)) {
    return buildEntries(items, explicit, policy, 'core')
  }

  const maxEntries =
    plan.legend.placement === 'internal'
      ? Math.max(0, Math.floor(plan.legend.maxEntries))
      : Math.max(0, Math.floor(policy.legendMaxEntries))
  const series = items.slice(0, maxEntries)
  const hidden = Math.max(0, items.length - series.length)
  if (series.length === 0) return null

  // A reserved internal legend is already part of the core plot contract. The frame's plot
  // origin has been pushed below that band, so adding the fallback transform here would charge
  // the same pixels twice. Reconstruct the charged band from the same serialisable policy
  // inputs and anchor the key above the plot; the marks remain in the frame coordinates.
  if (internal && plan.legend.flow === 'reserved') {
    const gap = Math.max(0, policy.regionGap)
    const width = Math.max(0, frame.box.width - gap * 2)
    const labels = compactLabels(series, hidden, width, policy)
    const itemCount = series.length + (hidden > 0 ? 1 : 0)
    const railHeight = gap + lineHeight('C', policy)
    const region = Object.freeze({
      x: frame.plot.x,
      y: Math.max(0, frame.plot.y - railHeight),
      width,
      height: railHeight,
    })
    return buildEntries(series, region, policy, 'core', hidden, itemCount, 0, labels.labels, null)
  }

  const rowHeight = lineHeight('C', policy)
  const gap = Math.max(0, policy.regionGap)
  const width = Math.max(0, frame.box.width - gap * 2)
  const keyLabels = compactLabels(series, hidden, width, policy)
  const columns = chooseColumns(
    [...keyLabels.widths, ...(hidden > 0 ? [keyLabels.moreWidth] : [])],
    width,
    policy,
  )
  const itemCount = series.length + (hidden > 0 ? 1 : 0)
  const rows = Math.max(1, Math.ceil(itemCount / columns))
  const railHeight = gap + rows * rowHeight + Math.max(0, rows - 1) * gap
  const plotOrigin = finite(frame.plot.y) ? Math.max(0, frame.plot.y) : 0
  const plotHeight = Math.max(0, finite(frame.plot.height))
  const reserved = Math.min(railHeight, Math.max(0, frame.box.height - plotOrigin))
  const region = Object.freeze({
    x: frame.plot.x + gap,
    y: plotOrigin,
    width,
    height: reserved,
  })

  return buildEntries(
    series,
    region,
    policy,
    'fallback',
    hidden,
    columns,
    plotHeight,
    keyLabels.labels,
    computePlotTransform(
      frame.plot.y,
      frame.plot.height,
      plotOrigin + reserved,
      Math.max(0, plotHeight - reserved),
    ),
  )
}

/** Static SVG output; no hooks, refs, DOM reads, or client boundary. */
export function CompactSeriesKey({ layout, className }: CompactSeriesKeyProps) {
  return (
    <g
      className={classes('gx-compact-key', className)}
      data-legend-placement="internal"
      data-legend-source={layout.source}
      data-legend-rail-height={roundCoord(layout.region.height)}
      data-hidden={layout.hidden > 0 ? layout.hidden : undefined}
      role="list"
      aria-label="Chart legend"
    >
      <title>Chart series</title>
      {layout.entries.map((entry) => (
        <g
          className="gx-compact-key__entry"
          data-series-id={entry.id}
          data-series-index={entry.kind === 'series' ? entry.index : undefined}
          data-slice-index={entry.kind === 'slice' ? entry.index : undefined}
          data-slice-kind={entry.kind === 'slice' ? (entry.other ? 'other' : 'value') : undefined}
          key={entry.id}
          role="listitem"
          aria-label={entry.label}
        >
          <rect
            className="gx-compact-key__swatch"
            data-series-index={entry.kind === 'series' ? entry.index : undefined}
            data-slice-index={entry.kind === 'slice' ? entry.index : undefined}
            data-slice-kind={entry.kind === 'slice' ? (entry.other ? 'other' : 'value') : undefined}
            x={roundCoord(entry.x)}
            y={roundCoord(entry.y - entry.swatch / 2)}
            width={roundCoord(entry.swatch)}
            height={roundCoord(entry.swatch)}
          />
          <text
            className="gx-compact-key__label"
            data-series-index={entry.index}
            x={roundCoord(entry.x + entry.swatch)}
            y={roundCoord(entry.y)}
          >
            {entry.visibleLabel}
          </text>
        </g>
      ))}
      {layout.hidden > 0 ? (
        <text
          className="gx-compact-key__more"
          data-hidden={layout.hidden}
          x={roundCoord(layout.more?.x ?? layout.region.x)}
          y={roundCoord(layout.more?.y ?? layout.region.y)}
          aria-label={`${layout.hidden} additional series`}
        >
          +{layout.hidden}
        </text>
      ) : null}
    </g>
  )
}

function buildEntries(
  series: readonly CompactSeriesKeyItem[],
  region: RectLike,
  policy: PlanPolicy,
  source: CompactSeriesKeyLayout['source'],
  hidden = 0,
  columns?: number,
  plotHeight = 0,
  visibleLabels?: readonly string[],
  plotTransformOverride?: string | null,
): CompactSeriesKeyLayout {
  const style = policy.typography.byRank.C
  const swatch = Math.max(0, style.fontSize)
  const gap = Math.max(0, policy.regionGap)
  const rowHeight = lineHeight('C', policy)
  const labels = visibleLabels ?? compactLabels(series, hidden, region.width, policy).labels
  const itemWidths = labels.map((label) => itemWidth(label, policy, swatch))
  const count = series.length + (hidden > 0 ? 1 : 0)
  const resolvedColumns = Math.max(
    1,
    Math.min(count, columns ?? chooseColumns(itemWidths, region.width, policy)),
  )
  const columnGap = Math.max(0, policy.regionGap)
  const contentWidth = Math.max(0, region.width - columnGap * Math.max(0, resolvedColumns - 1))
  const cellWidth = resolvedColumns > 0 ? contentWidth / resolvedColumns : region.width
  const position = (itemIndex: number): { readonly x: number; readonly y: number } => {
    const row = Math.floor(itemIndex / resolvedColumns)
    const column = itemIndex % resolvedColumns
    return {
      x: region.x + column * (cellWidth + columnGap) + gap,
      y: region.y + row * (rowHeight + gap) + rowHeight / 2,
    }
  }

  return Object.freeze({
    source,
    region: Object.freeze(region),
    plotTransform:
      plotTransformOverride !== undefined
        ? plotTransformOverride
        : source === 'fallback' && region.height > 0
          ? computePlotTransform(
              region.y,
              plotHeight,
              region.y + region.height + policy.regionGap,
              Math.max(0, plotHeight - region.height - policy.regionGap),
            )
          : null,
    entries: Object.freeze(
      series.map((item, itemIndex) => {
        const point = position(itemIndex)
        return Object.freeze({
          id: item.id,
          index: item.index,
          kind: item.kind,
          other: item.other === true,
          label: displayLabel(item.label, item.id),
          visibleLabel: labels[itemIndex] ?? displayLabel(item.label, item.id),
          x: point.x,
          y: point.y,
          swatch,
        })
      }),
    ),
    hidden,
    more: hidden > 0 ? Object.freeze(position(series.length)) : null,
  })
}

function itemWidth(
  label: string,
  policy: PlanPolicy,
  swatch: number,
): number {
  const style = policy.typography.byRank.C
  return swatch + policy.tickLabelGap + measureText(
    label,
    'C',
    policy.typography.metrics,
    style,
  )
}

function chooseColumns(widths: readonly number[], available: number, policy: PlanPolicy): number {
  if (widths.length === 0) return 1
  const gap = Math.max(0, policy.regionGap)
  const maxColumns = Math.max(1, widths.length)
  for (let columns = maxColumns; columns > 1; columns -= 1) {
    const columnWidth = (available - gap * (columns - 1)) / columns
    if (columnWidth >= Math.max(...widths)) return columns
  }
  return 1
}

function compactLabels(
  series: readonly CompactSeriesKeyItem[],
  hidden: number,
  available: number,
  policy: PlanPolicy,
): {
  readonly labels: readonly string[]
  readonly widths: readonly number[]
  readonly moreWidth: number
} {
  const full = series.map((item) => displayLabel(item.label, item.id))
  const candidates = [full, ...[4, 3, 2, 1].map((limit) =>
    uniqueAbbreviations(full, limit),
  )]
  const moreWidth = hidden > 0
    ? itemWidth(`+${hidden}`, policy, policy.typography.byRank.C.fontSize)
    : 0
  for (const labels of candidates) {
    const widths = labels.map((label) => itemWidth(label, policy, policy.typography.byRank.C.fontSize))
    const columns = chooseColumns(
      [...widths, ...(hidden > 0 ? [moreWidth] : [])],
      available,
      policy,
    )
    if (columns === labels.length + (hidden > 0 ? 1 : 0)) {
      return Object.freeze({ labels: Object.freeze(labels), widths: Object.freeze(widths), moreWidth })
    }
  }
  const labels = candidates.at(-1) ?? []
  return Object.freeze({
    labels: Object.freeze(labels),
    widths: Object.freeze(labels.map((label) => itemWidth(label, policy, policy.typography.byRank.C.fontSize))),
    moreWidth,
  })
}

function uniqueAbbreviations(labels: readonly string[], maxChars: number): readonly string[] {
  const seen = new Map<string, number>()
  return labels.map((label, index) => {
    const base = Array.from(label).slice(0, maxChars).join('') || String(index + 1)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}${count}`
  })
}

function computePlotTransform(
  origin: number,
  height: number,
  targetOrigin: number,
  targetHeight: number,
): string | null {
  if (!finite(origin) || !finite(height) || !finite(targetOrigin) || !finite(targetHeight)) return null
  if (height <= 0 || targetHeight <= 0) return null
  const scale = targetHeight / height
  if (!Number.isFinite(scale) || scale <= 0) return null
  return `translate(0 ${roundCoord(targetOrigin)}) scale(1 ${roundCoord(scale)}) translate(0 ${roundCoord(-origin)})`
}

function displayLabel(label: string, id: string): string {
  const trimmed = label.trim()
  return trimmed.length > 0 ? trimmed : id
}

function isRectLike(value: unknown): value is RectLike {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every(
    (key) => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]),
  )
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
