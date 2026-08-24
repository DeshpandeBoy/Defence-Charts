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
} from '@gx/core'
import { formatXLabel, formatYLabel, placeTooltip, resolveFrame } from '@gx/core'
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

type DatumKey = {
  readonly seriesId: string
  readonly pointIndex: number
}

type ActivePoint = DatumKey & {
  readonly point: PointPos
  readonly xValue: DataPoint['x']
}

type TooltipRow = {
  readonly seriesId: string
  readonly label: string
  readonly value: string
  readonly pointIndex: number
}

export type InteractionOverlayProps = {
  readonly containerRef: RefObject<HTMLElement | null>
  readonly plan: ChartPlan
  readonly data: readonly Series[]
  readonly ctx: SizeContext
  readonly policy?: Partial<PlanPolicy> | undefined
  readonly id?: string | undefined
  readonly title: string
}

const DEFAULT_SAFE_PADDING = 8
const DEFAULT_TOOLTIP_OFFSET = 16
const ESTIMATED_HEADER_HEIGHT = 24
const ESTIMATED_ROW_HEIGHT = 24
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
}: InteractionOverlayProps) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const generatedId = useId()
  const baseId = sanitizeId(id ?? generatedId)
  const frame = useMemo(() => resolveFrame(plan, data, ctx, policy), [ctx, data, plan, policy])
  const enabled = plan.interaction.trigger !== 'none' && plan.interaction.tooltip.enabled

  useIsomorphicLayoutEffect(() => {
    const root = containerRef.current
    const nextHost = root?.querySelector<HTMLElement>('.gx-chart') ?? null
    setPortalHost(nextHost)
  }, [containerRef, ctx.width, ctx.height, plan.sizeClass])

  if (!enabled || portalHost === null || !containerRef.current?.contains(portalHost)) return null

  return createPortal(
    <InteractionLayer baseId={baseId} frame={frame} plan={plan} data={data} title={title} />,
    portalHost,
  )
}

function InteractionLayer({
  baseId,
  frame,
  plan,
  data,
  title,
}: {
  readonly baseId: string
  readonly frame: ChartFrame
  readonly plan: ChartPlan
  readonly data: readonly Series[]
  readonly title: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [activeKey, setActiveKey] = useState<DatumKey | null>(null)
  const [locked, setLocked] = useState(false)
  const [tooltipBox, setTooltipBox] = useState<TooltipBox>(() => estimateTooltipBox([]))

  const active = useMemo(
    () => (activeKey === null ? null : resolveActivePoint(activeKey, frame, data)),
    [activeKey, data, frame],
  )
  const rows = useMemo(
    () => (active === null ? [] : buildTooltipRows(active, frame, data)),
    [active, data, frame],
  )
  const header = active === null ? '' : formatXLabel(active.xValue)
  const placement = useMemo<TooltipPlacement | null>(() => {
    if (active === null || rows.length === 0) return null
    return placeTooltip({
      mode: plan.interaction.tooltip.placement === 'fluid' ? 'fluid' : 'fixed',
      anchor: { x: active.point.x, y: active.point.y, width: 0, height: 0 },
      tooltip: { ...tooltipBox, rowCount: rows.length },
      widget: frame.box,
      plot: frame.plot,
      safePadding: DEFAULT_SAFE_PADDING,
      offset: DEFAULT_TOOLTIP_OFFSET,
      preferredFixedRail: 'top',
      preferredFluidSide: 'above-right',
    })
  }, [active, frame.box, frame.plot, plan.interaction.tooltip.placement, rows.length, tooltipBox])

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
      const point = nearestPoint(event, svgRef.current, frame, data)
      if (point === null) return
      if (plan.interaction.trigger === 'hover' && !locked) setActiveKey(point)
    },
    [data, frame, locked, plan.interaction.trigger],
  )

  const activateAtPointer = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const point = nearestPoint(event, svgRef.current, frame, data)
      if (point === null) return
      const same =
        activeKey?.seriesId === point.seriesId && activeKey?.pointIndex === point.pointIndex
      if (plan.interaction.trigger === 'tap' || event.pointerType === 'touch') {
        if (same && locked) {
          setActiveKey(null)
          setLocked(false)
        } else {
          setActiveKey(point)
          setLocked(true)
        }
      }
    },
    [activeKey, data, frame, locked, plan.interaction.trigger],
  )

  const clearOnLeave = useCallback(() => {
    if (!locked) setActiveKey(null)
  }, [locked])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGRectElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setActiveKey(null)
        setLocked(false)
        return
      }
      const points = flattenedPoints(frame, data)
      if (points.length === 0) return
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
      event.preventDefault()
      if (event.key === 'Enter' || event.key === ' ') {
        const next = activeKey === null ? (points[0] ?? null) : activeKey
        setActiveKey(next)
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
      setActiveKey(points[nextIndex] ?? null)
    },
    [activeKey, data, frame],
  )

  const clipId = baseId + '-plot-clip'
  const tooltipId = baseId + '-tooltip'
  const visibleRows =
    placement === null ? rows : rows.slice(0, Math.max(0, rows.length - placement.hiddenRowCount))
  const status = active === null ? '' : buildStatus(header, rows, placement)

  return (
    <div className="gx-interaction" data-trigger={plan.interaction.trigger}>
      <svg
        ref={svgRef}
        className="gx-interaction__svg"
        viewBox={'0 0 ' + frame.box.width + ' ' + frame.box.height}
        aria-label={title + ' interactive chart'}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={frame.plot.x} y={frame.plot.y} width={frame.plot.width} height={frame.plot.height} />
          </clipPath>
        </defs>
        {plan.interaction.crosshair && active !== null ? (
          <g className="gx-interaction__crosshair" clipPath={'url(#' + clipId + ')'} aria-hidden="true">
            <line
              x1={active.point.x}
              x2={active.point.x}
              y1={frame.plot.y}
              y2={frame.plot.y + frame.plot.height}
            />
          </g>
        ) : null}
        <rect
          className="gx-interaction__target"
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
          onPointerLeave={clearOnLeave}
          onPointerOut={clearOnLeave}
          onPointerCancel={clearOnLeave}
          onFocus={() => {
            if (activeKey === null) setActiveKey(flattenedPoints(frame, data)[0] ?? null)
          }}
          onKeyDown={handleKeyDown}
        />
      </svg>
      {placement !== null && active !== null ? (
        <div
          ref={tooltipRef}
          id={tooltipId}
          className="gx-interaction__tooltip"
          role="tooltip"
          data-tooltip-mode={placement.mode}
          data-tooltip-side={placement.side}
          data-status={placement.status}
          data-series-id={active.seriesId}
          data-point-index={active.pointIndex}
          style={{
            insetInlineStart: placement.x,
            insetBlockStart: placement.y,
            inlineSize: placement.width,
            blockSize: placement.height,
          }}
        >
          <div className="gx-interaction__tooltip-header">{header}</div>
          <div className="gx-interaction__tooltip-rows">
            {visibleRows.map((row) => (
              <div
                className="gx-interaction__tooltip-row"
                key={row.seriesId}
                data-series-id={row.seriesId}
              >
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
            {placement.hiddenRowCount > 0 ? (
              <div className="gx-interaction__tooltip-overflow">
                +{placement.hiddenRowCount} more
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="gx-interaction__status" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  )
}

function nearestPoint(
  event: PointerEvent<SVGRectElement>,
  svg: SVGSVGElement | null,
  frame: ChartFrame,
  data: readonly Series[],
): DatumKey | null {
  if (svg === null) return null
  const bounds = svg.getBoundingClientRect()
  const scaleX = bounds.width > 0 ? frame.box.width / bounds.width : 1
  const scaleY = bounds.height > 0 ? frame.box.height / bounds.height : 1
  const x = (event.clientX - bounds.left) * scaleX
  const y = (event.clientY - bounds.top) * scaleY
  let bestKey: DatumKey | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const seriesFrame of frame.series) {
    const source = data.find((series) => series.id === seriesFrame.id)
    if (source === undefined) continue
    const indices = definedPointIndices(source)
    seriesFrame.points.forEach((point, ordinal) => {
      const pointIndex = indices[ordinal]
      if (pointIndex === undefined) return
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2
      const key = { seriesId: seriesFrame.id, pointIndex }
      if (distance < bestDistance) {
        bestKey = key
        bestDistance = distance
      }
    })
  }
  return bestKey
}

function resolveActivePoint(
  key: DatumKey,
  frame: ChartFrame,
  data: readonly Series[],
): ActivePoint | null {
  const seriesFrame = frame.series.find((series) => series.id === key.seriesId)
  const source = data.find((series) => series.id === key.seriesId)
  if (seriesFrame === undefined || source === undefined) return null
  const ordinal = definedPointIndices(source).indexOf(key.pointIndex)
  const point = ordinal < 0 ? undefined : seriesFrame.points[ordinal]
  const sourcePoint = source.points[key.pointIndex]
  if (point === undefined || sourcePoint === undefined || sourcePoint.y === null) return null
  return { ...key, point, xValue: sourcePoint.x }
}

function buildTooltipRows(
  active: ActivePoint,
  frame: ChartFrame,
  data: readonly Series[],
): readonly TooltipRow[] {
  const activeSource = data.find((series) => series.id === active.seriesId)
  const activePoint = activeSource?.points[active.pointIndex]
  if (activePoint === undefined) return []
  const rows: TooltipRow[] = []
  for (const seriesFrame of frame.series) {
    const source = data.find((series) => series.id === seriesFrame.id)
    if (source === undefined) continue
    const pointIndex = source.points.findIndex(
      (point) => sameX(point.x, activePoint.x) && point.y !== null,
    )
    const point = pointIndex < 0 ? undefined : source.points[pointIndex]
    if (point === undefined || point.y === null) continue
    rows.push({
      seriesId: seriesFrame.id,
      label: seriesFrame.label,
      value: formatYLabel(point.y),
      pointIndex,
    })
  }
  return rows
}

function flattenedPoints(frame: ChartFrame, data: readonly Series[]): readonly DatumKey[] {
  const points: DatumKey[] = []
  for (const seriesFrame of frame.series) {
    const source = data.find((series) => series.id === seriesFrame.id)
    if (source === undefined) continue
    for (const pointIndex of definedPointIndices(source)) {
      points.push({ seriesId: seriesFrame.id, pointIndex })
    }
  }
  return points
}

function definedPointIndices(series: Series): readonly number[] {
  const indices: number[] = []
  series.points.forEach((point, index) => {
    if (point.y !== null) indices.push(index)
  })
  return indices
}

function sameX(a: DataPoint['x'], b: DataPoint['x']): boolean {
  const left = a instanceof Date ? a.getTime() : a
  const right = b instanceof Date ? b.getTime() : b
  return left === right
}

function sameDatum(left: DatumKey, right: DatumKey): boolean {
  return left.seriesId === right.seriesId && left.pointIndex === right.pointIndex
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
