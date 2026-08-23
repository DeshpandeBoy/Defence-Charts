/**
 * `@gx/testing` — dev-facing helpers. Plan snapshot matchers, a11y matchers, and our own
 * `FakeResizeObserver`.
 *
 * ⚠ The fake is **injected**, never patched onto `globalThis` and left there. That is
 * what `restoreMocks` + `unstubGlobals` in the Vitest config exist to protect: a leaked
 * `ResizeObserver` stub makes one test file's failure appear in another's, which is the
 * slowest kind of bug to find.
 *
 * ⚠ A1 scope: the `emit()` driver, which is the piece the ladder tests need first. It
 * carries no DOM dependency, so ladder tests run in bare Node.
 */

export interface FakeResizeObserverEntry {
  readonly contentRect: { readonly width: number; readonly height: number }
}

type Callback = (entries: readonly FakeResizeObserverEntry[]) => void

/**
 * A `ResizeObserver` you drive by hand.
 *
 * The real one fires when the browser decides to. A test that awaits that is a test that
 * flakes; `emit()` makes the timing explicit and the assertion deterministic.
 */
export class FakeResizeObserver {
  #callback: Callback
  #observed = new Set<object>()

  constructor(callback: Callback) {
    this.#callback = callback
  }

  observe(target: object): void {
    this.#observed.add(target)
  }

  unobserve(target: object): void {
    this.#observed.delete(target)
  }

  disconnect(): void {
    this.#observed.clear()
  }

  /** Drive a resize. Nothing happens until a test asks for it. */
  emit(width: number, height: number): void {
    this.#callback([{ contentRect: { width, height } }])
  }

  get observedCount(): number {
    return this.#observed.size
  }
}
