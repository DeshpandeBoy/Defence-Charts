/**
 * @vitest-environment jsdom
 */

import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { WidgetShell } from './WidgetShell.tsx'

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

function mount(node: ReactElement): void {
  act(() => root.render(node))
}

describe('WidgetShell', () => {
  it('renders title/context/actions, content, and footer in stable regions', () => {
    mount(
      <WidgetShell
        widgetId="sales"
        title="Sales"
        context={<span>Q3</span>}
        actions={<button type="button">Export</button>}
        footer={<span>Updated now</span>}
        theme="light"
      >
        <div>Chart content</div>
      </WidgetShell>,
    )

    expect(container.querySelector('section')?.getAttribute('data-shiftcharts-widget-id')).toBe('sales')
    expect(container.querySelector('[data-shiftcharts-theme="light"]')).not.toBeNull()
    expect(container.querySelector('.shiftcharts-widget-shell__title')?.textContent).toBe('Sales')
    expect(container.querySelector('.shiftcharts-widget-shell__context')?.textContent).toBe('Q3')
    expect(container.querySelector('.shiftcharts-widget-shell__actions')?.textContent).toBe('Export')
    expect(container.querySelector('.shiftcharts-widget-shell__content')?.textContent).toBe('Chart content')
    expect(container.querySelector('.shiftcharts-widget-shell__footer')?.textContent).toBe('Updated now')
  })

  it('gives the shell and drag handle accessible names', () => {
    mount(
      <WidgetShell widgetId="margin" dragHandleLabel="Reorder margin">
        <span>Value</span>
      </WidgetShell>,
    )

    const section = container.querySelector('section')
    const handle = container.querySelector('button[data-shiftcharts-drag-handle]')
    expect(section?.getAttribute('aria-label')).toBe('Widget margin')
    expect(handle?.getAttribute('aria-label')).toBe('Reorder margin')
    expect(handle?.getAttribute('title')).toBe('Reorder margin')
  })

  it('marks content and controls as grid-drag cancel scope', () => {
    mount(
      <WidgetShell
        widgetId="sales"
        actions={<button type="button">Action</button>}
        footer={<span>Footer</span>}
      >
        <button type="button">Chart control</button>
      </WidgetShell>,
    )

    expect(container.querySelectorAll('[data-shiftcharts-grid-cancel]').length).toBe(4)
    expect(container.querySelector('[data-shiftcharts-widget-content]')?.className).toBe(
      'shiftcharts-widget-shell__content',
    )
    expect(container.querySelector('[data-shiftcharts-drag-handle]')).not.toBeNull()
  })
})
