import type {
  ChartFrame,
  ChartPlan,
  DataPoint,
  PlanPolicy,
  PointPos,
  Series,
  SizeContext,
  TooltipBox,
  TooltipPlacement,
} from '@shiftcharts/core'
import { formatXLabel, formatYLabel, placeTooltip, resolveFrame } from '@shiftcharts/core'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'

import {
  nearestIndexedPoint,
  prepareInteractionIndex,
  type InteractionIndex,
} from './interaction-index.ts'
import {
  createPointerFrameScheduler,
  type PointerFrameScheduler,
} from './interaction-scheduler.ts'
import { resolveInteractionMode, type InteractionMode } from './interaction-policy.ts'

type DatumKey = {
  readonly seriesId: string
  readonly pointIndex: number
}

type ActivePoint = DatumKey & {
  readonly point: PointPos
  readonly xValue: DataPoint['x']
  readonly category: string | null
}

type TooltipRow = {
  readonly seriesId: string
  readonly seriesIndex: number
  readonly label: string
  readonly value: string
  readonly pointIndex: number
}

type PointerSample = {
  readonly clientX: number
  readonly clientY: number
}

export type InteractionOverlayProps = {
  readonly containerRef: RefObject<HTMLElement | null>
  readonly plan: ChartPlan
  readonly data: readonly Series[]
  readonly ctx: SizeContext
  readonly policy?: Partial<PlanPolicy> | undefined
  readonly id?: string | undefined
  readonly title: string
  readonly activePointHighlight?: boolean | undefined
}

const DEFAULT_SAFE_PADDING = 8
const DEFAULT_TOOLTIP_OFFSET = 16
const ESTIMATED_HEADER_HEIGHT = 32
const ESTIMATED_ROW_HEIGHT = 28
const ESTIMATED_CHARACTER_WIDTH = 8

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function InteractionOverlay({
  containerRef,
  plan,
  data,
  ctx,
  policy,
  id,
  title,
  activePointHighlight = true,
}: InteractionOverlayProps) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const generatedId = useId()
  const baseId = sanitizeId(id ?? generatedId)
  const frame = useMemo(() => resolveFrame(plan, data, ctx, policy), [ctx, data, plan, policy])
  const enabled = plan.interaction.trigger !== 'none' && plan.interaction.tooltip.enabled

  useIsomorphicLayoutEffect(() => {
    const root = containerRef.current
    const nextHost = root?.querySelector<HTMLElement>('.shiftcharts-chart') ?? null
    setPortalHost(nextHost)
  }, [containerRef, ctx.width, ctx.height, plan.sizeClass])

  if (!enabled || portalHost === null || !containerRef.current?.contains(portalHost)) return null

  return createPortal(
    <InteractionLayer
      baseId={baseId}
      frame={frame}
      plan={plan}
      data={data}
      title={title}
      activePointHighlight={activePointHighlight}
    />,
    portalHost,
  )
}

function InteractionLayer({
  baseId,
  frame,
  plan,
  data,
  title,
  activePointHighlight,
}: {
  readonly baseId: string
  readonly frame: ChartFrame
  readonly plan: ChartPlan
  readonly data: readonly Series[]
  readonly title: string
  readonly activePointHighlight: boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const svgBoundsRef = useRef<DOMRect | null>(null)
  const crosshairLineRef = useRef<SVGLineElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [activeKey, setActiveKey] = useState<DatumKey | null>(null)
  const activeKeyRef = useRef<DatumKey | null>(null)
  const [locked, setLocked] = useState(false)
  const [tooltipBox, setTooltipBox] = useState<TooltipBox>(() => estimateTooltipBox([]))
  const interactionIndex = useMemo(() => prepareInteractionIndex(frame, data), [data, frame])
  const interactionMode: InteractionMode = useMemo(
    () => resolveInteractionMode(plan, interactionIndex.points.length),
    [interactionIndex.points.length, plan],
  )
  const hoverSchedulerRef = useRef<PointerFrameScheduler<PointerSample> | null>(null)
  const pointerSampleConsumerRef = useRef<(sample: PointerSample) => void>(() => undefined)

  const readSvgBounds = useCallback(() => {
    const svg = svgRef.current
    if (svg === null) return null
    const bounds = svg.getBoundingClientRect()
    svgBoundsRef.current = bounds
    return bounds
  }, [])

  const commitActiveKey = useCallback((next: DatumKey | null) => {
    // Pointer events can arrive much faster than React commits. Keep the last semantic identity
    // in a ref so the common "still over the same datum" case does not even enqueue a state
    // update; the state object remains the source used to derive the rendered tooltip.
    if (sameNullableDatum(activeKeyRef.current, next)) return
    activeKeyRef.current = next
    setActiveKey(next)
  }, [])

  const updateCrosshair = useCallback(
    (key: DatumKey) => {
      const line = crosshairLineRef.current
      const indexed = interactionIndex.byId.get(key.seriesId)?.pointByIndex.get(key.pointIndex)
      if (line === null || indexed === undefined) return
      const x = String(indexed.point.x)
      line.setAttribute('x1', x)
      line.setAttribute('x2', x)
      line.parentElement?.setAttribute('data-active', 'true')
    },
    [interactionIndex],
  )

  const consumePointerSample = useCallback(
    (sample: PointerSample) => {
      const bounds = svgBoundsRef.current ?? readSvgBounds()
      const point = nearestPoint(
        sample,
        interactionIndex,
        bounds,
        plan.type === 'scatter' ? 'xy' : 'x',
      )
      if (point === null) return
      if (plan.interaction.crosshair) updateCrosshair(point)
      if (plan.interaction.trigger === 'hover' && !locked) commitActiveKey(point)
    },
    [commitActiveKey, interactionIndex, locked, plan.interaction.crosshair, plan.interaction.trigger, plan.type, readSvgBounds, updateCrosshair],
  )
  pointerSampleConsumerRef.current = consumePointerSample

  useIsomorphicLayoutEffect(() => {
    const scheduler = createPointerFrameScheduler<PointerSample>(
      (sample) => pointerSampleConsumerRef.current(sample),
    )
    hoverSchedulerRef.current = scheduler
    return () => {
      scheduler.cancel()
      if (hoverSchedulerRef.current === scheduler) hoverSchedulerRef.current = null
    }
  }, [])

  const active = useMemo(
    () => (activeKey === null ? null : resolveActivePoint(activeKey, interactionIndex)),
    [activeKey, interactionIndex],
  )
  const rows = useMemo(
    () => (active === null ? [] : buildTooltipRows(active, interactionIndex)),
    [active, interactionIndex],
  )
  const tooltipForPlacement = useMemo(() => {
    const estimated = estimateTooltipBox(rows)
    return {
      ...tooltipBox,
      width: Math.max(tooltipBox.width, estimated.width),
      height: Math.max(tooltipBox.height, estimated.height),
      headerHeight: estimated.headerHeight,
      rowCount: rows.length,
      rowHeight: estimated.rowHeight,
    }
  }, [rows, tooltipBox])
  const activePoints = useMemo(() => {
    if (interactionMode !== 'rich' || !activePointHighlight || active === null) return []
    return rows.flatMap((row) => {
      const point = resolveActivePoint(
        { seriesId: row.seriesId, pointIndex: row.pointIndex },
        interactionIndex,
      )
      const seriesIndex = interactionIndex.byId.get(row.seriesId)?.index ?? -1
      return point === null ? [] : [{ ...point, seriesIndex }]
    })
  }, [active, activePointHighlight, interactionIndex, interactionMode, rows])
  // For a temporal x-axis, show the reading as the bucket it covers — [this point's x, the
  // next point's x) — rather than a single instant, when the two format to visibly different
  // labels. Falls back to the single instant for the series' last point (no next boundary to
  // show) and for any x that isn't a Date at all (categorical/numeric axes keep their existing
  // single-value header — a bucket range only means something on a temporal axis).
  const header = useMemo(() => {
    if (active === null) return ''
    if (active.category !== null) return active.category
    const start = formatXLabel(active.xValue)
    const bucketEnd = nextPointX(active, interactionIndex)
    if (bucketEnd === null) return start
    const end = formatXLabel(bucketEnd)
    return end === start ? start : start + ' → ' + end
  }, [active, interactionIndex])
  const placement = useMemo<TooltipPlacement | null>(() => {
    if (active === null || rows.length === 0) return null
    const place = (mode: 'fixed' | 'fluid'): TooltipPlacement =>
      placeTooltip({
        mode,
        anchor: { x: active.point.x, y: active.point.y, width: 0, height: 0 },
        tooltip: tooltipForPlacement,
        widget: frame.box,
        plot: frame.plot,
        safePadding: DEFAULT_SAFE_PADDING,
        offset: DEFAULT_TOOLTIP_OFFSET,
        preferredFixedRail: 'top',
        preferredFluidSide: 'above-right',
      })
    if (plan.interaction.tooltip.placement === 'fluid') return place('fluid')

    // "Fixed" docks the tooltip in whatever chrome the layout left outside the plot — often
    // just the axis-label band, a handful of pixels tall. `status === 'fit'` means the real
    // content (header + every row) fits there without clamping. Anything less and a docked
    // box would ship wedged against the widget edge with rows silently hidden — worse than
    // just floating it next to the point, which is the same mechanism Canvas/Stage already
    // use and always has room to show the full reading.
    const fixed = place('fixed')
    return fixed.status === 'fit' ? fixed : place('fluid')
  }, [active, frame.box, frame.plot, plan.interaction.tooltip.placement, tooltipForPlacement])

  useIsomorphicLayoutEffect(() => {
    const element = tooltipRef.current
    if (element === null || active === null) return
    const measured = element.getBoundingClientRect()
    if (measured.width <= 0 || measured.height <= 0) return
    setTooltipBox((previous) =>
      previous.width === measured.width && previous.height === measured.height
        ? previous
        : { ...previous, width: measured.width, height: measured.height },
    )
  }, [active, rows])

  useIsomorphicLayoutEffect(() => {
    // A frame change is the chart's resize signal. The next pointer re-entry reads the new
    // viewport rect instead of using coordinates from the previous SVG box.
    svgBoundsRef.current = null
  }, [frame.box.height, frame.box.width])

  useEffect(() => {
    // Scrolling changes client coordinates without changing the SVG viewBox. Invalidate rather
    // than measuring eagerly; the next pointer event or pointer re-entry pays for one read.
    const invalidate = () => {
      svgBoundsRef.current = null
    }
    window.addEventListener('resize', invalidate)
    window.addEventListener('scroll', invalidate, true)
    return () => {
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('scroll', invalidate, true)
    }
  }, [])

  useIsomorphicLayoutEffect(() => {
    if (active === null) return
    const onResize = () => {
      const element = tooltipRef.current
      if (element === null) return
      const measured = element.getBoundingClientRect()
      if (measured.width <= 0 || measured.height <= 0) return
      setTooltipBox((previous) =>
        previous.width === measured.width && previous.height === measured.height
          ? previous
          : { ...previous, width: measured.width, height: measured.height },
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active])

  const moveToPointer = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const sample = { clientX: event.clientX, clientY: event.clientY }
      const scheduler = hoverSchedulerRef.current
      if (scheduler === null) {
        consumePointerSample(sample)
        return
      }
      scheduler.schedule(sample)
      // jsdom and SSR-like test hosts often expose no rAF. Deliver synchronously there so the
      // interaction contract remains deterministic; real browsers consume one sample per paint.
      if (typeof globalThis.requestAnimationFrame !== 'function') scheduler.flush()
    },
    [consumePointerSample],
  )

  const activateAtPointer = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const bounds = svgBoundsRef.current ?? readSvgBounds()
      const point = nearestPoint(event, interactionIndex, bounds, plan.type === 'scatter' ? 'xy' : 'x')
      if (point === null) return
      const same =
        activeKeyRef.current?.seriesId === point.seriesId && activeKeyRef.current?.pointIndex === point.pointIndex
      if (plan.interaction.crosshair) updateCrosshair(point)
      if (plan.interaction.trigger === 'tap' || event.pointerType === 'touch') {
        if (same && locked) {
          commitActiveKey(null)
          setLocked(false)
        } else {
          commitActiveKey(point)
          setLocked(true)
        }
      }
    },
    [commitActiveKey, interactionIndex, locked, plan.interaction.crosshair, plan.interaction.trigger, plan.type, readSvgBounds, updateCrosshair],
  )

  const clearOnLeave = useCallback(() => {
    hoverSchedulerRef.current?.cancel()
    svgBoundsRef.current = null
    if (!locked) {
      hideCrosshair(crosshairLineRef)
      commitActiveKey(null)
    }
  }, [commitActiveKey, locked])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGRectElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        commitActiveKey(null)
        setLocked(false)
        hideCrosshair(crosshairLineRef)
        return
      }
      const points = flattenedPoints(interactionIndex)
      if (points.length === 0) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
      event.preventDefault()
      if (event.key === 'Enter' || event.key === ' ') {
        const next = activeKey === null ? (points[0] ?? null) : activeKey
        commitActiveKey(next)
        setLocked(true)
        return
      }
      const currentIndex =
        activeKey === null ? 0 : points.findIndex((point) => sameDatum(point, activeKey))
      const index = currentIndex < 0 ? 0 : currentIndex
      const nextIndex =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? points.length - 1
            : Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))
      commitActiveKey(points[nextIndex] ?? null)
    },
    [activeKey, commitActiveKey, interactionIndex],
  )

  const clipId = baseId + '-plot-clip'
  const tooltipId = baseId + '-tooltip'
  const visibleRows =
    placement === null ? rows : rows.slice(0, Math.max(0, rows.length - placement.hiddenRowCount))
  const status = active === null ? '' : buildStatus(header, rows, placement)

  return (
    <div
      className="shiftcharts-interaction"
      data-trigger={plan.interaction.trigger}
      data-interaction-mode={interactionMode}
    >
      <svg
        ref={svgRef}
        className="shiftcharts-interaction__svg"
        viewBox={'0 0 ' + frame.box.width + ' ' + frame.box.height}
        aria-label={title + ' interactive chart'}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={frame.plot.x} y={frame.plot.y} width={frame.plot.width} height={frame.plot.height} />
          </clipPath>
        </defs>
        {plan.interaction.crosshair ? (
          <g
            className="shiftcharts-interaction__crosshair"
            data-active={active === null ? 'false' : 'true'}
            clipPath={'url(#' + clipId + ')'}
            aria-hidden="true"
          >
            <line
              ref={crosshairLineRef}
              x1={active?.point.x ?? frame.plot.x}
              x2={active?.point.x ?? frame.plot.x}
              y1={frame.plot.y}
              y2={frame.plot.y + frame.plot.height}
            />
          </g>
        ) : null}
        {activePoints.length > 0 ? (
          <g className="shiftcharts-interaction__active-points" aria-hidden="true">
            {activePoints.map((point) => (
              <circle
                className="shiftcharts-interaction__active-point"
                cx={point.point.x}
                cy={point.point.y}
                data-point-index={point.pointIndex}
                data-series-id={point.seriesId}
                data-series-index={point.seriesIndex}
                key={point.seriesId + ':' + point.pointIndex}
                r="0"
              />
            ))}
          </g>
        ) : null}
        <rect
          className="shiftcharts-interaction__target"
          x={frame.plot.x}
          y={frame.plot.y}
          width={frame.plot.width}
          height={frame.plot.height}
          tabIndex={0}
          role="button"
          aria-label={title + ' data interaction'}
          aria-pressed={active !== null}
          aria-describedby={placement === null ? undefined : tooltipId}
          onPointerMove={moveToPointer}
          onPointerDown={activateAtPointer}
          onPointerEnter={readSvgBounds}
          onPointerLeave={clearOnLeave}
          onPointerOut={clearOnLeave}
          onPointerCancel={clearOnLeave}
          onFocus={() => {
            if (activeKey === null) commitActiveKey(flattenedPoints(interactionIndex)[0] ?? null)
          }}
          onKeyDown={handleKeyDown}
        />
      </svg>
      {placement !== null && active !== null ? (
        <div
          ref={tooltipRef}
          id={tooltipId}
          className="shiftcharts-interaction__tooltip"
          role="tooltip"
          data-tooltip-mode={placement.mode}
          data-tooltip-side={placement.side}
          data-status={placement.status}
          data-chart-type={plan.type}
          data-series-id={active.seriesId}
          data-point-index={active.pointIndex}
          style={{
            insetInlineStart: placement.x,
            insetBlockStart: placement.y,
            inlineSize: placement.width,
            blockSize: placement.height,
          }}
        >
          <span className="shiftcharts-interaction__tooltip-arrow" aria-hidden="true" />
          <div className="shiftcharts-interaction__tooltip-header">{header}</div>
          <div className="shiftcharts-interaction__tooltip-rows">
            {visibleRows.map((row) => (
              <div
                className="shiftcharts-interaction__tooltip-row"
                key={row.seriesId}
                data-series-id={row.seriesId}
                data-series-index={row.seriesIndex}
              >
                <span className="shiftcharts-interaction__tooltip-label">
                  {plan.type === 'line' ? (
                    <svg
                      className="shiftcharts-interaction__tooltip-swatch-line"
                      width="14"
                      height="8"
                      viewBox="0 0 14 8"
                      aria-hidden="true"
                    >
                      <line x1="0" y1="4" x2="14" y2="4" />
                    </svg>
                  ) : (
                    <span className="shiftcharts-interaction__tooltip-swatch" aria-hidden="true" />
                  )}
                  <span>{row.label}</span>
                </span>
                <strong>{row.value}</strong>
              </div>
            ))}
            {placement.hiddenRowCount > 0 ? (
              <div className="shiftcharts-interaction__tooltip-overflow">
                +{placement.hiddenRowCount} more
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="shiftcharts-interaction__status" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  )
}

function nearestPoint(
  event: PointerSample,
  index: InteractionIndex,
  bounds: DOMRect | null,
  mode: 'x' | 'xy',
): DatumKey | null {
  if (bounds === null) return null
  const scaleX = bounds.width > 0 ? index.frame.box.width / bounds.width : 1
  const scaleY = bounds.height > 0 ? index.frame.box.height / bounds.height : 1
  const x = (event.clientX - bounds.left) * scaleX
  const y = (event.clientY - bounds.top) * scaleY
  return nearestIndexedPoint(index, x, y, mode)
}

function resolveActivePoint(key: DatumKey, index: InteractionIndex): ActivePoint | null {
  const indexedSeries = index.byId.get(key.seriesId)
  if (indexedSeries === undefined) return null
  const indexedPoint = indexedSeries.pointByIndex.get(key.pointIndex)
  const sourcePoint = indexedSeries.source.points[key.pointIndex]
  if (indexedPoint === undefined || sourcePoint === undefined || sourcePoint.y === null) return null
  return {
    ...key,
    point: indexedPoint,
    xValue: sourcePoint.x,
    category: sourcePoint.category ?? null,
  }
}

function buildTooltipRows(active: ActivePoint, index: InteractionIndex): readonly TooltipRow[] {
  const activeSeries = index.byId.get(active.seriesId)
  const activePoint = activeSeries?.source.points[active.pointIndex]
  if (activePoint === undefined) return []
  const domainX = normalizeX(activePoint.x)
  if (domainX === null) return []
  const rows: TooltipRow[] = []
  for (const indexedSeries of index.series) {
    const indexedPoint = indexedSeries.pointAtDomainX.get(domainX)
    const pointIndex = indexedPoint?.pointIndex ?? -1
    const point = pointIndex < 0 ? undefined : indexedSeries.source.points[pointIndex]
    if (point === undefined || point.y === null) continue
    rows.push({
      seriesId: indexedSeries.id,
      seriesIndex: indexedSeries.index,
      label: indexedSeries.label,
      value: formatYLabel(point.y),
      pointIndex,
    })
  }
  return rows
}

function flattenedPoints(index: InteractionIndex): readonly DatumKey[] {
  const points: DatumKey[] = []
  for (const indexedSeries of index.series) {
    for (const point of indexedSeries.points) {
      points.push({ seriesId: indexedSeries.id, pointIndex: point.pointIndex })
    }
  }
  return points
}

function normalizeX(value: DataPoint['x']): number | null {
  const normalized = value instanceof Date ? value.getTime() : value
  return Number.isFinite(normalized) ? normalized : null
}

/** The next point's x in the same series, only when both it and the active point's x are
 * Dates — the boundary a temporal-bucket header needs. `null` for the series' last point, a
 * non-Date x, or a next point whose x isn't a Date either. */
function nextPointX(active: ActivePoint, index: InteractionIndex): Date | null {
  if (!(active.xValue instanceof Date)) return null
  const next = index.byId.get(active.seriesId)?.source.points[active.pointIndex + 1]
  return next !== undefined && next.x instanceof Date ? next.x : null
}

function hideCrosshair(ref: RefObject<SVGLineElement | null>): void {
  ref.current?.parentElement?.setAttribute('data-active', 'false')
}

function sameDatum(left: DatumKey, right: DatumKey): boolean {
  return left.seriesId === right.seriesId && left.pointIndex === right.pointIndex
}

function sameNullableDatum(left: DatumKey | null, right: DatumKey | null): boolean {
  if (left === null || right === null) return left === right
  return sameDatum(left, right)
}

function estimateTooltipBox(rows: readonly TooltipRow[]): TooltipBox {
  const longest = Math.max(12, ...rows.map((row) => (row.label + ' ' + row.value).length))
  return {
    width: Math.min(260, Math.max(96, longest * ESTIMATED_CHARACTER_WIDTH + 32)),
    height: ESTIMATED_HEADER_HEIGHT + Math.max(1, rows.length) * ESTIMATED_ROW_HEIGHT + 16,
    headerHeight: ESTIMATED_HEADER_HEIGHT,
    rowCount: rows.length,
    rowHeight: ESTIMATED_ROW_HEIGHT,
  }
}

function buildStatus(
  header: string,
  rows: readonly TooltipRow[],
  placement: TooltipPlacement | null,
): string {
  const values = rows.map((row) => row.label + ' ' + row.value).join(', ')
  const overflow =
    placement === null || placement.hiddenRowCount === 0
      ? ''
      : ', ' + placement.hiddenRowCount + ' more values in the data table'
  return header + ': ' + values + overflow
}

function sanitizeId(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]/g, '')
  return safe === '' ? 'interaction' : safe
}
