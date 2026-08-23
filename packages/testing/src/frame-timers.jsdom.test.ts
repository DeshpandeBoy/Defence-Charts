// @vitest-environment jsdom

/**
 * Frame control, asserted where frames exist.
 *
 * ⚠ The directive is on line 1, which is also this file's second job: it exercises the
 * one placement gate **G15** permits, so `check-determinism.mjs` is proven not to reject
 * legitimate use. A gate that only ever says no has not been tested either.
 *
 * ⚠ jsdom, never happy-dom. On the measurement APIs `@gx/core` may not call, jsdom throws
 * and happy-dom returns `0` — a throw is a failing test, a `0` is a chart laid out as
 * though every label were empty. `scripts/check-determinism.mjs` G8.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

describe('fake timers fake frames and nothing else', () => {
  it('fakes requestAnimationFrame', () => {
    // Animation staging — axis first, marks second (43-theming.md §7) — is the one thing
    // that genuinely needs frame control, so it is the one thing faked.
    vi.useFakeTimers()
    let frames = 0
    requestAnimationFrame(() => {
      frames += 1
    })
    expect(frames).toBe(0)
    vi.advanceTimersByTime(20)
    expect(frames).toBe(1)
  })

  it('leaves Date real even with a DOM present', async () => {
    vi.useFakeTimers()
    const before = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 12))
    expect(Date.now()).toBeGreaterThan(before)
  })

  it('still reports UTC inside the DOM environment', () => {
    // ⚠ `test.env` and the jsdom environment are configured separately, so the clock
    // setting has to be re-proven here rather than assumed to carry over.
    expect(new Date('2026-08-23T00:00:00Z').getTimezoneOffset()).toBe(0)
  })
})

describe('jsdom is the permitted shim because it throws', () => {
  it('refuses getBBox rather than returning zero', () => {
    // ⚠ THE WHOLE ARGUMENT FOR THE BAN, executed rather than asserted from memory.
    // happy-dom answers this call with a zero-sized box. jsdom does not implement it at
    // all. Only one of those makes a resolver that measures the DOM a *failing* test.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    expect(() => (svg as unknown as SVGGraphicsElement).getBBox()).toThrow()
  })

  it('refuses getComputedTextLength rather than returning zero', () => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.textContent = 'a label wide enough to collide'
    expect(() => (text as SVGTextContentElement).getComputedTextLength()).toThrow()
  })
})
