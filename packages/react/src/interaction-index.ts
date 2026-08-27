import type { ChartFrame, DataPoint, PointPos, Series } from '@shiftcharts/core'

/**
 * A rendered point paired with the source datum that produced it.
 *
 * `x`/`y` are pixel coordinates in the frame's SVG coordinate space. `domainX` is the
 * comparable numeric domain value used by shared tooltip lookup (`Date` values are epoch
 * milliseconds). Keeping both values here avoids rebuilding source-index arrays or walking
 * the data on every pointer event.
 */
export type IndexedPoint = {
  readonly seriesId: string
  readonly pointIndex: number
  readonly point: PointPos
  readonly sourcePoint: DataPoint
  readonly x: number
  readonly y: number
  readonly value: number
  readonly domainX: number
}

/** One series' immutable interaction lookup tables. */
export type IndexedSeries = {
  readonly id: string
  readonly index: number
  readonly label: string
  readonly frame: ChartFrame['series'][number]
  readonly source: Series
  /** Frame-order points, preserving source point-index identity. */
  readonly points: readonly IndexedPoint[]
  readonly byPointIndex: ReadonlyMap<number, IndexedPoint>
  /** Compatibility alias for consumers that read the prepared point map directly. */
  readonly pointByIndex: ReadonlyMap<number, IndexedPoint>
  /** Source x values normalized to numbers; duplicate x values retain source order. */
  readonly byDomainX: ReadonlyMap<number, readonly IndexedPoint[]>
  /** First point for each source x, matching shared-tooltip first-match semantics. */
  readonly pointAtDomainX: ReadonlyMap<number, IndexedPoint>
  /** Points sorted by pixel x for logarithmic nearest-x lookup. */
  readonly sortedByX: readonly IndexedPoint[]
}

/**
 * Client-only derived interaction state. The source frame/data remain the authority; this
 * object only makes their stable identity and nearest-point relationships cheap to query.
 */
export type InteractionIndex = {
  readonly frame: ChartFrame
  readonly series: readonly IndexedSeries[]
  readonly byId: ReadonlyMap<string, IndexedSeries>
  /** Source series map, useful for direct point/data access in tooltip rendering. */
  readonly dataById: ReadonlyMap<string, Series>
  /** All indexed points in frame series order. */
  readonly points: readonly IndexedPoint[]
  /** Shared tooltip lookup across series, keyed by normalized domain x. */
  readonly byDomainX: ReadonlyMap<number, readonly IndexedPoint[]>
}

export type NearestPointMode = 'x' | 'xy'

/**
 * Build all interaction lookup tables for a resolved frame.
 *
 * The frame contains only defined points, so source point indexes are derived once here. This
 * is deliberately kept in `@shiftcharts/react`: it owns client interaction preparation while
 * `@shiftcharts/core` remains serialisable and free of browser/runtime state.
 */
export function prepareInteractionIndex(
  frame: ChartFrame,
  data: readonly Series[],
): InteractionIndex {
  const dataById = new Map<string, Series>()
  for (const source of data) {
    // Existing interaction semantics use the first source series for a duplicate id. Keep that
    // deterministic rather than allowing a later duplicate to silently steal frame geometry.
    if (!dataById.has(source.id)) dataById.set(source.id, source)
  }

  const series: IndexedSeries[] = []
  const allPoints: IndexedPoint[] = []
  const sharedByDomainX = new Map<number, IndexedPoint[]>()

  for (const seriesFrame of frame.series) {
    const source = dataById.get(seriesFrame.id)
    if (source === undefined) continue

    const sourcePointIndexes = definedPointIndexes(source)
    const indexedPoints: IndexedPoint[] = []
    const byPointIndex = new Map<number, IndexedPoint>()
    const byDomainX = new Map<number, IndexedPoint[]>()
    const pointAtDomainX = new Map<number, IndexedPoint>()

    seriesFrame.points.forEach((point, ordinal) => {
      const pointIndex = sourcePointIndexes[ordinal]
      const sourcePoint = pointIndex === undefined ? undefined : source.points[pointIndex]
      if (pointIndex === undefined || sourcePoint === undefined) return

      const domainX = normalizeDomainX(sourcePoint.x)
      const indexed = Object.freeze({
        seriesId: seriesFrame.id,
        pointIndex,
        point,
        sourcePoint,
        x: point.x,
        y: point.y,
        value: point.value,
        domainX,
      })
      indexedPoints.push(indexed)
      byPointIndex.set(pointIndex, indexed)

      if (Number.isFinite(domainX)) {
        appendMapValue(byDomainX, domainX, indexed)
        if (!pointAtDomainX.has(domainX)) pointAtDomainX.set(domainX, indexed)
        appendMapValue(sharedByDomainX, domainX, indexed)
      }
    })

    const sortedByX = [...indexedPoints]
      .filter((point) => Number.isFinite(point.x))
      .sort((left, right) => left.x - right.x)
    const frozenByDomainX = freezeMapValues(byDomainX)

    series.push(
      Object.freeze({
        id: seriesFrame.id,
        index: seriesFrame.index,
        label: seriesFrame.label,
        frame: seriesFrame,
        source,
        points: Object.freeze(indexedPoints),
        byPointIndex,
        pointByIndex: byPointIndex,
        byDomainX: frozenByDomainX,
        pointAtDomainX,
        sortedByX: Object.freeze(sortedByX),
      }),
    )
    allPoints.push(...indexedPoints)
  }

  return Object.freeze({
    frame,
    series: Object.freeze(series),
    byId: new Map(series.map((item) => [item.id, item])),
    dataById,
    points: Object.freeze(allPoints),
    byDomainX: freezeMapValues(sharedByDomainX),
  })
}

/**
 * Resolve the nearest prepared point in pixel coordinates.
 *
 * `'x'` uses each series' sorted pixel-x array and compares at most the neighbouring x values;
 * this is the line/timebar path. `'xy'` intentionally retains a full scan for scatter-like
 * marks until a measured scatter workload justifies a spatial index.
 */
export function nearestIndexedPoint(
  index: InteractionIndex,
  x: number,
  y: number,
  mode: NearestPointMode = 'x',
): IndexedPoint | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  if (mode === 'xy') {
    let best: IndexedPoint | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const point of index.points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2
      if (best === null || distance < bestDistance) {
        best = point
        bestDistance = distance
      }
    }
    return best
  }

  let best: IndexedPoint | null = null
  let bestXDistance = Number.POSITIVE_INFINITY
  let bestYDistance = Number.POSITIVE_INFINITY
  for (const item of index.series) {
    const points = item.sortedByX
    if (points.length === 0) continue
    const lower = lowerBound(points, x)
    const candidates = candidatesAround(points, lower, x)
    for (const point of candidates) {
      const xDistance = Math.abs(point.x - x)
      const yDistance = Math.abs(point.y - y)
      if (
        best === null ||
        xDistance < bestXDistance ||
        (xDistance === bestXDistance && yDistance < bestYDistance)
      ) {
        best = point
        bestXDistance = xDistance
        bestYDistance = yDistance
      }
    }
  }
  return best
}

function definedPointIndexes(series: Series): readonly number[] {
  const indexes: number[] = []
  series.points.forEach((point, index) => {
    // Keep the same ordinal contract as `resolveFrame()`: it filters undefined/non-finite y
    // values, while x is carried through to the frame as geometry (and may become NaN). Sorting
    // and nearest lookup filter non-finite pixel x later without shifting source identities.
    if (point.y !== null && Number.isFinite(point.y)) indexes.push(index)
  })
  return indexes
}

function normalizeDomainX(value: DataPoint['x']): number {
  return value instanceof Date ? value.getTime() : value
}

function appendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key)
  if (values === undefined) map.set(key, [value])
  else values.push(value)
}

function freezeMapValues<K, V>(map: Map<K, V[]>): ReadonlyMap<K, readonly V[]> {
  const frozen = new Map<K, readonly V[]>()
  for (const [key, values] of map) frozen.set(key, Object.freeze(values))
  return frozen
}

function lowerBound(points: readonly IndexedPoint[], x: number): number {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (points[middle]!.x < x) low = middle + 1
    else high = middle
  }
  return low
}

/** Include the complete equal-x run so duplicate source x values still use y as a tie-break. */
function candidatesAround(
  points: readonly IndexedPoint[],
  lower: number,
  x: number,
): readonly IndexedPoint[] {
  const candidates: IndexedPoint[] = []
  let right = lower
  while (right < points.length && points[right]!.x === x) {
    candidates.push(points[right]!)
    right += 1
  }
  let left = lower - 1
  while (left >= 0 && points[left]!.x === x) {
    candidates.push(points[left]!)
    left -= 1
  }
  if (candidates.length > 0) return candidates
  if (lower < points.length) candidates.push(points[lower]!)
  if (lower > 0) candidates.push(points[lower - 1]!)
  return candidates
}
