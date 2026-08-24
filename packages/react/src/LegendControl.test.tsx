/**
 * @vitest-environment jsdom
 */

import { describeShape, planChart, sizeContextFromPixels, type Series } from '@gx/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LegendControl } from './LegendControl.tsx'

const DATA: readonly Series[] = [
  { id: 'alpha', label: 'Shared', points: [{ x: 0, y: 10 }] },
  { id: 'beta', label: 'Shared', points: [{ x: 0, y: 20 }] },
  { id: 'gamma', points: [{ x: 0, y: null }] },
  { id: 'delta', label: 'Delta', points: [{ x: 0, y: 4 }] },
  { id: 'epsilon', label: 'Epsilon', points: [{ x: 0, y: 8 }] },
]

const PLAN = planChart('line', sizeContextFromPixels(1000, 700), describeShape(DATA))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

function mount(hiddenSeriesIds: readonly string[] = [], onVisibilityChange = vi.fn()) {
  act(() => {
    root.render(
      <LegendControl
        plan={PLAN}
        series={DATA}
        hiddenSeriesIds={hiddenSeriesIds}
        onVisibilityChange={onVisibilityChange}
      />,
    )
  })
  return onVisibilityChange
}

describe('controlled legend visibility', () => {
  it('keeps hidden series in stable order with aria-pressed state', () => {
    mount(['beta'])
    const buttons = [...container.querySelectorAll('button')]
    expect(
      [...container.querySelectorAll('.gx-legend__item')].map(
        (item) => (item as HTMLElement).dataset.seriesId,
      ),
    ).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon'])
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'true',
      'true',
      'true',
    ])
    expect(buttons.every((button) => button.type === 'button')).toBe(true)
    expect(container.textContent).toContain('gamma')
  })

  it('emits a controlled visibility intent from click and keyboard activation', () => {
    const onVisibilityChange = mount([], vi.fn())
    const button = container.querySelector('[data-series-id="alpha"] button') as HTMLButtonElement
    act(() => button.click())
    expect(onVisibilityChange).toHaveBeenLastCalledWith('alpha', false)

    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onVisibilityChange).toHaveBeenLastCalledWith('alpha', false)
    expect(onVisibilityChange).toHaveBeenCalledTimes(2)
  })

  it('does not mount for direct, absent, or non-toggle plans', () => {
    const direct = { ...PLAN, legend: { placement: 'direct' as const } }
    const absent = { ...PLAN, legend: { placement: 'absent' as const } }
    const nonToggle = { ...PLAN, interaction: { ...PLAN.interaction, legendToggle: false } }
    for (const plan of [direct, absent, nonToggle]) {
      act(() => {
        root.render(
          <LegendControl
            plan={plan}
            series={DATA}
            hiddenSeriesIds={[]}
            onVisibilityChange={vi.fn()}
          />,
        )
      })
      expect(container.firstElementChild).toBeNull()
    }
  })
})
