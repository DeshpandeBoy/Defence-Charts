/**
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createWidgetLayout } from '@shiftcharts/core'
import {
  beginKeyboardSession,
  cancelKeyboardSession,
  commitKeyboardSession,
  interpretKeyboardKey,
  previewKeyboardStep,
} from './keyboard.ts'
import { KeyboardGrid } from './KeyboardGrid.tsx'

const INITIAL_LAYOUT = [
  createWidgetLayout({ id: 'sales', x: 0, y: 0, w: 4, h: 2 }),
  createWidgetLayout({ id: 'margin', x: 6, y: 0, w: 4, h: 1 }),
] as const

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderKeyboardGrid(
  props: Partial<Parameters<typeof KeyboardGrid>[0]> = {},
): void {
  act(() => {
    root.render(
      <KeyboardGrid
        item={INITIAL_LAYOUT[0]}
        layout={INITIAL_LAYOUT}
        mode="edit"
        {...props}
      >
        <div data-testid="widget-content">Widget content</div>
      </KeyboardGrid>,
    )
  })
}

function control(mode: 'move' | 'resize'): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(`[data-shiftcharts-keyboard-control="${mode}"]`)
  if (element === null) throw new Error(`missing ${mode} control`)
  return element
}

function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('keyboard contract', () => {
  it('maps activation, arrows, commit, and cancel without DOM dependencies', () => {
    expect(interpretKeyboardKey('Enter', null, 'resize')).toEqual({ kind: 'start', mode: 'resize' })
    expect(interpretKeyboardKey(' ', null, 'move')).toEqual({ kind: 'start', mode: 'move' })
    expect(interpretKeyboardKey('ArrowRight', 'move')).toEqual({ kind: 'step', key: 'ArrowRight' })
    expect(interpretKeyboardKey('Enter', 'resize')).toEqual({ kind: 'commit' })
    expect(interpretKeyboardKey('Escape', 'move')).toEqual({ kind: 'cancel' })
    expect(interpretKeyboardKey('Tab', 'move')).toBeNull()
  })

  it('uses stable IDs and the shared proposal path for one-unit moves and resizes', () => {
    const moveSession = beginKeyboardSession('move', 'sales', INITIAL_LAYOUT)
    const moved = previewKeyboardStep(moveSession, 'ArrowRight')
    expect(moved.current.find((item) => item.id === 'sales')).toMatchObject({ x: 1, y: 0 })
    expect(moved.current.map((item) => item.id)).toEqual(['sales', 'margin'])

    const resizeSession = beginKeyboardSession('resize', 'sales', INITIAL_LAYOUT)
    const resized = previewKeyboardStep(resizeSession, 'ArrowRight')
    expect(resized.current.find((item) => item.id === 'sales')).toMatchObject({ w: 5, h: 2 })
    expect(resized.current.map((item) => item.id)).toEqual(['sales', 'margin'])
  })

  it('rejects min-size keyboard resizes instead of silently clamping', () => {
    const layout = [
      createWidgetLayout({ id: 'sales', x: 0, y: 0, w: 2, h: 2, minW: 2 }),
    ] as const
    const session = beginKeyboardSession('resize', 'sales', layout)

    expect(() => previewKeyboardStep(session, 'ArrowLeft')).toThrow(/current width\/height/)
  })

  it('returns the exact initial snapshot on cancel and the latest preview on commit', () => {
    const session = previewKeyboardStep(
      beginKeyboardSession('move', 'sales', INITIAL_LAYOUT),
      'ArrowDown',
    )

    expect(cancelKeyboardSession(session)).toBe(INITIAL_LAYOUT)
    expect(commitKeyboardSession(session)).toBe(session.current)
  })
})

describe('KeyboardGrid controls', () => {
  it('starts move mode, previews one unit, cancels exactly, and restores focus', () => {
    const onPreview = vi.fn()
    const onCancel = vi.fn()
    renderKeyboardGrid({ onLayoutPreview: onPreview, onLayoutCancel: onCancel })
    const move = control('move')

    act(() => move.focus())
    press(move, 'Enter')
    expect(move.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[aria-live]')?.textContent).toContain('Move mode')

    press(move, 'ArrowRight')
    expect(onPreview).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'sales', x: 1 }),
    ]))
    expect(move.getAttribute('aria-label')).toContain('column 2')

    press(move, 'Escape')
    expect(onCancel).toHaveBeenCalledWith(INITIAL_LAYOUT)
    expect(document.activeElement).toBe(move)
    expect(move.getAttribute('aria-pressed')).toBe('false')
  })

  it('starts resize mode, commits the latest preview, and keeps focus on resize', () => {
    const onCommit = vi.fn()
    renderKeyboardGrid({ onLayoutCommit: onCommit })
    const resize = control('resize')

    act(() => resize.focus())
    press(resize, ' ')
    press(resize, 'ArrowRight')
    press(resize, 'Enter')

    expect(onCommit).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'sales', w: 5 }),
    ]))
    expect(document.activeElement).toBe(resize)
    expect(resize.getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('[aria-live]')?.textContent).toContain('Resize committed')
  })

  it('announces a boundary failure without emitting a preview', () => {
    const onPreview = vi.fn()
    const layout = [
      createWidgetLayout({ id: 'sales', x: 0, y: 0, w: 2, h: 2, minW: 2 }),
    ] as const
    renderKeyboardGrid({ item: layout[0], layout, onLayoutPreview: onPreview })
    const resize = control('resize')

    act(() => resize.focus())
    press(resize, 'Enter')
    press(resize, 'ArrowLeft')

    expect(onPreview).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-live]')?.textContent).toContain('Cannot resize')
  })

  it('does not expose editing affordances in read-only mode', () => {
    renderKeyboardGrid({ mode: 'read-only' })

    expect(container.querySelector('[data-shiftcharts-keyboard-control]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(container.querySelector('[data-shiftcharts-keyboard-mode="read-only"]')).not.toBeNull()
  })
})
