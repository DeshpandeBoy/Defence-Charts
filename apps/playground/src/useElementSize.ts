import type { RefObject } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

export type Size = { readonly width: number; readonly height: number }

/**
 * Content-box size of a DOM element, tracked with a `ResizeObserver`.
 *
 * ⚠ This lives in the playground rather than in `@gx/core` because it is the one thing the
 * resolver must never do. `@gx/core` is banned from the DOM by gate **G2** so that
 * `planChart()` can run on a server; measuring the container is the *app's* job, and the
 * plan is a pure function of the number that measurement produces. The seam is here.
 *
 * ⚠ A near-identical hook lands in `@gx/react` as `useElementSize` at **A5**, with the
 * containment work that this one deliberately does not attempt: the reason
 * `research/raw/05-theory-responsive-viz.md` calls containment *"a validity constraint for
 * the `ChartPlan` type"* is that a plan whose content changes the measured box feeds its
 * own observer, and the browser cuts the loop with a console error rather than a crash —
 * a thing that looks like it works and quietly doesn't. Nothing here draws into the
 * observed element yet, so the loop cannot form; when it can, A5's CI test is what proves
 * it doesn't.
 */
export function useElementSize<T extends Element>(): readonly [RefObject<T | null>, Size] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return

      // ⚠ `contentBoxSize` first, `contentRect` only as a fallback. `contentRect` reports
      // the *transformed* box, so a widget inside a `scale()` — a dashboard zoom control,
      // a print preview — would be measured at its apparent size and planned for a rung it
      // does not occupy.
      const box = entry.contentBoxSize[0]
      if (box !== undefined) {
        setSize({ width: box.inlineSize, height: box.blockSize })
        return
      }
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })

    observer.observe(element, { box: 'content-box' })
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, size] as const
}
