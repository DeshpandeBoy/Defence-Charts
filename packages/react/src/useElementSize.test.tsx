/**
 * @vitest-environment jsdom
 */

/**
 * `useElementSize`, and gate **G11**'s node half.
 *
 * ⚠ **This is the one test file in the repository that asks for a DOM, and the ask is
 * narrow.** React only runs effects when a real renderer commits, and this hook is
 * *entirely* effect: the equality guard, the frame batching and the cleanup all live inside
 * one `useLayoutEffect` that `renderToStaticMarkup` will never call. Every other test file
 * here renders to a string and reads it with a regex precisely so that no DOM is needed;
 * this one cannot, because a string has no commit phase. jsdom is the permitted engine —
 * gate **G15** bans the other one, on the grounds that it returns `0` from measurement APIs
 * where jsdom throws, and a `0` is a chart that lays itself out as though every label were
 * empty.
 *
 * ⚠ **jsdom has no `ResizeObserver`, and that is a feature of this arrangement rather than
 * a gap in it.** Nothing here waits for a resize to happen; `FakeResizeObserver` is injected
 * through `createObserver` and every measurement in this file is one the test *caused*.
 * `research/30-implementation-plan.md` A5 is blunt about the alternative: a stub that never
 * fires while still passing `typeof === 'function'` produces a component that takes the
 * adaptive path, never receives a measurement, renders its fallback forever, and goes green.
 *
 * ## What the G11 half below actually proves, and what it cannot
 *
 * The containment loop is a *feedback* bug: content changes the box, the box re-plans the
 * content. Node has no layout, so no test here can produce the browser's
 * `"ResizeObserver loop completed with undelivered notifications"` — only the half of G11
 * that drives a real browser can, and it is a separate script.
 *
 * What node *can* prove is the property that makes the loop terminate when it does start:
 * ⚠ **a re-delivered box must produce no work.** The sweep in the last block below drives
 * every rung boundary in the ladder, delivers each size twice, and asserts the render count
 * equals the number of *distinct* sizes. Delete `sameSize()` from the hook and that count
 * doubles — which is the loop, one step of it, caught without a browser.
 */

import { FakeResizeObserver } from '@shiftcharts/testing'
import { act, useRef, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CreateObserver, Size, UseElementSizeOptions } from './useElementSize.ts'
import { useElementSize } from './useElementSize.ts'

// --- Harness -----------------------------------------------------------------------------

/**
 * ⚠ React refuses to run `act()` without this, and it is set per-file rather than in a
 * shared setup file so that no other test file acquires it by accident. A test that renders
 * to a string has no act environment and should not be told it has one.
 */
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // ⚠ rAF and cAF only — `vitest.config.ts` fakes exactly those two, so the frame-batched
  // path below is stepped rather than waited on, and `Date` keeps moving.
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

type Probe = {
  /** Every size the hook has reported, in order, one entry per render. */
  readonly sizes: Size[]
  /** The observer the hook built. Present once the effect has run. */
  observer: FakeResizeObserver | null
}

/**
 * Mounts the hook and hands back a probe.
 *
 * ⚠ The render count is `sizes.length` rather than a separate counter, because those two
 * can only disagree if the component body stopped calling the hook — and then the count
 * being asserted would not be the hook's.
 */
function mount(options: Omit<UseElementSizeOptions, 'createObserver'> = {}): Probe {
  const probe: Probe = { sizes: [], observer: null }

  const createObserver: CreateObserver = (callback) => {
    const observer = new FakeResizeObserver(callback)
    probe.observer = observer
    return observer
  }

  function Subject(): ReactNode {
    const [ref, size] = useElementSize<HTMLDivElement>({ ...options, createObserver })
    // ⚠ Pushed during render, not in an effect. An effect would report the size one commit
    // late, so a test asserting "no re-render happened" would be reading a stale array and
    // would pass for the wrong reason.
    probe.sizes.push(size)
    return <div ref={ref} />
  }

  act(() => root.render(<Subject />))
  return probe
}

/** The size the hook is currently reporting. */
function current(probe: Probe): Size {
  const last = probe.sizes[probe.sizes.length - 1]
  if (last === undefined) throw new Error('the subject never rendered')
  return last
}

/**
 * How many *different* size objects the hook has produced.
 *
 * ⚠ **The render count is the wrong thing to assert here, and finding that out is worth
 * writing down.** When `setSize`'s updater returns the previous value, React bails out — but
 * the documented bailout still *"may render that component again before bailing"*, so a
 * no-op delivery costs one extra pass through the component body and the raw render count
 * doubles under the sweep below. Asserting on it would fail against a hook that is behaving
 * exactly as intended.
 *
 * Identity is what actually terminates the loop. `<AutoChart>` memoises `ctx` on the two
 * numbers, `plan` on `ctx`, and `<Chart>` memoises its frame on `plan` — so an unchanged
 * size object means an unchanged frame, means byte-identical markup, means no layout change,
 * means no new measurement. An extra React pass that produces the same output is free; a new
 * size object is not.
 */
function distinctSizes(probe: Probe): number {
  let count = 0
  let previous: Size | undefined
  for (const size of probe.sizes) {
    if (size !== previous) {
      count += 1
      previous = size
    }
  }
  return count
}

/** Drives one measurement and lets the frame-batched path land. */
function resize(probe: Probe, width: number, height: number): void {
  act(() => {
    probe.observer?.emit(width, height)
    vi.advanceTimersToNextFrame()
  })
}

// --- Before anything is measured ---------------------------------------------------------

describe('what the hook reports before a measurement exists', () => {
  it('reports zero when nothing was declared', () => {
    const probe = mount()
    expect(probe.sizes[0]).toEqual({ width: 0, height: 0 })
  })

  it('reports the declared initial size, so a server render is a real chart', () => {
    const probe = mount({ initialSize: { width: 640, height: 360 } })
    expect(probe.sizes[0]).toEqual({ width: 640, height: 360 })
  })

  it('observes the element the ref was attached to, exactly once', () => {
    const probe = mount()
    expect(probe.observer?.observedCount).toBe(1)
  })

  it('reports the declared size forever when no observer can be built', () => {
    // ⚠ `createObserver` omitted *and* jsdom has no `ResizeObserver`, which is the engine
    // this hook must degrade on rather than throw on. A static chart at a declared size is
    // a legible outcome; the failure being avoided is the adaptive path that never gets
    // told the size and renders a fallback that looks deliberate.
    const sizes: Size[] = []
    function Subject(): ReactNode {
      const [ref, size] = useElementSize<HTMLDivElement>({
        initialSize: { width: 300, height: 150 },
      })
      sizes.push(size)
      return <div ref={ref} />
    }
    expect(() => act(() => root.render(<Subject />))).not.toThrow()
    expect(sizes[sizes.length - 1]).toEqual({ width: 300, height: 150 })
  })
})

// --- The first delivery, and why it is not deferred ---------------------------------------

describe('the first delivery lands without waiting for a frame', () => {
  it('reports the measured box before any frame has been advanced', () => {
    const probe = mount()
    // ⚠ No `advanceTimersToNextFrame()`. A real observer's initial notification arrives
    // after layout and *before paint*, so with `useLayoutEffect` the first painted frame is
    // already correct. Deferring it to rAF would push it past the paint and reintroduce the
    // flash of a wrong rung — a Micro chart drawing a single number, then jumping.
    act(() => probe.observer?.emit(820, 400))
    expect(current(probe)).toEqual({ width: 820, height: 400 })
  })

  it('leaves the declared initial size in place until that first delivery', () => {
    const probe = mount({ initialSize: { width: 640, height: 360 } })
    expect(probe.sizes).toHaveLength(1)
    expect(current(probe)).toEqual({ width: 640, height: 360 })
  })
})

// --- Which box is read --------------------------------------------------------------------

describe('the untransformed content box is what gets read', () => {
  it('prefers contentBoxSize', () => {
    const probe = mount()
    act(() => probe.observer?.emit(500, 250))
    expect(current(probe)).toEqual({ width: 500, height: 250 })
  })

  it('falls back to contentRect on an engine that omits contentBoxSize', () => {
    const probe = mount()
    act(() => probe.observer?.emit(500, 250, { legacy: true }))
    expect(current(probe)).toEqual({ width: 500, height: 250 })
  })

  it('reads contentBoxSize even when contentRect disagrees with it', () => {
    // ⚠ The one case the fake cannot stage, because it derives `contentRect` from the same
    // numbers on purpose — so the disagreement is staged by hand here. A real browser
    // produces exactly this under a CSS `scale()`: `contentRect` reports the *transformed*
    // box, so a widget in a dashboard zoom or a print preview measures at its apparent size
    // and gets planned for a rung it does not occupy. 400 is the rung; 200 is the illusion.
    const sizes: Size[] = []
    function Subject(): ReactNode {
      const [ref, size] = useElementSize<HTMLDivElement>({
        createObserver: (callback) => {
          callback([
            {
              contentBoxSize: [{ inlineSize: 400, blockSize: 300 }],
              contentRect: { width: 200, height: 150 },
            },
          ])
          return { observe: () => {}, disconnect: () => {} }
        },
      })
      sizes.push(size)
      return <div ref={ref} />
    }
    act(() => root.render(<Subject />))
    expect(sizes[sizes.length - 1]).toEqual({ width: 400, height: 300 })
  })
})

// --- Every later delivery is batched ------------------------------------------------------

describe('deliveries after the first are coalesced onto one frame', () => {
  it('does not commit the second measurement inside the observer callback', () => {
    const probe = mount()
    act(() => probe.observer?.emit(820, 400))
    const before = probe.sizes.length

    // ⚠ Committing a layout change synchronously while the browser is still delivering
    // notifications for the same pass is the route to "undelivered notifications". This
    // asserts the write moved out of the pass: the size is emitted, and nothing renders.
    act(() => probe.observer?.emit(600, 300))
    expect(probe.sizes).toHaveLength(before)
    expect(current(probe)).toEqual({ width: 820, height: 400 })

    act(() => vi.advanceTimersToNextFrame())
    expect(current(probe)).toEqual({ width: 600, height: 300 })
  })

  it('lets the last size in a burst win, and renders once for the whole burst', () => {
    const probe = mount()
    act(() => probe.observer?.emit(820, 400))
    const before = probe.sizes.length

    // A drag delivers many sizes; only the box the pointer stopped at is a box anyone saw.
    act(() => {
      probe.observer?.emit(700, 350)
      probe.observer?.emit(650, 320)
      probe.observer?.emit(610, 300)
      vi.advanceTimersToNextFrame()
    })

    expect(current(probe)).toEqual({ width: 610, height: 300 })
    expect(probe.sizes.length - before).toBe(1)
  })

  it('drops a pending frame on unmount rather than committing after it', () => {
    // ⚠ A frame left pending past unmount holds the entry, the element and the observer
    // alive until it fires. In a dashboard that mounts and unmounts widgets on scroll that
    // is a leak with a heartbeat, and `setSize` on an unmounted tree is the visible symptom.
    const probe = mount()
    act(() => probe.observer?.emit(820, 400))
    const before = probe.sizes.length

    act(() => probe.observer?.emit(600, 300))
    act(() => root.unmount())
    act(() => vi.advanceTimersToNextFrame())

    expect(probe.sizes).toHaveLength(before)
    // Re-created so `afterEach`'s unmount has something to unmount.
    root = createRoot(container)
  })

  it('disconnects the observer on unmount', () => {
    const probe = mount()
    act(() => root.unmount())
    expect(probe.observer?.observedCount).toBe(0)
    root = createRoot(container)
  })
})

// --- The observer is built once -----------------------------------------------------------

describe('the observer survives re-renders', () => {
  it('is not torn down and rebuilt when the parent re-renders', () => {
    // ⚠ `createObserver` is read through a ref inside the effect rather than listed as a
    // dependency. In the dependency array, a consumer's inline arrow is a new function every
    // render, so the observer is rebuilt every render — and rebuilding re-fires the initial
    // delivery, which re-renders. That is the containment loop arriving through the
    // dependency array, and this asserts the door is shut: one observer, ever.
    let built = 0
    function Subject({ tick }: { tick: number }): ReactNode {
      const [ref] = useElementSize<HTMLDivElement>({
        createObserver: (callback) => {
          built += 1
          return new FakeResizeObserver(callback)
        },
      })
      const seen = useRef(0)
      seen.current = tick
      return <div ref={ref} />
    }

    act(() => root.render(<Subject tick={1} />))
    act(() => root.render(<Subject tick={2} />))
    act(() => root.render(<Subject tick={3} />))

    expect(built).toBe(1)
  })
})

// --- Gate G11, node half -------------------------------------------------------------------

describe('gate G11 — a re-delivered box does no work', () => {
  it('produces no new size when the same box arrives twice', () => {
    const probe = mount()
    act(() => probe.observer?.emit(820, 400))
    const before = distinctSizes(probe)

    resize(probe, 820, 400)
    resize(probe, 820, 400)

    // ⚠ The single most load-bearing assertion in the file. `setSize({ width, height })`
    // with numerically identical values still allocates a new object, and a new object is a
    // new state, and a new state is a re-render that builds a new plan and a new frame. The
    // loop does not need the box to change — object identity alone is enough to spin it.
    expect(distinctSizes(probe)).toBe(before)
  })

  it('keeps the reported size object identical across a re-delivery', () => {
    const probe = mount()
    act(() => probe.observer?.emit(820, 400))
    const first = current(probe)
    resize(probe, 820, 400)
    // Identity, not equality: `<Chart>` memoises its frame on `ctx` identity, and `ctx` is
    // memoised on these two numbers. A new object here rebuilds six path strings for a box
    // that did not move.
    expect(current(probe)).toBe(first)
  })

  it('reaches a fixed point across a shrinking sweep of every rung boundary', () => {
    // Every published plot-height result the ladder is anchored to, plus the grid-cell
    // boundaries between families, walked downward the way a drag walks them.
    const sweep: readonly (readonly [number, number])[] = [
      [960, 640], // Stage   — 9 × 6 cells
      [640, 520], // Canvas  — 6 × 5
      [420, 320], // Panel   — 3 × 3
      [340, 120], // Strip   — 3 × 1
      [240, 88], //  Tile    — 2 × 1
      [240, 80], //  saturation
      [200, 40], //  Heer & Bostock 2010, p<0.001
      [120, 24], //  Heer 2009, optimal for line
      [62, 6], //    horizon floor
    ]

    const probe = mount()
    act(() => probe.observer?.emit(1200, 800))
    const before = distinctSizes(probe)

    for (const [width, height] of sweep) {
      resize(probe, width, height)
      // ⚠ Delivered twice, every step. A real observer re-delivers an unchanged box on any
      // layout pass the widget did not cause — a sibling growing, a font loading, a
      // scrollbar appearing elsewhere on the page. The second delivery must cost nothing,
      // or every one of those becomes a re-plan.
      resize(probe, width, height)
      expect(current(probe)).toEqual({ width, height })
    }

    // One size per *distinct* box. Delete `sameSize()` from the hook and this is 18.
    expect(distinctSizes(probe) - before).toBe(sweep.length)
  })

  it('settles rather than oscillating when a box alternates and then holds', () => {
    // The shape of a scrollbar flicker: the box bounces between two values and then stops.
    // What matters is that "stops" is observable — that the last delivery is the last size.
    const probe = mount()
    act(() => probe.observer?.emit(400, 300))

    resize(probe, 385, 300)
    resize(probe, 400, 300)
    resize(probe, 385, 300)
    resize(probe, 400, 300)
    const settled = distinctSizes(probe)

    resize(probe, 400, 300)
    resize(probe, 400, 300)
    resize(probe, 400, 300)

    expect(distinctSizes(probe)).toBe(settled)
    expect(current(probe)).toEqual({ width: 400, height: 300 })
  })
})
