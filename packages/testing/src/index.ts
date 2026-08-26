/**
 * `@shiftcharts/testing` — dev-facing helpers. Plan snapshot matchers, a11y matchers, and our own
 * `FakeResizeObserver`.
 *
 * ⚠ The fake is **injected**, never patched onto `globalThis` and left there. That is
 * what `restoreMocks` + `unstubGlobals` in the Vitest config exist to protect: a leaked
 * `ResizeObserver` stub makes one test file's failure appear in another's, which is the
 * slowest kind of bug to find.
 *
 * ⚠ A1 scope: the `emit()` driver, which is the piece the ladder tests need first. It
 * carries no DOM dependency, so ladder tests run in bare Node.
 *
 * ⚠ A5 widens the entry to carry **both** box shapes, because `@shiftcharts/react`'s
 * `useElementSize` reads `contentBoxSize[0]` first and `contentRect` only as a fallback.
 * A fake that emitted `contentRect` alone drove every test down a branch no real browser
 * takes. See `FakeResizeObserverEntry` for the long version.
 *
 * ⚠ A4 adds the `expect*` semantic assertion helpers. They construct their own jsdom by
 * hand rather than asking Vitest for a DOM environment, which is what keeps every consuming
 * test file at `environment: 'node'` — and therefore keeps the determinism preconditions in
 * `vitest.config.ts` in force without any file having to re-argue for them. See the module
 * docblock in `./expect.ts` for why that is a hazard removed rather than a preference.
 */

export type {
  AxisExpectation,
  ChartAxis,
  LineExpectation,
  ParsedChart,
  ParsedLine,
  ParsedPoint,
  ParsedScale,
  ParsedTick,
  PointsExpectation,
  ScaleBounds,
} from './expect.ts'
export {
  expectAxisTicks,
  expectElementSet,
  expectLine,
  expectPoints,
  expectScale,
  parseChart,
} from './expect.ts'

/**
 * One box in an entry's box list — the browser's `ResizeObserverSize`.
 *
 * ⚠ `inlineSize` is **not** a synonym for `width`. It is the size along the *inline* axis,
 * which coincides with the horizontal one only under a horizontal writing mode; under
 * `writing-mode: vertical-rl` the inline axis is vertical and `inlineSize` carries the
 * height. `emit()` maps `inlineSize → width` because that is the mapping every consumer in
 * this repo assumes — which means **this fake cannot catch a consumer that assumed it
 * wrongly.** Written down so that limit is a known one rather than a discovered one; the
 * browser tier (`research/maps/04-ci-gate-map.md`) is where a vertical writing mode would
 * have to be exercised.
 *
 * ⚠ Exported for the same reason `FakeResizeObserverCallback` is, below: gate **G6**
 * requires every type appearing in a public signature to be nameable from outside the
 * package, and this one is reachable from `FakeResizeObserverEntry.contentBoxSize`.
 */
export interface FakeResizeObserverSize {
  readonly inlineSize: number
  readonly blockSize: number
}

/**
 * One observation, shaped like the browser's — **both** boxes, not just the legacy one.
 *
 * ⚠ CARRYING ONLY `contentRect` WAS A BUG, AND A GREEN ONE. Real consumers read
 * `contentBoxSize[0]` first and treat `contentRect` as the fallback, because `contentRect`
 * reports the **transformed** box: a widget inside a CSS `scale(0.5)` — a dashboard zoom
 * control, a print preview — is reported at its apparent size, so the resolver plans it for
 * a rung it does not occupy. `apps/playground/src/useElementSize.ts` is that read today and
 * `@shiftcharts/react`'s `useElementSize` at **A5** (`research/30-implementation-plan.md` A5) is the
 * same read on the path that ships. A fake emitting `contentRect` alone therefore drove
 * every fake-driven test down a fallback branch a real browser never takes: full green over
 * code nobody runs. That is this project's recurring failure species — a thing that looks
 * like it works and quietly doesn't — so it is fixed at the fake rather than noticed at the
 * first browser-tier run.
 *
 * ⚠ `contentBoxSize` is **optional here and non-optional in `lib.dom.d.ts`**, and the
 * disagreement is deliberate rather than an oversight. The DOM lib's version is a lie in
 * exactly one direction: environments that predate the property hand you an entry without
 * it while the type insists `[0]` is safe to reach for. Those environments are not
 * hypothetical — `research/raw/07-arch-oss-packaging.md` records that
 * `resize-observer-polyfill`, still the most-installed shim, *"predates
 * `borderBoxSize`/`contentBoxSize` (it only provides `contentRect`)"*. Typing it as
 * possibly-absent is what makes `emit(w, h, { legacy: true })` expressible at all, and it
 * makes a helper written against this type handle the branch its callers will really meet.
 *
 * ⚠ The two fields are consistent **by construction** — `emit()` derives `contentRect` from
 * the same `FakeResizeObserverSize` it puts in `contentBoxSize`, so there is no arrangement
 * of arguments that produces an entry disagreeing with itself. A fake that can report two
 * sizes at once is a fake that can make a test pass for the wrong reason.
 */
export interface FakeResizeObserverEntry {
  /** The observed object this entry is about — the browser's `ResizeObserverEntry.target`. */
  readonly target: object
  readonly contentBoxSize?: readonly FakeResizeObserverSize[]
  readonly contentRect: { readonly width: number; readonly height: number }
}

/**
 * The second argument to `emit()`.
 *
 * ⚠ An options bag rather than the `emit(el, w, h)` positional sketch in
 * `research/raw/07-arch-oss-packaging.md`. The sketch is right about the capability and
 * wrong about the ergonomics: one observer per widget is the depth-ordered pattern the
 * `ResizeObserver` spec is designed around (`research/raw/05-theory-responsive-viz.md`
 * §5.3), so *almost every* call site observes exactly one element and would have to name it
 * on every line. Moving the element into an optional field keeps the common call at
 * `emit(320, 180)` and leaves the multi-target case sayable.
 *
 * ⚠ Exported for gate **G6**: it is a parameter type on a public method.
 */
export interface FakeResizeObserverEmitOptions {
  /**
   * Deliver to this one observed object instead of fanning out to all of them. Must
   * already be observed — see `emit()` for why that is enforced rather than ignored.
   */
  readonly target?: object

  /**
   * Omit `contentBoxSize`, forcing a consumer down its `contentRect` fallback.
   *
   * ⚠ This exists so the fallback stays **covered rather than merely unreachable**. The
   * fallback is real code that runs in real places — Safari before 15.4, jsdom-shaped
   * environments, and every `contentRect`-only polyfill still in the registry — so deleting
   * it would be wrong and leaving it untested would be worse. What must not happen is the
   * state this fake was in before A5, where the legacy branch was the *only* branch any
   * test ever reached. Reachable on request; never the default.
   */
  readonly legacy?: boolean
}

/**
 * The shape `FakeResizeObserver` calls back with.
 *
 * ⚠ Exported because it is `FakeResizeObserver`'s constructor parameter type, and gate
 * **G6** found it unexported: a consumer writing `const cb: ??? = …` before passing it in
 * had no name to reach for. It was the gate's first catch on the real tree.
 */
export type FakeResizeObserverCallback = (entries: readonly FakeResizeObserverEntry[]) => void

/**
 * A `ResizeObserver` you drive by hand.
 *
 * The real one fires when the browser decides to. A test that awaits that is a test that
 * flakes; `emit()` makes the timing explicit and the assertion deterministic.
 */
export class FakeResizeObserver {
  #callback: FakeResizeObserverCallback
  #observed = new Set<object>()

  constructor(callback: FakeResizeObserverCallback) {
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

  /**
   * Drive a resize. Nothing happens until a test asks for it.
   *
   * ⚠ WHICH TARGETS. With no `target` option the emission fans out to every observed
   * object, in `observe()` order, all at the reported size — which is the whole story when
   * one observer watches one widget, and that is the pattern
   * `research/raw/05-theory-responsive-viz.md` §5.3 says the spec is designed around. Name
   * a `target` when one observer watches several and they must differ; call `emit()` twice
   * with different sizes to make them differ.
   *
   * ⚠ WHY IT THROWS INSTEAD OF DOING NOTHING. A real `ResizeObserver` silently delivers
   * nothing for an object it is not observing, so a test that misspelled its target, or
   * forgot to `observe()`, would get a callback that never fires — and an assertion of the
   * form "the plan never went wrong" passes vacuously against a component that was never
   * measured at all. That is the same failure species this fake exists to remove, so the
   * two empty cases are loud. `observe()` takes any `object`, so a bare-Node ladder test
   * with no DOM to hand can observe `{}`.
   *
   * ⚠ `contentRect` is read back out of `box` rather than rebuilt from `width`/`height`.
   * The indirection is the point: there is exactly one place the numbers come from, so the
   * two boxes cannot drift apart no matter how this method is later edited.
   */
  emit(width: number, height: number, options: FakeResizeObserverEmitOptions = {}): void {
    const { target, legacy = false } = options

    let targets: readonly object[]
    if (target === undefined) {
      if (this.#observed.size === 0) {
        throw new Error(
          'FakeResizeObserver.emit(): nothing is observed, so there is nothing to resize. ' +
            'Call observe() first — outside a DOM, any object will do.',
        )
      }
      targets = [...this.#observed]
    } else {
      if (!this.#observed.has(target)) {
        throw new Error(
          'FakeResizeObserver.emit(): the named target is not observed. A real ' +
            'ResizeObserver delivers nothing for one, so this would have been a silent no-op.',
        )
      }
      targets = [target]
    }

    const box: FakeResizeObserverSize = { inlineSize: width, blockSize: height }
    const contentRect = { width: box.inlineSize, height: box.blockSize }

    this.#callback(
      targets.map((observed) =>
        legacy
          ? { target: observed, contentRect }
          : { target: observed, contentBoxSize: [box], contentRect },
      ),
    )
  }

  get observedCount(): number {
    return this.#observed.size
  }
}
