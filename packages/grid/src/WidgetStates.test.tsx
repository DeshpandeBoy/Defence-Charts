/**
 * @vitest-environment jsdom
 */

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WidgetStates, type WidgetStateKind } from './WidgetStates.tsx'

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
  vi.unstubAllGlobals()
})

function mount(node: ReactElement): void {
  act(() => root.render(node))
}

function stateRoot(): HTMLDivElement {
  const element = container.querySelector<HTMLDivElement>('.gx-widget-states')
  if (element === null) throw new Error('Expected WidgetStates root')
  return element
}

const SLOT_ORDER = ['content', 'status', 'message', 'label', 'description', 'action']

describe('WidgetStates', () => {
  it.each([
    ['loading', 'status', 'polite', 'Loading data'],
    ['empty', 'status', 'polite', 'No data available'],
    ['error', 'alert', 'assertive', 'Unable to show this data'],
    ['stale', 'status', 'polite', 'Showing previously loaded data'],
  ] as const)('renders the accessible contract for %s', (state, role, liveMode, message) => {
    mount(<WidgetStates state={state} />)

    const rootElement = stateRoot()
    const status = rootElement.querySelector('[data-gx-widget-state-slot="status"]')
    expect(rootElement.getAttribute('data-gx-widget-state')).toBe(state)
    expect(rootElement.getAttribute('aria-busy')).toBe(state === 'loading' ? 'true' : null)
    expect(status?.getAttribute('role')).toBe(role)
    expect(status?.getAttribute('aria-live')).toBe(liveMode)
    expect(status?.getAttribute('aria-atomic')).toBe('true')
    expect(rootElement.querySelector('[data-gx-widget-state-slot="label"]')?.textContent).toBe(message)
  })

  it('keeps the same wrapper and slot structure while the host changes state', () => {
    mount(
      <WidgetStates state="loading">
        <div data-testid="host-content">Chart content</div>
      </WidgetStates>,
    )

    const before = stateRoot()
    const beforeSlots = [...before.querySelectorAll<HTMLElement>('[data-gx-widget-state-slot]')]
    expect(beforeSlots.map((slot) => slot.dataset.gxWidgetStateSlot)).toEqual(SLOT_ORDER)

    act(() =>
      root.render(
        <WidgetStates state="stale" action={<button type="button">Details</button>}>
          <div data-testid="host-content">Chart content</div>
        </WidgetStates>,
      ),
    )

    const after = stateRoot()
    const afterSlots = [...after.querySelectorAll<HTMLElement>('[data-gx-widget-state-slot]')]
    expect(after).toBe(before)
    expect(afterSlots).toEqual(beforeSlots)
    expect(afterSlots.map((slot) => slot.dataset.gxWidgetStateSlot)).toEqual(SLOT_ORDER)
    expect(after.querySelector('[data-testid="host-content"]')?.textContent).toBe('Chart content')
    expect(after.querySelector('[data-gx-widget-state-slot="action"]')?.textContent).toBe('Details')
  })

  it('keeps host message, description, action, class, and content untouched', () => {
    const onHostAction = vi.fn()
    mount(
      <WidgetStates
        state="error"
        className="host-state-style"
        message={<strong>Could not load revenue</strong>}
        description={<span>Try again after checking the selected period.</span>}
        action={
          <button type="button" onClick={onHostAction}>
            Retry
          </button>
        }
      >
        <output data-testid="host-value">Previous value</output>
      </WidgetStates>,
    )

    const rootElement = stateRoot()
    const action = rootElement.querySelector('button')
    expect(rootElement.className).toBe('gx-widget-states host-state-style')
    expect(rootElement.querySelector('[data-gx-widget-state-slot="label"]')?.textContent).toBe(
      'Could not load revenue',
    )
    expect(rootElement.querySelector('[data-gx-widget-state-slot="description"]')?.textContent).toBe(
      'Try again after checking the selected period.',
    )
    expect(rootElement.querySelector('[data-testid="host-value"]')?.textContent).toBe('Previous value')
    expect(action?.textContent).toBe('Retry')

    act(() => action?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onHostAction).toHaveBeenCalledOnce()
  })

  it('does not fetch or create retry behavior when the host changes state', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    mount(<WidgetStates state="loading" />)
    act(() => root.render(<WidgetStates state="error" message="Host supplied error" />))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelectorAll('button, a').length).toBe(0)
  })

  it('accepts every public state as a controlled value without adding local state', () => {
    const states: readonly WidgetStateKind[] = ['loading', 'empty', 'error', 'stale']

    for (const state of states) {
      mount(<WidgetStates state={state} />)
      const rootElement = stateRoot()
      expect(rootElement.dataset.gxWidgetState).toBe(state)
      expect(
        [...rootElement.querySelectorAll<HTMLElement>('[data-gx-widget-state-slot]')].map(
          (slot) => slot.dataset.gxWidgetStateSlot,
        ),
      ).toEqual(SLOT_ORDER)
    }
  })
})
