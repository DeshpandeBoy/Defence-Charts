/**
 * `useElementSize` — the seam where the DOM enters this library, and the only one.
 *
 * ⚠ **This is the counterpart to gate G2, not an exception to it.** `@gx/core` is banned
 * from every DOM measurement API, with `"types": []` in its tsconfig so the lib is not even
 * in scope, because a resolver that measures cannot run on a server. That ban is only
 * coherent if *something* measures, and this is that something. The plan is a pure function
 * of the two numbers this hook produces; everything upstream of these two numbers is the
 * app's problem, and everything downstream is testable without a browser.
 *
 * ## The containment loop, and the three things done about it
 *
 * `research/raw/05-theory-responsive-viz.md` calls containment *"a validity constraint for
 * the `ChartPlan` type"*: a plan whose content changes the size of the box being measured
 * feeds its own observer. The browser does not crash on that — it cuts the delivery and
 * writes `"ResizeObserver loop completed with undelivered notifications"` to the console.
 * Nothing visible breaks. It is the project's recurring failure species with a chart
 * attached, and `research/30-implementation-plan.md` is explicit that *"a deadband cannot
 * fix this class of bug — only structure can."*
 *
 * Three structural things here, in order of how much they matter:
 *
 *   1. ⚠ **The equality guard.** `setSize({ width, height })` with numerically identical
 *      values still allocates a new object, and a new object is a new state, and a new
 *      state is a re-render that produces a new plan object that produces a new frame. The
 *      loop does not need the box to actually change — object identity is enough to spin
 *      it. `sameSize()` below is the thing that stops it, and it is the single most
 *      load-bearing line in the file.
 *   2. ⚠ **Every measurement after the first is written on an animation frame**, not
 *      inside the observer's own delivery pass. React committing a layout change
 *      synchronously while the browser is still delivering notifications for that pass is
 *      the route to *"undelivered notifications"*; deferring the write moves it out of the
 *      pass entirely. See the note on the first delivery below for why the first one is
 *      deliberately not deferred.
 *   3. ⚠ **`contentBoxSize` before `contentRect`.** `contentRect` reports the
 *      *transformed* box, so a widget inside a CSS `scale()` — a dashboard zoom control, a
 *      print preview — is measured at its apparent size and planned for a rung it does not
 *      occupy. `contentRect` is kept only as a fallback for engines that do not implement
 *      `contentBoxSize`, and it is a fallback rather than a co-equal.
 *
 * None of that is proof. The proof is gate **G11**: a fake-driven shrinking sweep asserting
 * the reported box reaches a fixed point, and a real browser driven across every rung
 * boundary asserting the loop error never fires. The fake cannot produce the loop error, so
 * both halves are needed and neither is sufficient.
 *
 * ## Why the first delivery is synchronous and the rest are not
 *
 * A `ResizeObserver` fires an initial notification for every element it starts observing,
 * and the spec delivers it in the *"update the rendering"* steps — after layout, **before
 * paint**. Combined with `useLayoutEffect`, that means the real size is known before the
 * browser has painted anything, and the first frame is correct. Deferring that first
 * delivery to `requestAnimationFrame` would push it past the paint and reintroduce exactly
 * the flash-of-wrong-rung that the SSR `initialSize` prop exists to prevent — the chart
 * would paint once at 0 × 0 (a Micro rung, drawing a single number) and then jump.
 *
 * So: the first measurement is written straight through, and every subsequent one is
 * batched. The asymmetry is deliberate and is the reason `#first` exists.
 *
 * ## Why the observer is injected
 *
 * ⚠ `research/30-implementation-plan.md` A5 is emphatic: *"happy-dom's built-in is a no-op
 * stub that never fires while still passing `typeof === 'function'`"* — a component that
 * feature-detects it takes the adaptive path, never receives a measurement, renders its
 * fallback forever, and goes green. Tests must **drive** resize, never wait for it.
 *
 * `createObserver` is how they drive it, and it is a parameter rather than a `globalThis`
 * patch because a leaked `ResizeObserver` stub makes one test file's failure surface in
 * another file, which is the slowest class of bug to locate. `vitest.config.ts`'s
 * `restoreMocks` + `unstubGlobals` are the belt; this is the braces.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export type Size = { readonly width: number; readonly height: number }

/**
 * One box measurement, structurally.
 *
 * ⚠ Declared here rather than imported from `@gx/testing`, so that `@gx/react` carries no
 * dependency on the test package and the real `ResizeObserverEntry` satisfies it without a
 * cast. Both the DOM type and the fake are assignable to this; that is the whole job of the
 * type. `contentBoxSize` is optional because the fallback path is real — older engines
 * genuinely omit it — and marking it required would make the fallback unreachable code that
 * ships anyway.
 */
export type ObservedEntry = {
  readonly contentBoxSize?: readonly { readonly inlineSize: number; readonly blockSize: number }[]
  readonly contentRect: { readonly width: number; readonly height: number }
}

/** What `createObserver` must return: the two methods this hook actually calls. */
export type ElementObserver = {
  observe: (target: Element, options?: { box?: 'content-box' | 'border-box' }) => void
  disconnect: () => void
}

/**
 * Builds the observer. Defaults to the real one.
 *
 * A factory rather than a constructor type, because `@gx/testing`'s `FakeResizeObserver`
 * takes its callback positionally and a factory lets a test write
 * `(cb) => new FakeResizeObserver(cb)` without the two signatures having to agree.
 */
export type CreateObserver = (callback: (entries: readonly ObservedEntry[]) => void) => ElementObserver

export type UseElementSizeOptions = {
  /**
   * The size to report before anything has been measured.
   *
   * ⚠ **This is the SSR answer, and it is opt-in on purpose.** On a server there is no
   * `ResizeObserver` and no layout, so without it the first render reports `0 × 0` — which
   * `resolveSizeClass()` reads as *"not measured"* rather than as a real box, and which
   * `<AutoChart>` renders as nothing at all. Supplying a declared initial size makes the
   * server's HTML a correct chart for that size, so first paint is a chart rather than a
   * gap that fills in.
   *
   * Defaulting it to some plausible number instead would be worse than defaulting to
   * nothing: a wrong guess paints a chart at the wrong rung and then visibly re-plans,
   * which is the flash this exists to remove. Nothing is honest; a guess is not.
   *
   * ⚠ `| undefined` is spelled out, and the reason is `exactOptionalPropertyTypes`. See
   * `ChartProps` in `@gx/primitives` for the long version: a wrapper that received this
   * prop optionally cannot forward it without it, and `<AutoChart>` is that wrapper.
   */
  readonly initialSize?: Size | undefined
  /** Test seam. See the module docblock — injected, never patched onto `globalThis`. */
  readonly createObserver?: CreateObserver | undefined
}

const ZERO: Size = { width: 0, height: 0 }

/**
 * ⚠ The loop-breaker. Compares by value, so a re-delivery of an unchanged box does not
 * allocate a new state object and does not re-render. See the module docblock.
 */
function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height
}

/** `contentBoxSize` if the engine has it, `contentRect` if it does not. Never both. */
function readEntry(entry: ObservedEntry): Size {
  const box = entry.contentBoxSize?.[0]
  if (box !== undefined) return { width: box.inlineSize, height: box.blockSize }
  return { width: entry.contentRect.width, height: entry.contentRect.height }
}

/**
 * ⚠ `useLayoutEffect` in a `"use client"` component is still evaluated during SSR, where
 * React warns that it does nothing. `useEffect` on the server silences that without
 * changing any behaviour, because neither one runs there. Resolved once at module scope so
 * the hook call itself is unconditional.
 *
 * It has to be `useLayoutEffect` in the browser: `useEffect` runs *after* paint, so the
 * first painted frame would be the unmeasured one and the correction would be visible.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Content-box size of a DOM element.
 *
 * @returns A ref to attach to the element, and its current size. The size is
 *   `initialSize` (or `0 × 0`) until the first measurement lands.
 */
export function useElementSize<T extends Element>(
  options: UseElementSizeOptions = {},
): readonly [RefObject<T | null>, Size] {
  const { initialSize, createObserver } = options

  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>(initialSize ?? ZERO)

  // ⚠ Read through refs inside the effect rather than listed as dependencies. A consumer
  // writing `createObserver={(cb) => new ResizeObserver(cb)}` inline creates a new function
  // every render; in the dependency array that tears down and rebuilds the observer on
  // every render, and rebuilding an observer re-fires its initial delivery, which re-renders
  // — the loop again, arriving through the dependency array. The effect below runs once.
  const createObserverRef = useRef(createObserver)
  createObserverRef.current = createObserver

  const frame = useRef<number | null>(null)
  const first = useRef(true)

  const commit = useCallback((next: Size) => {
    setSize((prev) => (sameSize(prev, next) ? prev : next))
  }, [])

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (element === null) return

    // ⚠ Not a feature detection that silently degrades. If there is no `ResizeObserver`
    // the hook reports `initialSize` forever, which is a static chart at a declared size —
    // a legible outcome. The failure this avoids is the *other* one: taking an adaptive
    // path, never being told the size, and rendering a fallback that looks deliberate.
    const create =
      createObserverRef.current ??
      (typeof ResizeObserver === 'undefined'
        ? null
        : (cb: (entries: readonly ObservedEntry[]) => void) => new ResizeObserver(cb))
    if (create === null) return

    first.current = true

    const observer = create((entries) => {
      const entry = entries[entries.length - 1]
      if (entry === undefined) return
      const next = readEntry(entry)

      // The initial delivery, straight through: it arrives before the first paint, and
      // deferring it would put a wrong-rung frame on the screen. Module docblock.
      if (first.current) {
        first.current = false
        commit(next)
        return
      }

      // ⚠ Every later delivery is coalesced onto one frame, and it is the *last* size in a
      // burst that wins. Cancelling the pending frame rather than skipping the new value is
      // what makes that true — a drag delivers many sizes and only the final one is the box
      // the user stopped at.
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        commit(next)
      })
    })

    observer.observe(element, { box: 'content-box' })

    return () => {
      // ⚠ Cancel before disconnecting. A frame left pending past unmount calls `setSize` on
      // an unmounted component — harmless in React 19, but it also holds the entry, the
      // element and the observer alive until it fires, which in a dashboard that mounts and
      // unmounts widgets on scroll is a leak with a heartbeat.
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      observer.disconnect()
    }
  }, [commit])

  return [ref, size] as const
}
