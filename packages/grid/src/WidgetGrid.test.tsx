/**
 * @vitest-environment jsdom
 */

import type { ReactElement, ReactNode } from 'react'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Layout as RglLayout, LayoutItem as RglLayoutItem } from 'react-grid-layout/react'

type MockGridProps = {
  readonly layout?: RglLayout
  readonly dragConfig?: { readonly enabled?: boolean }
  readonly resizeConfig?: { readonly enabled?: boolean }
  readonly children?: ReactNode
  readonly onLayoutChange?: (layout: RglLayout) => void
  readonly onLayoutStart?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutPreview?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutCommit?: (snapshot: LayoutSnapshot) => void
  readonly onLayoutCancel?: (snapshot: LayoutSnapshot) => void
  readonly onDragStart?: MockEventCallback
  readonly onDrag?: MockEventCallback
  readonly onDragStop?: (
    layout: RglLayout,
    oldItem: RglLayoutItem | null,
    newItem: RglLayoutItem | null,
    placeholder: RglLayoutItem | null,
    event: Event,
    element: HTMLElement | null,
  ) => void
}

type MockEventCallback = (
  layout: RglLayout,
  oldItem: RglLayoutItem | null,
  newItem: RglLayoutItem | null,
  placeholder: RglLayoutItem | null,
  event: Event,
  element: HTMLElement | null,
) => void

const mockGridProps: MockGridProps[] = []

vi.mock('react-grid-layout/react', () => ({
  GridLayout: (props: MockGridProps): ReactElement => {
    mockGridProps.push(props)
    return createElement('div', { 'data-testid': 'mock-grid' }, props.children)
  },
}))

import type { LayoutSnapshot, WidgetLayout } from '@shiftcharts/core'
import { WidgetGrid } from './WidgetGrid.tsx'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const INITIAL_LAYOUT = [
  { id: 'sales', x: 0, y: 0, w: 4, h: 2, resizable: false },
  { id: 'margin', x: 4, y: 0, w: 4, h: 1 },
] as const

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mockGridProps.length = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

function renderItem(item: WidgetLayout): ReactElement {
  return <span data-item={item.id}>{item.w}×{item.h}</span>
}

function mount(
  layout: typeof INITIAL_LAYOUT = INITIAL_LAYOUT,
  props: Partial<Parameters<typeof WidgetGrid>[0]> = {},
): void {
  act(() =>
    root.render(<WidgetGrid layout={layout} width={960} renderItem={renderItem} {...props} />),
  )
}

function latest(): MockGridProps {
  const props = mockGridProps[mockGridProps.length - 1]
  if (props === undefined) throw new Error('the RGL wrapper did not render')
  return props
}

function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('WidgetGrid controlled wrapper', () => {
  it('passes initial project layout with stable widget keys and no chart knowledge', () => {
    mount()

    expect(latest().layout).toMatchObject([
      { i: 'sales', x: 0, y: 0, w: 4, h: 2, isResizable: false },
      { i: 'margin', x: 4, y: 0, w: 4, h: 1 },
    ])
    expect([...container.querySelectorAll('[data-shiftcharts-widget-id]')].map((node) => node.getAttribute('data-shiftcharts-widget-id')))
      .toEqual(['sales', 'margin'])
    expect([...container.querySelectorAll('[data-item]')].map((node) => node.getAttribute('data-item')))
      .toEqual(['sales', 'margin'])
  })

  it('reflects a controlled layout update without changing widget identity', () => {
    mount()
    const firstKeys = (latest().layout ?? []).map((item) => item.i)

    act(() =>
      root.render(
        <WidgetGrid
          layout={[
            { ...INITIAL_LAYOUT[1], x: 0 },
            { ...INITIAL_LAYOUT[0], x: 4 },
          ]}
          width={960}
          renderItem={renderItem}
        />,
      ),
    )

    expect((latest().layout ?? []).map((item) => item.i)).toEqual(['margin', 'sales'])
    expect(new Set(firstKeys)).toEqual(new Set((latest().layout ?? []).map((item) => item.i)))
    expect([...container.querySelectorAll('[data-shiftcharts-widget-id]')].map((node) => node.getAttribute('data-shiftcharts-widget-id')))
      .toEqual(['margin', 'sales'])
  })

  it('uses explicit edit and read-only modes', () => {
    mount(INITIAL_LAYOUT, { mode: 'edit' })
    expect(latest().dragConfig).toMatchObject({ enabled: true })
    expect(latest().resizeConfig).toEqual({ enabled: true })

    mount(INITIAL_LAYOUT, { mode: 'read-only' })
    expect(latest().dragConfig).toMatchObject({ enabled: false })
    expect(latest().resizeConfig).toEqual({ enabled: false })
  })

  it('routes keyboard proposals through the public controlled commit path', () => {
    const onLayoutCommit = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutChange = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutCommit, onLayoutChange })
    const move = container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')
    if (move === null) throw new Error('missing keyboard move control')

    act(() => move.focus())
    press(move, 'Enter')
    press(move, 'ArrowRight')
    press(move, 'Enter')

    expect(onLayoutChange).toHaveBeenCalledTimes(1)
    expect(onLayoutCommit).toHaveBeenCalledTimes(1)
    expect(onLayoutCommit).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'sales', x: 1 }),
        expect.objectContaining({ id: 'margin' }),
      ]),
    }))
    expect(document.activeElement).toBe(move)
  })

  it('restores the initial public snapshot and initiating focus on keyboard cancel', () => {
    const onLayoutCancel = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutCancel })
    const move = container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')
    if (move === null) throw new Error('missing keyboard move control')

    act(() => move.focus())
    press(move, 'Enter')
    press(move, 'ArrowRight')
    press(move, 'Escape')

    expect(onLayoutCancel).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'sales', x: 0, y: 0, w: 4, h: 2 }),
      ]),
    }))
    expect(document.activeElement).toBe(move)
  })

  it('clears keyboard preview and session when the host cancels the interaction', () => {
    const onLayoutCancel = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { cancelInteractionToken: 0, onLayoutCancel })
    const move = container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')
    if (move === null) throw new Error('missing keyboard move control')

    act(() => move.focus())
    press(move, 'Enter')
    press(move, 'ArrowRight')
    expect(latest().layout?.find((item) => item.i === 'sales')).toMatchObject({ x: 1 })

    act(() => {
      root.render(
        <WidgetGrid
          layout={INITIAL_LAYOUT}
          width={960}
          renderItem={renderItem}
          cancelInteractionToken={1}
          onLayoutCancel={onLayoutCancel}
        />,
      )
    })

    expect(latest().layout?.find((item) => item.i === 'sales')).toMatchObject({ x: 0 })
    expect(container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')?.getAttribute('aria-pressed'))
      .toBe('false')
    expect(onLayoutCancel).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ id: 'sales', x: 0 })]),
    }))
  })

  it('cancels the keyboard session and preview when switching out of edit mode', () => {
    const onLayoutCancel = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutCancel })
    const move = container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')
    if (move === null) throw new Error('missing keyboard move control')

    act(() => move.focus())
    press(move, 'Enter')
    press(move, 'ArrowRight')

    act(() => {
      root.render(
        <WidgetGrid
          layout={INITIAL_LAYOUT}
          width={960}
          renderItem={renderItem}
          mode="read-only"
          onLayoutCancel={onLayoutCancel}
        />,
      )
    })

    expect(latest().layout?.find((item) => item.i === 'sales')).toMatchObject({ x: 0 })
    expect(container.querySelector('[data-shiftcharts-keyboard-control]')).toBeNull()
    expect(onLayoutCancel).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ id: 'sales', x: 0 })]),
    }))

    act(() => {
      root.render(
        <WidgetGrid
          layout={INITIAL_LAYOUT}
          width={960}
          renderItem={renderItem}
          mode="edit"
          onLayoutCancel={onLayoutCancel}
        />,
      )
    })

    expect(container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="move"]')?.getAttribute('aria-pressed'))
      .toBe('false')
  })

  it('ignores one stale RGL layout callback after keyboard cancellation', () => {
    const onLayoutChange = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutCancel = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutChange, onLayoutCancel })
    const resize = container.querySelector<HTMLButtonElement>('[data-shiftcharts-keyboard-control="resize"]')
    if (resize === null) throw new Error('missing keyboard resize control')

    act(() => resize.focus())
    press(resize, 'Enter')
    press(resize, 'ArrowRight')
    press(resize, 'Escape')
    expect(onLayoutCancel).toHaveBeenCalledTimes(1)

    const stalePreview: RglLayout = [
      { i: 'sales', x: 0, y: 0, w: 5, h: 2, isResizable: false },
      { i: 'margin', x: 4, y: 0, w: 4, h: 1 },
    ]
    act(() => latest().onLayoutChange?.(stalePreview))
    expect(onLayoutChange).not.toHaveBeenCalled()

    act(() => latest().onLayoutChange?.(latest().layout ?? []))
    expect(onLayoutChange).not.toHaveBeenCalled()

    act(() => latest().onLayoutChange?.([
      { i: 'sales', x: 1, y: 0, w: 4, h: 2, isResizable: false },
      { i: 'margin', x: 5, y: 0, w: 4, h: 1 },
    ]))
    expect(onLayoutChange).toHaveBeenCalledTimes(1)
  })

  it('removes keyboard editing affordances in read-only mode', () => {
    mount(INITIAL_LAYOUT, { mode: 'read-only' })

    expect(container.querySelector('[data-shiftcharts-keyboard-control]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('configures the explicit shell handle and content/control cancel scope', () => {
    mount()

    expect(latest().dragConfig).toEqual({
      enabled: true,
      handle: '[data-shiftcharts-drag-handle]',
      cancel: '[data-shiftcharts-grid-cancel], [data-shiftcharts-grid-cancel] *, button, a, input, textarea, select, [role="button"]',
    })
  })

  it('converts RGL layout callbacks into immutable snapshots', () => {
    const onLayoutChange = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onDragStop = vi.fn()
    mount(INITIAL_LAYOUT, { onLayoutChange, onDragStop })

    const callbackLayout: RglLayout = [
      { i: 'sales', x: 1, y: 2, w: 4, h: 2, isResizable: false },
      { i: 'margin', x: 5, y: 2, w: 4, h: 1 },
    ]
    act(() => {
      latest().onLayoutChange?.(callbackLayout)
      latest().onDragStop?.(
        callbackLayout,
        callbackLayout[0] ?? null,
        callbackLayout[1] ?? null,
        null,
        new Event('dragstop'),
        null,
      )
    })

    expect(onLayoutChange).toHaveBeenCalledWith({
      version: 1,
      columns: 12,
      items: [
        expect.objectContaining({ id: 'sales', x: 1, y: 2 }),
        expect.objectContaining({ id: 'margin', x: 5, y: 2 }),
      ],
    })
    expect(onDragStop).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'margin', item: expect.objectContaining({ id: 'margin' }) }),
    )
    const emitted = onLayoutChange.mock.calls[0]?.[0]
    expect(emitted).toBeDefined()
    expect(Object.isFrozen(emitted)).toBe(true)
    expect(Object.isFrozen(emitted?.items)).toBe(true)
  })

  it('separates frequent previews from one committed layout callback', () => {
    const onLayoutStart = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutPreview = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutCommit = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutChange = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutStart, onLayoutPreview, onLayoutCommit, onLayoutChange })

    const initial = latest().layout ?? []
    const preview: RglLayout = [
      { i: 'sales', x: 0, y: 2, w: 4, h: 2, isResizable: false },
      { i: 'margin', x: 4, y: 0, w: 4, h: 1 },
    ]
    act(() => {
      latest().onDragStart?.(initial, null, initial[0] ?? null, null, new Event('dragstart'), null)
      latest().onDrag?.(preview, initial[0] ?? null, preview[0] ?? null, null, new Event('drag'), null)
      latest().onDrag?.(preview, initial[0] ?? null, preview[0] ?? null, null, new Event('drag'), null)
      latest().onDragStop?.(preview, initial[0] ?? null, preview[0] ?? null, null, new Event('dragstop'), null)
      // RGL may deliver the same final layout through its effect after the stop callback.
      latest().onLayoutChange?.(preview)
    })

    expect(onLayoutStart).toHaveBeenCalledTimes(1)
    expect(onLayoutPreview).toHaveBeenCalledTimes(2)
    expect(onLayoutCommit).toHaveBeenCalledTimes(1)
    expect(onLayoutChange).toHaveBeenCalledTimes(1)
    expect(onLayoutCommit).toHaveBeenCalledWith(expect.objectContaining({ items: expect.arrayContaining([
      expect.objectContaining({ id: 'sales', y: 2 }),
    ]) }))
  })

  it('cancels an active interaction back to its initial snapshot', () => {
    const onLayoutCancel = vi.fn<(snapshot: LayoutSnapshot) => void>()
    const onLayoutCommit = vi.fn<(snapshot: LayoutSnapshot) => void>()
    mount(INITIAL_LAYOUT, { onLayoutCancel, onLayoutCommit })

    const initial = latest().layout ?? []
    const preview: RglLayout = [
      { i: 'sales', x: 0, y: 3, w: 4, h: 2, isResizable: false },
      { i: 'margin', x: 4, y: 0, w: 4, h: 1 },
    ]
    act(() => {
      latest().onDragStart?.(initial, null, initial[0] ?? null, null, new Event('dragstart'), null)
      latest().onDrag?.(preview, initial[0] ?? null, preview[0] ?? null, null, new Event('drag'), null)
      root.render(
        <WidgetGrid
          layout={INITIAL_LAYOUT}
          width={960}
          renderItem={renderItem}
          cancelInteractionToken={1}
          onLayoutCancel={onLayoutCancel}
          onLayoutCommit={onLayoutCommit}
        />,
      )
    })

    expect(onLayoutCancel).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ id: 'sales', y: 0 })]),
    }))
    expect(onLayoutCommit).not.toHaveBeenCalled()
  })
})
