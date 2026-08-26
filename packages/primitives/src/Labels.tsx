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
 * ⚠ **The label is drawn at the final plot point and anchors inward.** This keeps the direct
 * identity channel inside the measured SVG without stealing plot width from the line itself.
 */

import {
  DEFAULT_POLICY,
  formatYLabel,
  lineHeight,
  measureText,
  type LabelsPlan,
  type PlanPolicy,
  type Rect,
  type SeriesFrame,
} from '@gx/core'

import { classes, roundCoord } from './svg.ts'

export type LabelsProps = {
  readonly series: SeriesFrame
  readonly seriesLabels: LabelsPlan['seriesLabels']
  readonly valueLabels: LabelsPlan['valueLabels']
  readonly labelHalo?: LabelsPlan['labelHalo']
  /** `LabelsPlan.maxChars`. `null` means no cap. */
  readonly maxChars?: number | null
  /** The same resolved policy used to produce the frame and plot box. */
  readonly policy?: PlanPolicy
  readonly offsets?: ReadonlyMap<string, number> | undefined
  readonly className?: string
}

export function Labels({
  series,
  seriesLabels,
  valueLabels,
  labelHalo = 'none',
  maxChars = null,
  className,
  policy = DEFAULT_POLICY,
  offsets,
}: LabelsProps) {
  const last = series.points.at(-1)
  const indices = valueIndices(series, valueLabels)

  return (
    <>
      {seriesLabels === 'direct-end' && last !== undefined ? (
        (() => {
          const offset = offsets?.get(seriesLabelKey(series.id)) ?? 0
          return Number.isFinite(offset) ? (
            <text
              className={classes('gx-label', className)}
              data-label-kind="series"
              data-halo={labelHalo !== 'none' ? labelHalo : undefined}
              x={roundCoord(last.x - policy.regionGap)}
              y={roundCoord(last.y + offset)}
            >
              {truncate(series.label, maxChars)}
            </text>
          ) : null
        })()
      ) : null}

      {indices.map((i) => {
        const p = series.points[i]
        if (p === undefined) return null
        const offset = offsets?.get(valueLabelKey(series.id, i)) ?? 0
        if (!Number.isFinite(offset)) return null
        return (
          <text
            className={classes('gx-value-label', className)}
            data-label-kind="value"
            data-halo={labelHalo !== 'none' ? labelHalo : undefined}
            key={i}
            data-index={i}
            x={roundCoord(p.x)}
            // Above the mark. `policy.regionGap` and not a new constant, because a
            // fifth Tier-C number would need its own argument and this one already means
            // "the smallest gap that reads as separation".
            y={roundCoord(p.y - policy.regionGap + offset)}
          >
            {formatYLabel(p.value)}
          </text>
        )
      })}
    </>
  )
}

type LabelCandidate = {
  readonly key: string
  readonly kind: 'series' | 'value'
  readonly left: number
  readonly right: number
  readonly y: number
  readonly height: number
  readonly priority: number
}

type LabelPlacement = LabelCandidate & {
  readonly top: number
  readonly bottom: number
}

/**
 * Resolve direct series/value label offsets without DOM measurement. The candidate rectangles use
 * the same character-advance model as the core planner, then greedily search vertically around
 * each label's data position. This keeps the SVG/RSC path deterministic while preventing close
 * endpoint and Stage value labels from being painted into the same glyph box.
 */
export function resolveLabelOffsets(
  series: readonly SeriesFrame[],
  labels: LabelsPlan,
  plot: Rect,
  policy: PlanPolicy,
): ReadonlyMap<string, number> {
  const candidates: LabelCandidate[] = []
  const lineStyle = policy.typography.byRank.C
  const valueStyle = policy.typography.byRank.B
  const labelHeight = lineHeight('C', policy)
  const valueHeight = lineHeight('B', policy)

  for (const item of series) {
    const last = item.points.at(-1)
    if (labels.seriesLabels === 'direct-end' && last !== undefined) {
      const text = truncate(item.label, labels.maxChars)
      const width = measureText(text, 'C', policy.typography.metrics, lineStyle)
      const right = last.x - policy.regionGap
      candidates.push({
        key: seriesLabelKey(item.id),
        kind: 'series',
        left: right - width,
        right,
        y: last.y,
        height: labelHeight,
        priority: 100,
      })
    }

    for (const index of valueIndices(item, labels.valueLabels)) {
      const point = item.points[index]
      if (point === undefined) continue
      const width = measureText(formatYLabel(point.value), 'B', policy.typography.metrics, valueStyle)
      candidates.push({
        key: valueLabelKey(item.id, index),
        kind: 'value',
        left: point.x - width / 2,
        right: point.x + width / 2,
        y: point.y - policy.regionGap,
        height: valueHeight,
        // Keep the latest reading before lower-priority extrema when an overfull measured
        // box needs an explicit occlusion policy.
        priority: index === item.points.length - 1 ? 50 : 10,
      })
    }
  }

  const hidden = new Set<string>()
  const availableHeight = Math.max(0, plot.height)
  const gap = 1
  const components = horizontalComponents(candidates)
  for (const component of components) {
    const keep = [...component]
    while (labelBudget(keep, gap) > availableHeight) {
      const removable = keep
        .filter((candidate) => candidate.kind === 'value')
        .sort((left, right) => left.priority - right.priority || left.key.localeCompare(right.key))[0]
      if (removable === undefined) break
      hidden.add(removable.key)
      keep.splice(keep.indexOf(removable), 1)
    }
  }

  const visibleCandidates = candidates.filter((candidate) => !hidden.has(candidate.key))
  visibleCandidates.sort((left, right) => left.y - right.y || left.key.localeCompare(right.key))
  const placed = new Map<string, LabelPlacement>()
  const maxTop = plot.y + plot.height

  for (const candidate of visibleCandidates) {
    const half = candidate.height / 2
    const minimum = plot.y + half
    const maximum = Math.max(minimum, maxTop - half)
    const origin = Math.min(maximum, Math.max(minimum, candidate.y))
    const search = [0]
    for (let distance = 1; distance <= visibleCandidates.length; distance += 1) {
      search.push(-distance * candidate.height, distance * candidate.height)
    }

    let selected = origin
    for (const offset of search) {
      const y = Math.min(maximum, Math.max(minimum, origin + offset))
      const top = y - half
      const bottom = y + half
      if (![...placed.values()].some((other) =>
        Math.min(candidate.right, other.right) - Math.max(candidate.left, other.left) > 0 &&
        Math.min(bottom, other.bottom) - Math.max(top, other.top) > 0
      )) {
        selected = y
        break
      }
    }

    placed.set(candidate.key, { ...candidate, top: selected - half, bottom: selected + half })
  }

  // The nearest-slot search preserves the data positions in normal charts. A dense, measured
  // card can still leave a connected label group with no free slot even though the group fits if
  // packed as a whole. Repack only those residual collision groups, keeping the normal geometry
  // unchanged everywhere else.
  for (const component of horizontalComponents(visibleCandidates)) {
    const members = component.map((candidate) => placed.get(candidate.key)).filter(
      (candidate): candidate is LabelPlacement => candidate !== undefined,
    )
    const collision = members.some((left, index) => members.slice(index + 1).some((right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 0 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 0
    ))
    if (!collision) continue

    const sorted = [...component].sort((left, right) => left.y - right.y || left.key.localeCompare(right.key))
    const total = labelBudget(sorted, gap)
    const maximum = Math.max(plot.y, maxTop - total)
    const midpoint = (sorted[0]!.y + sorted.at(-1)!.y) / 2
    let cursor = Math.min(maximum, Math.max(plot.y, midpoint - total / 2))
    for (const candidate of sorted) {
      const top = cursor
      placed.set(candidate.key, { ...candidate, top, bottom: top + candidate.height })
      cursor = top + candidate.height + gap
    }
  }

  const offsets = new Map<string, number>()
  for (const candidate of visibleCandidates) {
    const placement = placed.get(candidate.key)
    if (placement !== undefined) offsets.set(candidate.key, (placement.top + placement.bottom) / 2 - candidate.y)
  }
  for (const key of hidden) offsets.set(key, Number.NaN)
  return offsets
}

function labelBudget(candidates: readonly LabelCandidate[], gap: number): number {
  if (candidates.length === 0) return 0
  return candidates.reduce((height, candidate) => height + candidate.height, 0) + gap * (candidates.length - 1)
}

function horizontalComponents(candidates: readonly LabelCandidate[]): LabelCandidate[][] {
  const remaining = new Set(candidates)
  const components: LabelCandidate[][] = []
  while (remaining.size > 0) {
    const first = remaining.values().next().value as LabelCandidate
    remaining.delete(first)
    const component = [first]
    const queue = [first]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const candidate of [...remaining]) {
        if (Math.min(current.right, candidate.right) - Math.max(current.left, candidate.left) <= 0) continue
        remaining.delete(candidate)
        component.push(candidate)
        queue.push(candidate)
      }
    }
    components.push(component)
  }
  return components
}

function seriesLabelKey(seriesId: string): string {
  return 'series:' + seriesId
}

function valueLabelKey(seriesId: string, index: number): string {
  return 'value:' + seriesId + ':' + index
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
