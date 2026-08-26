'use client'

import {
  GRID_COLUMNS,
  createLayoutSnapshot,
  createWidgetId,
  createWidgetLayout,
  serializeLayoutSnapshot,
} from '@shiftcharts/core'
import type {
  LayoutSnapshot,
  WidgetId,
  WidgetLayout,
  WidgetLayoutInput,
} from '@shiftcharts/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { GridLayout } from 'react-grid-layout/react'
import type {
  EventCallback,
  Layout as RglLayout,
  LayoutItem as RglLayoutItem,
} from 'react-grid-layout/react'

import { normalizeGridLayout } from './adapter.ts'
import {
  beginGridInteraction,
  cancelGridInteraction,
  commitGridInteraction,
  previewGridInteraction,
} from './interaction.ts'
import type { GridInteractionKind, GridInteractionState } from './interaction.ts'
import { KeyboardGrid } from './KeyboardGrid.tsx'

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
  readonly cancelInteractionToken?: number
  readonly onLayoutChange?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutStart?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutPreview?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutCommit?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutCancel?: (snapshot: LayoutSnapshot) => void
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
 * The host owns `layout`. RGL is only responsible for pointer mechanics; every public callback is
 * converted back to the serialisable core contract. Preview callbacks can be frequent, while
 * `onLayoutChange`/`onLayoutCommit` are deduplicated commit notifications. `renderItem` receives
 * placement data, not chart data, so the grid cannot choose information.
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
  cancelInteractionToken,
  onLayoutChange,
  onLayoutStart,
  onLayoutPreview,
  onLayoutCommit,
  onLayoutCancel,
  onDragStart,
  onDrag,
  onDragStop,
  onResizeStart,
  onResize,
  onResizeStop,
}: WidgetGridProps): ReactElement {
  const normalizedLayout = useMemo(() => normalizeGridLayout(layout), [layout])
  const [keyboardLayout, setKeyboardLayout] = useState<readonly WidgetLayout[] | null>(null)
  const keyboardInteractionRef = useRef(false)
  const keyboardCancelSignatureRef = useRef<string | null>(null)
  const activeInteractionRef = useRef<GridInteractionState | null>(null)
  const lastCommitSignatureRef = useRef<string | null>(null)
  const cancelTokenRef = useRef<number | undefined>(cancelInteractionToken)

  const emitCommittedLayout = useCallback(
    (snapshot: LayoutSnapshot) => {
      const signature = serializeLayoutSnapshot(snapshot)
      if (lastCommitSignatureRef.current === signature) return
      lastCommitSignatureRef.current = signature
      onLayoutChange?.(snapshot)
      onLayoutCommit?.(snapshot)
    },
    [onLayoutChange, onLayoutCommit],
  )

  const displayLayout = keyboardLayout ?? normalizedLayout
  const engineLayout = useMemo(() => toRglLayout(displayLayout), [displayLayout])
  const children = useMemo(
    () =>
      displayLayout.map((item) => (
        <div key={item.id} data-shiftcharts-widget-id={item.id}>
          <KeyboardGrid
            item={item}
            layout={displayLayout}
            mode={mode}
            {...(cancelInteractionToken === undefined ? {} : { cancelInteractionToken })}
            onLayoutStart={(nextLayout) => {
              keyboardCancelSignatureRef.current = null
              keyboardInteractionRef.current = true
              onLayoutStart?.(createLayoutSnapshot(nextLayout))
            }}
            onLayoutPreview={(nextLayout) => {
              setKeyboardLayout(nextLayout)
              onLayoutPreview?.(createLayoutSnapshot(nextLayout))
            }}
            onLayoutCommit={(nextLayout) => {
              keyboardCancelSignatureRef.current = null
              keyboardInteractionRef.current = false
              setKeyboardLayout(null)
              emitCommittedLayout(createLayoutSnapshot(nextLayout))
            }}
            onLayoutCancel={(nextLayout) => {
              // RGL can emit stale preview geometry while the controlled layout is being
              // restored. Hold the exact cancellation snapshot until RGL reports it, so a stale
              // callback cannot overwrite the host's restored state.
              const snapshot = createLayoutSnapshot(nextLayout)
              keyboardCancelSignatureRef.current = serializeLayoutSnapshot(snapshot)
              keyboardInteractionRef.current = false
              setKeyboardLayout(null)
              onLayoutCancel?.(snapshot)
            }}
          >
            {renderItem(item)}
          </KeyboardGrid>
        </div>
      )),
    [cancelInteractionToken, displayLayout, emitCommittedLayout, mode, onLayoutCancel, onLayoutPreview, onLayoutStart, renderItem],
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
  const dragConfig = useMemo(
    () => ({
      enabled: mode === 'edit',
      handle: '[data-shiftcharts-drag-handle]',
      cancel: '[data-shiftcharts-grid-cancel], [data-shiftcharts-grid-cancel] *, button, a, input, textarea, select, [role="button"]',
    }),
    [mode],
  )
  const resizeConfig = useMemo(() => ({ enabled: mode === 'edit' }), [mode])

  const beginInteraction = useCallback(
    (kind: GridInteractionKind, nextLayout: RglLayout, oldItem: RglLayoutItem | null, newItem: RglLayoutItem | null) => {
      keyboardCancelSignatureRef.current = null
      const item = newItem ?? oldItem
      if (item === null) return
      const snapshot = toSnapshot(nextLayout)
      activeInteractionRef.current = beginGridInteraction(kind, item.i, snapshot)
      onLayoutStart?.(snapshot)
    },
    [onLayoutStart],
  )

  const previewInteraction = useCallback(
    (kind: GridInteractionKind, nextLayout: RglLayout) => {
      const active = activeInteractionRef.current
      if (active === null || active.kind !== kind) return
      const preview = previewGridInteraction(active, toSnapshot(nextLayout))
      activeInteractionRef.current = preview
      onLayoutPreview?.(preview.preview)
    },
    [onLayoutPreview],
  )

  const finishInteraction = useCallback(
    (kind: GridInteractionKind, nextLayout: RglLayout) => {
      const active = activeInteractionRef.current
      const snapshot = toSnapshot(nextLayout)
      if (active === null || active.kind !== kind) {
        emitCommittedLayout(snapshot)
        return
      }
      const committed = commitGridInteraction(previewGridInteraction(active, snapshot))
      activeInteractionRef.current = null
      emitCommittedLayout(committed.snapshot)
    },
    [emitCommittedLayout],
  )

  useEffect(() => {
    if (cancelInteractionToken === cancelTokenRef.current) return
    cancelTokenRef.current = cancelInteractionToken
    const active = activeInteractionRef.current
    if (active !== null) {
      const cancelled = cancelGridInteraction(active)
      activeInteractionRef.current = null
      onLayoutCancel?.(cancelled.snapshot)
    }
    keyboardInteractionRef.current = false
    setKeyboardLayout(null)
  }, [cancelInteractionToken, onLayoutCancel])

  useEffect(() => {
    keyboardInteractionRef.current = false
    setKeyboardLayout(null)
  }, [mode])

  const handleLayoutChange = useCallback(
    (nextLayout: RglLayout) => {
      const snapshot = toSnapshot(nextLayout)
      const keyboardCancelSignature = keyboardCancelSignatureRef.current
      if (keyboardCancelSignature !== null) {
        if (keyboardCancelSignature === serializeLayoutSnapshot(snapshot)) {
          keyboardCancelSignatureRef.current = null
        }
        return
      }
      if (activeInteractionRef.current !== null || keyboardInteractionRef.current) return
      emitCommittedLayout(snapshot)
    },
    [emitCommittedLayout],
  )
  const handleDragStart: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      beginInteraction('drag', nextLayout, oldItem, newItem)
      emitInteraction(onDragStart, nextLayout, newItem ?? oldItem)
    },
    [beginInteraction, onDragStart],
  )
  const handleDrag: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      previewInteraction('drag', nextLayout)
      emitInteraction(onDrag, nextLayout, newItem ?? oldItem)
    },
    [onDrag, previewInteraction],
  )
  const handleDragStop: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onDragStop, nextLayout, newItem ?? oldItem)
      finishInteraction('drag', nextLayout)
    },
    [finishInteraction, onDragStop],
  )
  const handleResizeStart: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      beginInteraction('resize', nextLayout, oldItem, newItem)
      emitInteraction(onResizeStart, nextLayout, newItem ?? oldItem)
    },
    [beginInteraction, onResizeStart],
  )
  const handleResize: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      previewInteraction('resize', nextLayout)
      emitInteraction(onResize, nextLayout, newItem ?? oldItem)
    },
    [onResize, previewInteraction],
  )
  const handleResizeStop: EventCallback = useCallback(
    (nextLayout, oldItem, newItem) => {
      emitInteraction(onResizeStop, nextLayout, newItem ?? oldItem)
      finishInteraction('resize', nextLayout)
    },
    [finishInteraction, onResizeStop],
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
