import { defineConfig } from 'vitest/config'

/**
 * ⚠ THE DETERMINISM PRECONDITIONS. Every setting here exists because its absence
 * produces a test that passes locally and fails in CI, or worse, passes in CI for a
 * reason nobody checked. `research/30-implementation-plan.md` A1.
 */
export default defineConfig({
  test: {
    /**
     * Node, not a DOM, by default.
     *
     * ⚠ `@gx/core` must never touch the DOM (gate **G2**), so giving its tests a DOM
     * hands them the ability to violate the rule the gate exists to enforce. Files that
     * genuinely need one opt in per-file with the Vitest environment docblock.
     *
     * ⚠ That docblock is matched by a **regex over the whole file**, comments included —
     * so a test file that merely *mentions* the directive in prose silently switches
     * itself to a DOM environment. Measured: 776 ms of jsdom setup versus 0 ms, from a
     * `//` comment. In a repo whose test files routinely quote token and config names
     * back at the reader, that is a live hazard, not a curiosity. `check-determinism.mjs`
     * gate **G15** rejects it.
     *
     * ⚠ **happy-dom is banned, jsdom is permitted**, and the difference is the whole
     * argument: on the measurement APIs the resolver may not call, jsdom *throws* and
     * happy-dom returns `0`. A throw is a failing test. A `0` is a chart that lays itself
     * out as though every label were empty — a thing that looks like it works and quietly
     * doesn't. Enforced as a dependency fact by `scripts/check-determinism.mjs`.
     */
    environment: 'node',

    /**
     * ⚠ UTC, or tick formatting is a function of the machine that ran the test. A
     * time-axis snapshot taken in IST and replayed in CI under UTC differs by a rung.
     * Asserted observably in `packages/testing/src/determinism.test.ts` — this line sets
     * it, that test proves it took.
     */
    env: { TZ: 'UTC' },

    /**
     * ⚠ rAF and cAF ONLY.
     *
     * The reflex is `vi.useFakeTimers()` with everything faked, and it is wrong here:
     * faking `Date` makes time-axis tests assert against a clock that does not move, and
     * faking `setTimeout` deadlocks anything awaiting a real microtask-adjacent timer.
     * Animation staging (`43-theming.md` §7 — axis first, marks second) is the only thing
     * that needs frame control, so it is the only thing faked.
     */
    fakeTimers: { toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] },

    /**
     * ⚠ Both, together. A leaked `ResizeObserver` stub makes one test file's failure
     * surface in another file — the slowest class of bug to locate, because the failing
     * test is not the broken one. `@gx/testing` injects its fake rather than assigning to
     * `globalThis`; these two are the belt for that braces.
     */
    restoreMocks: true,
    unstubGlobals: true,

    include: ['packages/*/src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
})
