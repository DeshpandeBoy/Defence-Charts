'use client'

import { GRID_COLUMNS, createWidgetId, createWidgetLayout, createLayoutSnapshot } from '@gx/core'
import type {
  LayoutSnapshot,
  WidgetId,
  WidgetLayout,
  WidgetLayoutInput,
} from '@gx/core'
import { useMemo, useCallback, type CSSProperties, type ReactElement } from 'react'
import { GridLayout } from 'react-grid-layout/react'
import type {
  EventCallback,
  Layout as RglLayout,
  LayoutItem as RglLayoutItem,
} from 'react-grid-layout/react'

import { normalizeGridLayout } from './adapter.ts'

/** The only modes the first grid wrapper exposes. */
export type WidgetGridMode = 'edit' | 'read-only'

/** Serialisable identity and state delivered for one drag/resize lifecycle callback. */
export type WidgetGridInteraction = {
  readonly id: WidgetId
  readonly item: WidgetLayout
  readonly layout: LayoutSnapshot
}

export type WidgetGridInteractionHandler = (interaction: WidgetGridInteraction) => void

/** Project-owned controlled grid props; no RGL types cross this public boundary. */
export type WidgetGridProps = {
  readonly layout: readonly WidgetLayoutInput[]
  readonly width: number
  readonly renderItem: (item: WidgetLayout) => ReactElement
  readonly mode?: WidgetGridMode
  readonly rowHeight?: number
  readonly margin?: readonly [number, number]
  readonly containerPadding?: readonly [number, number] | null
  readonly className?: string
  readonly style?: CSSProperties
  readonly onLayoutChange?: (snapshot: LayoutSnapshot) => void
  readonly onDragStart?: WidgetGridInteractionHandler
  readonly onDrag?: WidgetGridInteractionHandler
  readonly onDragStop?: WidgetGridInteractionHandler
  readonly onResizeStart?: WidgetGridInteractionHandler
  readonly onResize?: WidgetGridInteractionHandler
  readonly onResizeStop?: WidgetGridInteractionHandler
}

const DEFAULT_ROW_HEIGHT = 80
const DEFAULT_MARGIN: readonly [number, number] = [12, 12]
const DEFAULT_CONTAINER_PADDING: readonly [number, number] = [0, 0]

function toInput(item: RglLayoutItem): WidgetLayoutInput {
  return {
    id: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    ...(item.minW === undefined ? {} : { minW: item.minW }),
    ...(item.minH === undefined ? {} : { minH: item.minH }),
    ...(item.maxW === undefined ? {} : { maxW: item.maxW }),
    ...(item.maxH === undefined ? {} : { maxH: item.maxH }),
    draggable: item.isDraggable ?? true,
    resizable: item.isResizable ?? true,
  }
}

function toWidgetLayout(item: RglLayoutItem): WidgetLayout {
  return createWidgetLayout(toInput(item))
}

function toSnapshot(layout: RglLayout): LayoutSnapshot {
  return createLayoutSnapshot(layout.map(toInput))
}

function toRglLayout(items: readonly WidgetLayout[]): RglLayoutItem[] {
  return items.map((item) => ({
    i: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    ...(item.maxW === null ? {} : { maxW: item.maxW }),
    ...(item.maxH === null ? {} : { maxH: item.maxH }),
    isDraggable: item.draggable,
    isResizable: item.resizable,
  }))
}

function interactionFrom(
  layout: RglLayout,
  item: RglLayoutItem | null,
): WidgetGridInteraction | null {
  if (item === null) return null
  const widget = toWidgetLayout(item)
  return Object.freeze({
    id: createWidgetId(widget.id),
    item: widget,
    layout: toSnapshot(layout),
  })
}

function emitInteraction(
  handler: WidgetGridInteractionHandler | undefined,
  layout: RglLayout,
  item: RglLayoutItem | null,
): void {
  if (handler === undefined) return
  const interaction = interactionFrom(layout, item)
  if (interaction !== null) handler(interaction)
}

/**
 * Controlled, client-only widget placement shell.
 *
 * The host owns `layout` and persists `onLayoutChange` output. RGL is only responsible for the
 * pointer mechanics; every public callback is converted back to the serialisable core contract.
 * `renderItem` receives placement data, not chart data, so the grid cannot choose information.
 */
export function WidgetGrid({
  layout,
  width,
  renderItem,
  mode = 'edit',
  rowHeight = DEFAULT_ROW_HEIGHT,
  margin = DEFAULT_MARGIN,
  containerPadding = DEFAULT_CONTAINER_PADDING,
  className,
  style,
  onLayoutChange,
  onDragStart,
  onDrag,
  onDragStop,
  onResizeStart,
  onResize,
  onResizeStop,
}: WidgetGridProps): ReactElement {
  const normalizedLayout = useMemo(() => normalizeGridLayout(layout), [layout])
  const engineLayout = useMemo(() => toRglLayout(normalizedLayout), [normalizedLayout])
  const children = useMemo(
    () =>
      normalizedLayout.map((item) => (
        <div key={item.id} data-gx-widget-id={item.id}>
          {renderItem(item)}
        </div>
      )),
    [normalizedLayout, renderItem],
  )
  const gridConfig = useMemo(
    () => ({
      cols: GRID_COLUMNS,
      rowHeight,
      margin,
      containerPadding,
    }),
    [containerPadding, margin, rowHeight],
  )
  const dragConfig = useMemo(() => ({ enabled: mode === 'edit' }), [mode])
  const resizeConfig = useMemo(() => ({ enabled: mode === 'edit' }), [mode])

  const handleLayoutChange = useCallback(
    (nextLayout: RglLayout) => {
      onLayoutChange?.(toSnapshot(nextLayout))
    },
    [onLayoutChange],
  )
  const handleDragStart: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onDragStart, nextLayout, newItem ?? oldItem)
    },
    [onDragStart],
  )
  const handleDrag: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onDrag, nextLayout, newItem ?? oldItem)
    },
    [onDrag],
  )
  const handleDragStop: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onDragStop, nextLayout, newItem ?? oldItem)
    },
    [onDragStop],
  )
  const handleResizeStart: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onResizeStart, nextLayout, newItem ?? oldItem)
    },
    [onResizeStart],
  )
  const handleResize: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onResize, nextLayout, newItem ?? oldItem)
    },
    [onResize],
  )
  const handleResizeStop: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onResizeStop, nextLayout, newItem ?? oldItem)
    },
    [onResizeStop],
  )

  return (
    <GridLayout
      width={width}
      layout={engineLayout}
      gridConfig={gridConfig}
      dragConfig={dragConfig}
      resizeConfig={resizeConfig}
      {...(className === undefined ? {} : { className })}
      {...(style === undefined ? {} : { style })}
      onLayoutChange={handleLayoutChange}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
    >
      {children}
    </GridLayout>
  )
}
