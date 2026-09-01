/**
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MotionBoundary, type MotionDiagnostics } from './index.tsx'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

type FakeAnimation = Animation & {
  readonly cancel: ReturnType<typeof vi.fn>
}

let container: HTMLDivElement
let root: Root
let animate: ReturnType<typeof vi.fn>
let originalAnimate: typeof Element.prototype.animate
let originalMatchMedia: typeof window.matchMedia
let pendingFinishes: Array<() => void>
let originalGetComputedStyle: typeof window.getComputedStyle

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  originalAnimate = Element.prototype.animate
  originalMatchMedia = window.matchMedia
  originalGetComputedStyle = window.getComputedStyle
  pendingFinishes = []
  animate = vi.fn((keyframes: Keyframe[] | PropertyIndexedKeyframes) => {
    const cancel = vi.fn()
    const effect = { getKeyframes: () => Array.isArray(keyframes) ? keyframes : [] }
    let finish: () => void = () => undefined
    const finished = new Promise<void>((resolve) => { finish = resolve })
    pendingFinishes.push(finish)
    const animation = {
      effect,
      finished,
      cancel,
    } as unknown as FakeAnimation
    return animation
  })
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  })
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
    const style = originalGetComputedStyle.call(window, element, pseudoElement)
    if (!(element instanceof SVGElement)) return style
    const getPropertyValue = style.getPropertyValue.bind(style)
    Object.defineProperty(style, 'getPropertyValue', {
      configurable: true,
      value: (property: string) => property === 'd' ? '' : getPropertyValue(property),
    })
    return style
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: originalAnimate })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

function renderPath(d: string | null, phase: 'idle' | 'preview' = 'idle', onDiagnostics?: (value: MotionDiagnostics) => void): void {
  act(() => {
    root.render(
      <div data-shiftcharts-interaction-phase={phase}>
        <MotionBoundary preset="cinematic" debug onDiagnostics={onDiagnostics}>
          <svg>
            {d === null ? null : <path data-shiftcharts-mark-id="series:line" d={d} />}
          </svg>
        </MotionBoundary>
      </div>,
    )
  })
}

async function flushMotion(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    vi.runOnlyPendingTimers()
    await Promise.resolve()
  })
}

async function finishMotion(): Promise<void> {
  await act(async () => {
    for (const finish of pendingFinishes) finish()
    pendingFinishes = []
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('MotionBoundary', () => {
  it('interpolates compatible geometry and reports preview timing', async () => {
    const diagnostics: MotionDiagnostics[] = []
    renderPath('M0 0L10 10', 'preview', (value) => diagnostics.push(value))
    renderPath('M0 2L10 12', 'preview', (value) => diagnostics.push(value))
    await flushMotion()

    expect(animate).toHaveBeenCalled()
    expect(animate.mock.calls.some(([keyframes]) => Array.isArray(keyframes) && keyframes.some((frame) => 'd' in frame))).toBe(true)
    expect(diagnostics.at(-1)).toMatchObject({ phase: 'preview', strategy: 'geometry', animatedMarks: 1 })
  })

  it('cancels the displayed geometry before an interrupted update', async () => {
    const diagnostics: MotionDiagnostics[] = []
    renderPath('M0 0L10 10', 'idle', (value) => diagnostics.push(value))
    renderPath('M0 2L10 12', 'idle', (value) => diagnostics.push(value))
    await flushMotion()
    const firstAnimation = animate.mock.results[0]?.value as FakeAnimation | undefined

    renderPath('M0 4L10 14', 'idle', (value) => diagnostics.push(value))
    await flushMotion()

    expect(firstAnimation?.cancel).toHaveBeenCalled()
  })

  it('crossfades incompatible paths and removes exit ghosts after completion', async () => {
    const diagnostics: MotionDiagnostics[] = []
    renderPath('M0 0L10 10', 'idle', (value) => diagnostics.push(value))
    renderPath('M0 2C3 4 7 8 10 12', 'idle', (value) => diagnostics.push(value))
    await flushMotion()

    expect(diagnostics.at(-1)).toMatchObject({ strategy: 'crossfade', animatedMarks: 1 })
    expect(container.querySelector('[data-shiftcharts-motion-ghost]')).not.toBeNull()

    renderPath(null)
    await flushMotion()
    expect(container.querySelector('[data-shiftcharts-motion-ghost]')).not.toBeNull()
    await finishMotion()
    expect(container.querySelector('[data-shiftcharts-motion-ghost]')).toBeNull()
  })

  it('does not install imperative motion when reduced motion is requested', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    })
    renderPath('M0 0L10 10')
    renderPath('M0 2L10 12')
    await flushMotion()

    expect(animate).not.toHaveBeenCalled()
    expect(container.querySelector('[data-shiftcharts-motion-ghost]')).toBeNull()
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M0 2L10 12')
  })
})
