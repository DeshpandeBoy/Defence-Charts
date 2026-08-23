/**
 * The fake, driven the way a real consumer drives the real thing.
 *
 * ⚠ **The bug this file was written against was invisible in output.** `FakeResizeObserver`
 * emitted only `contentRect`, and every consumer in the repo reads `contentBoxSize[0]` first
 * and falls back to `contentRect` — so a fake-driven test exercised the fallback branch and
 * nothing else, forever, greenly, while the branch a browser actually takes was never once
 * evaluated. The assertions below are therefore about *which field carried the number*, not
 * merely about the number, because only the first of those two questions could ever have
 * caught it.
 *
 * ⚠ `readSize()` restates the consumer's read order rather than importing it.
 * `apps/playground/src/useElementSize.ts` is a React hook and `@gx/react`'s `useElementSize`
 * lands at **A5**; importing either would give this file a DOM and a package dependency it
 * must not have, and would make the test circular besides — a hook reading the wrong field
 * and a fake emitting the wrong field agree with each other, and agree greenly. Six lines of
 * duplication buy an independent statement of the contract.
 *
 * ⚠ No DOM here and none wanted: `observe()` takes `object`, so the observed "elements"
 * below are bare object literals and this file runs at the repo-default Node environment
 * alongside `determinism.test.ts`. That is also what keeps gate **G16** quiet — the per-file
 * environment directive is matched by a regex over the whole file, prose included, so the
 * cheapest way never to trip it is never to need it.
 */

import { describe, expect, it, vi } from 'vitest'

import type { FakeResizeObserverEntry } from './index.ts'
import { FakeResizeObserver } from './index.ts'

/**
 * The read every real consumer performs: `contentBoxSize[0]` first, `contentRect` only when
 * it is absent. `contentRect` reports the *transformed* box, so a widget inside a CSS
 * `scale()` measures at its apparent size and gets planned for a rung it does not occupy.
 */
function readSize(entry: FakeResizeObserverEntry): { width: number; height: number; via: string } {
  const box = entry.contentBoxSize?.[0]
  if (box !== undefined) {
    return { width: box.inlineSize, height: box.blockSize, via: 'contentBoxSize' }
  }
  return { width: entry.contentRect.width, height: entry.contentRect.height, via: 'contentRect' }
}

/**
 * An observer already watching `targets`, with its emissions recorded.
 *
 * `entry(batch, index)` throws rather than returning `undefined` so that a batch which never
 * arrived fails at the line that expected it, instead of turning into an `?.` chain whose
 * every assertion silently compares `undefined` against `undefined`.
 */
function observing(...targets: readonly object[]): {
  observer: FakeResizeObserver
  batches: (readonly FakeResizeObserverEntry[])[]
  entry: (batch?: number, index?: number) => FakeResizeObserverEntry
} {
  const batches: (readonly FakeResizeObserverEntry[])[] = []
  const observer = new FakeResizeObserver((entries) => batches.push(entries))
  for (const target of targets) observer.observe(target)

  const entry = (batch = 0, index = 0): FakeResizeObserverEntry => {
    const found = batches[batch]?.[index]
    if (found === undefined) {
      throw new Error(
        `no entry at batch ${String(batch)} index ${String(index)} — ` +
          `${String(batches.length)} batch(es) were delivered`,
      )
    }
    return found
  }

  return { observer, batches, entry }
}

describe('the emitted entry carries the untransformed content box', () => {
  it('reports inlineSize and blockSize as emitted', () => {
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(320, 180)

    expect(entry().contentBoxSize?.[0]).toEqual({ inlineSize: 320, blockSize: 180 })
  })

  it('exposes exactly one content box, as a single-fragment element does', () => {
    // ⚠ The spec makes `contentBoxSize` a list because a fragmented element — multicol —
    // reports one box per fragment. Nothing this library observes is fragmented, so a
    // second box appearing here would mean the fake had invented a shape no consumer is
    // written for: `[0]` is what everything reads, unguarded past the `undefined` check.
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(640, 400)

    expect(entry().contentBoxSize).toHaveLength(1)
  })

  it('derives contentRect from the same numbers as contentBoxSize', () => {
    // The two agreeing is the invariant. A fake able to report two sizes at once is a fake
    // able to make a test pass for the wrong reason.
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(512, 288)

    expect(entry().contentRect).toEqual({ width: 512, height: 288 })
    expect(entry().contentBoxSize?.[0]?.inlineSize).toBe(entry().contentRect.width)
    expect(entry().contentBoxSize?.[0]?.blockSize).toBe(entry().contentRect.height)
  })

  it('sends a contentBoxSize-first consumer down its preferred branch', () => {
    // ⚠ THE REGRESSION TEST. Before A5 this would have reported `contentRect` without
    // anyone intending it to, because the fallback was the only branch reachable at all.
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(240, 160)

    expect(readSize(entry())).toEqual({ width: 240, height: 160, via: 'contentBoxSize' })
  })

  it('fires only when emit is called, never on observe', () => {
    // The real one fires when the browser decides to; a test that awaits that flakes.
    const callback = vi.fn()
    const observer = new FakeResizeObserver(callback)
    observer.observe({ id: 'widget' })
    expect(callback).not.toHaveBeenCalled()

    observer.emit(100, 100)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('the legacy path stays reachable, and only on request', () => {
  it('omits contentBoxSize entirely rather than emitting an empty array', () => {
    // ⚠ Absent, not `[]`. An empty array is truthy and has a `.length`, so a consumer
    // written as `entry.contentBoxSize.length > 0 ? … : …` would still behave; one written
    // as `entry.contentBoxSize[0]` — the read that actually ships — would not. Only true
    // absence reproduces what Safari before 15.4 and a `contentRect`-only polyfill hand you.
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(320, 180, { legacy: true })

    expect(Object.hasOwn(entry(), 'contentBoxSize')).toBe(false)
    expect(entry().contentBoxSize).toBeUndefined()
  })

  it('still reports contentRect, so the fallback has something to read', () => {
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(320, 180, { legacy: true })

    expect(entry().contentRect).toEqual({ width: 320, height: 180 })
  })

  it('sends a contentBoxSize-first consumer down its fallback branch', () => {
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(320, 180, { legacy: true })

    expect(readSize(entry())).toEqual({ width: 320, height: 180, via: 'contentRect' })
  })

  it('agrees with the modern path on the numbers, differing only in the field', () => {
    // Same size, two shapes — and the shape is the only difference a consumer may observe.
    const { observer, entry } = observing({ id: 'widget' })
    observer.emit(456, 123)
    observer.emit(456, 123, { legacy: true })

    const modern = readSize(entry(0))
    const legacy = readSize(entry(1))
    expect(legacy.width).toBe(modern.width)
    expect(legacy.height).toBe(modern.height)
    expect(legacy.via).not.toBe(modern.via)
  })
})

describe('emit delivers to what is observed', () => {
  it('names the observed object on every entry', () => {
    const widget = { id: 'widget' }
    const { observer, entry } = observing(widget)
    observer.emit(300, 200)

    expect(entry().target).toBe(widget)
  })

  it('fans out one entry per observed target when none is named', () => {
    const first = { id: 'first' }
    const second = { id: 'second' }
    const third = { id: 'third' }
    const { observer, batches } = observing(first, second, third)
    observer.emit(300, 200)

    // Order is `observe()` order, so a multi-widget assertion can be written positionally.
    expect(batches[0]?.map((delivered) => delivered.target)).toEqual([first, second, third])
  })

  it('delivers a single entry for a named target', () => {
    const first = { id: 'first' }
    const second = { id: 'second' }
    const { observer, batches, entry } = observing(first, second)
    observer.emit(300, 200, { target: second })

    expect(batches[0]).toHaveLength(1)
    expect(entry().target).toBe(second)
  })

  it('lets two observed targets hold different sizes', () => {
    // The reason per-target emission exists at all: one observer, two widgets, two rungs.
    const small = { id: 'small' }
    const large = { id: 'large' }
    const { observer, entry } = observing(small, large)
    observer.emit(320, 180, { target: small })
    observer.emit(1280, 720, { target: large })

    expect(entry(0).contentBoxSize?.[0]).toEqual({ inlineSize: 320, blockSize: 180 })
    expect(entry(1).contentBoxSize?.[0]).toEqual({ inlineSize: 1280, blockSize: 720 })
  })

  it('throws rather than silently delivering nothing for an unobserved target', () => {
    // ⚠ A real ResizeObserver is silent here, and the silence is the failure mode: the
    // callback never fires, the component is never measured, and an assertion of the form
    // "the plan never went wrong" passes against a chart that was never planned.
    const { observer } = observing({ id: 'widget' })

    expect(() => {
      observer.emit(300, 200, { target: { id: 'never-observed' } })
    }).toThrow(/not observed/)
  })

  it('throws when nothing is observed at all', () => {
    const observer = new FakeResizeObserver(() => undefined)

    expect(() => {
      observer.emit(300, 200)
    }).toThrow(/nothing is observed/)
  })

  it('stops delivering to a target once it is unobserved', () => {
    const gone = { id: 'gone' }
    const kept = { id: 'kept' }
    const { observer, batches } = observing(gone, kept)
    observer.unobserve(gone)
    observer.emit(300, 200)

    expect(batches[0]?.map((delivered) => delivered.target)).toEqual([kept])
  })
})

describe('observedCount tracks the registration set', () => {
  it('starts at zero', () => {
    expect(new FakeResizeObserver(() => undefined).observedCount).toBe(0)
  })

  it('counts each observed target once', () => {
    const { observer } = observing({ id: 'a' }, { id: 'b' }, { id: 'c' })

    expect(observer.observedCount).toBe(3)
  })

  it('ignores a repeated observe of the same target', () => {
    // The real one replaces the existing observation rather than adding a second, so a
    // widget observed twice by a double-invoked effect must not get two entries per resize.
    const widget = { id: 'widget' }
    const { observer } = observing(widget)
    observer.observe(widget)

    expect(observer.observedCount).toBe(1)
  })

  it('drops one on unobserve', () => {
    const gone = { id: 'gone' }
    const { observer } = observing(gone, { id: 'kept' })
    observer.unobserve(gone)

    expect(observer.observedCount).toBe(1)
  })

  it('ignores unobserve of a target that was never observed', () => {
    const { observer } = observing({ id: 'a' }, { id: 'b' })
    observer.unobserve({ id: 'stranger' })

    expect(observer.observedCount).toBe(2)
  })

  it('falls to zero on disconnect', () => {
    // ⚠ The assertion a cleanup test needs. After unmount there is nothing to emit *to*,
    // which is why `emit()` throws on an empty set rather than reporting a phantom resize.
    const { observer } = observing({ id: 'a' }, { id: 'b' }, { id: 'c' })
    observer.disconnect()

    expect(observer.observedCount).toBe(0)
  })
})
