/**
 * The determinism preconditions, asserted against the **resolved** environment.
 *
 * ⚠ `vitest.config.ts` sets these. This file proves they took. The distinction matters
 * more than it sounds: a config key that is misspelled, moved between major versions, or
 * silently overridden by a project-level config produces exactly the same green run as a
 * config key that works. Every assertion below is observable behaviour, not a re-read of
 * the setting that produced it.
 *
 * `research/30-implementation-plan.md` A1.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

describe('the clock is UTC', () => {
  it('reports a zero offset', () => {
    // ⚠ Without this, tick formatting is a function of the machine that ran the test. A
    // time-axis snapshot taken in IST and replayed in CI under UTC differs by a rung, and
    // the diff blames the resolver.
    expect(new Date('2026-08-23T00:00:00Z').getTimezoneOffset()).toBe(0)
  })

  it('resolves Intl to UTC as well', () => {
    // `TZ` and Intl's resolved zone can disagree if the zone is set after ICU has cached.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
  })

  it('formats a boundary instant without a local-midnight shift', () => {
    const iso = new Date('2026-01-01T00:00:00Z').toISOString()
    expect(iso).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('fake timers fake frames and nothing else', () => {
  it('leaves Date real', async () => {
    // ⚠ The reflex is `vi.useFakeTimers()` with everything faked. Faking Date makes every
    // time-axis test assert against a clock that does not move — the axis agrees with
    // itself and with nothing else.
    vi.useFakeTimers()
    const before = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 12))
    expect(Date.now()).toBeGreaterThan(before)
  })

  it('leaves setTimeout real', async () => {
    // If setTimeout were faked, the await above would never settle and this file would
    // time out rather than fail — so assert the capability directly too.
    vi.useFakeTimers()
    const settled = await new Promise((resolve) => {
      setTimeout(() => resolve('real'), 1)
    })
    expect(settled).toBe('real')
  })

  it('has no frames to fake in a DOM-less environment', () => {
    // ⚠ Node ships no global `requestAnimationFrame`, and fake timers replace globals
    // rather than inventing them — so `toFake` is **inert here**, not merely unused. It
    // is still the correct setting, because it governs the DOM tests where frames do
    // exist. The proof that it takes effect lives in `frame-timers.jsdom.test.ts`; this
    // assertion exists so that a future Node adding a global rAF is a failing test rather
    // than a silent change of meaning.
    vi.useFakeTimers()
    expect(globalThis.requestAnimationFrame).toBeUndefined()
  })
})

describe('the default environment has no DOM', () => {
  it('exposes no document', () => {
    // ⚠ Gate **G2** bans DOM measurement in `@shiftcharts/core`. Handing core's tests a DOM gives
    // them the ability to violate the rule the gate exists to enforce, and the violation
    // would pass. Files that genuinely need one opt in per-file with the environment
    // docblock — see `scripts/check-determinism.mjs` for why the phrase is not spelled
    // out here.
    expect(globalThis.document).toBeUndefined()
  })

  it('exposes no ResizeObserver, so a test must inject the fake', () => {
    // `@shiftcharts/testing` hands out a FakeResizeObserver rather than assigning to globalThis.
    // A leaked stub makes one file's failure surface in another — the slowest bug to
    // locate, because the failing test is not the broken one.
    expect(globalThis.ResizeObserver).toBeUndefined()
  })
})
