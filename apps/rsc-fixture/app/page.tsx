import type { Series, SizeContext } from '@shiftcharts/core'
import { describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core'
import { Chart } from '@shiftcharts/primitives'
// ⚠ A side-effect import, and the chart is invisible without it. Nothing in `Chart.tsx`
// references this file, so importing the component pulls in no styles at all: every stroke
// resolves to `none` and every fill to the SVG default. `apps/playground/src/main.tsx` makes
// the same import for the same reason and says so at length. This is that half, on the
// server side — and it is also the half that proves Next hoists a package stylesheet into the
// document from a server component, with no client runtime to inject it.
import '@shiftcharts/primitives/chart.css'
// ⚠ `chart.css` spends `var(--shiftcharts-*)` and defines none of them; this file is where they come
// from, and it also opens the `shiftcharts.theme` cascade layer that `chart.css` writes into. Without
// it every custom property is unresolved and the SVG is, again, correct and invisible.
import '@shiftcharts/tokens/theme.css'

/**
 * Gate **G4** — the RSC fixture.
 *
 * > *G4 | Next.js App Router page rendering `<Chart plan={…}>` in a **server component with
 * > JS disabled**, asserting the SVG is in the HTML | Fails when: the RSC path silently
 * > degrades to SSR + hydration* — `research/maps/04-ci-gate-map.md`
 *
 * ## Why this is not the same claim `AutoChart.ssr.test.tsx` already makes
 *
 * That test calls `renderToStaticMarkup`, which is **SSR**, and SSR is the *client* React
 * build running on a server. Every hook works there; `react-dom` is loaded; the output is
 * markup that a client bundle is expected to hydrate. It proves the tree needs no effects and
 * no layout measurement, which is worth proving and is not this.
 *
 * RSC is a different React. Node resolves `react` through the **`react-server` export
 * condition**, which selects `react.react-server.js` — a build whose entire hook surface is
 * `useId`, `useMemo`, `useCallback`, `useDebugValue`, `use` and `cache`. `useState`,
 * `useEffect`, `useRef` and `useLayoutEffect` are not merely discouraged there; they are
 * `undefined`. So the two claims differ in what they can falsify: SSR proves the tree does not
 * *use* the DOM, and only RSC can prove the tree does not *need the client React at all*.
 *
 * ⚠ **`<Chart>` calls `useId()` and `useMemo()`** (`packages/primitives/src/Chart.tsx`), and
 * that file's docblock asserts both are "present in React 19's `react-server` build". Until
 * this fixture existed that was a claim about a file listing, not an observation of a render.
 * It is now **measured**, on React 19.2.8 under Next 16.3.2, and the claim holds. The Flight
 * server's hook dispatcher
 * (`next/dist/compiled/react-server-dom-turbopack/…-server.node.development.js`) reads:
 *
 * ```js
 * useMemo:   function (nextCreate) { return nextCreate() },
 * useCallback: function (callback) { return callback },
 * useId:     function () { … return '_' + prefix + 'S_' + id.toString(32) + '_' },
 * useState:  unsupportedHook,   // throws: "This Hook is not supported in Server Components."
 * useEffect: unsupportedHook,
 * useRef:    unsupportedHook,
 * useReducer: unsupportedHook,
 * useLayoutEffect: unsupportedHook,
 * ```
 *
 * ⚠ **The served HTML carries the proof, not just the absence of a crash.** The id in
 * `<title id="…">` is `_S_1_-title`, and the `S` is literally the `'S_'` in the line above —
 * it stands for *Server*. `react-dom`'s SSR dispatcher emits `_R_…` instead. So the rendered
 * attribute distinguishes the two paths on sight: a page that had quietly degraded to SSR
 * would say `_R_`. Which is why `id` is deliberately **not** passed as a prop, even though
 * `ChartProps` offers it and snapshot tests are told to use it — passing it would leave
 * `useId()` called-but-discarded, and the hook's *return value* would never reach the HTML.
 * RSC ids are a function of tree position only, so they stay stable across runs of an
 * unchanged tree; two `curl`s of this page are byte-identical, checked.
 *
 * ⚠ **`useMemo` is a literal no-op on this path**, which sharpens rather than contradicts the
 * standing note in `Chart.tsx` that "`useMemo` here is a hint, not a correctness mechanism".
 * On the server it is `nextCreate()` with the dependency array ignored entirely. `resolveFrame()`
 * therefore runs once per request here and the memo buys nothing; its whole value is on the
 * client, under `<AutoChart>`'s `ResizeObserver`. Nothing to fix — worth knowing before
 * someone tunes that dependency list for a server workload it does not affect.
 *
 * ## ⚠ `shiftcharts-chart__svg` appears TWICE in the response, and only one is markup
 *
 * `grep -c` counts lines and says 1; `grep -o | wc -l` counts occurrences and says 2. The
 * second is inside Next's inlined RSC Flight payload — the `self.__next_f.push([...])` script
 * that lets a *client-side navigation* re-use this tree without a round trip. It is the
 * serialised React element, a JSON string carrying `className: "shiftcharts-chart__svg"`, i.e. **data
 * describing the already-rendered output**, not chart code. Next inlines it on every App
 * Router page and its presence says nothing about whether `@shiftcharts/primitives` shipped to the
 * browser.
 *
 * The question G4 actually wants answered is asked of `.next/static/chunks/**`, and there the
 * answer is clean: **no `.js` chunk contains `shiftcharts-chart`, `shiftcharts-series`, `graphics-document`,
 * `planChart`, `resolveFrame` or any series id.** The only static asset that mentions the
 * chart at all is the CSS chunk, which is correct — `chart.css` and `theme.css` *must* reach
 * the browser. The route's client-reference manifest lists **eight** client modules, all of
 * them Next's own router internals (`layout-router`, `client-page`, `error-boundary`, …), and
 * zero `@shiftcharts/*`.
 *
 * ## Why the size is a literal and there is no `<AutoChart>`
 *
 * `<AutoChart>` measures its own box with a `ResizeObserver`, which means `"use client"`,
 * which means the thing this gate exists to forbid. A server has no box to measure, so the
 * only honest server-side chart is one whose size the caller states — and stating it is
 * exactly what makes the output a fixed target for a grep.
 *
 * 900 × 620 px at the default 100 px nominal cell is 9 × 6 cells, which is the **Stage**
 * minimum (`resolveSizeClass`). Chosen as the richest rung on purpose. Counted in the served
 * HTML rather than predicted from the plan, the `<svg>` is 7,773 bytes and contains: 3 line
 * paths, 35 `<circle>` point marks, 21 `<text>` nodes, 18 `<rect>` gridlines and tick marks
 * including `shiftcharts-grid__zero`, both axes with rules and tick labels, direct series labels and
 * value labels — followed by the `<details>` data table in the `<figcaption>`. A fixture at
 * Micro would pass G4 while rendering an empty `<svg>`.
 *
 * ⚠ Two things the plan turns on at Stage are **absent** from that markup, and neither is a
 * bug in this fixture. `axes.y2` is resolved (`valueLegibleRung`: Stage plus more than one
 * series) and `Chart.tsx` draws `axes.x` and `axes.y` only — the secondary axis lands with the
 * milestone that renders it. And no `shiftcharts-area` appears, because `resolveFrame` gives this plan
 * no area geometry to draw. Stated so that a G4 assertion is not written against a `<path>`
 * count somebody expected rather than the one the page emits.
 *
 * ## Why x is a number and not a `Date`
 *
 * A temporal axis formats through `d3-time-format`, whose output is a function of the process
 * timezone. CI pins `TZ=UTC`, so a temporal fixture would work — right up until someone runs
 * `pnpm --filter @shiftcharts/rsc-fixture start` on a laptop in Berlin and gets different tick labels
 * than the gate expects. Numeric x formats through `d3-format`, which has no such dependency.
 * The chart is slightly less realistic and the gate is considerably less flaky, and for a
 * fixture that is the correct side of the trade.
 *
 * ⚠ **This page is a Server Component and must stay one.** If it ever needs interactivity,
 * the client component goes in a *sibling* file and beside a different chart — pushing
 * `"use client"` up into this file, or into `@shiftcharts/primitives`, would make G4 green by deleting
 * the thing G4 measures.
 */

/**
 * Deterministic input. Literal, not generated — a fixture whose data comes from a loop is a
 * fixture whose data can be changed by an off-by-one nobody reviews.
 *
 * ⚠ `null` in `pressure` is a **gap**, not a zero (`packages/core/src/data.ts`). It becomes
 * d3-shape's `.defined()` predicate in `resolveFrame`, so the emitted path breaks rather than
 * interpolating across it — which means the `d` attribute in the HTML below contains two
 * subpaths, and a G4 assertion could say so.
 *
 * ⚠ `drift` goes negative on purpose. It turns on the zero line and puts `U+2212` MINUS SIGN
 * into the y labels (`formatYLabel`), so the page also exercises the non-ASCII path through
 * `measureText`'s unknown-codepoint fallback.
 */
const DATA: readonly Series[] = [
  {
    id: 'throughput',
    label: 'Throughput',
    points: [
      { x: 1, y: 120 },
      { x: 2, y: 138 },
      { x: 3, y: 131 },
      { x: 4, y: 165 },
      { x: 5, y: 172 },
      { x: 6, y: 158 },
      { x: 7, y: 190 },
      { x: 8, y: 204 },
      { x: 9, y: 197 },
      { x: 10, y: 221 },
      { x: 11, y: 238 },
      { x: 12, y: 246 },
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    points: [
      { x: 1, y: 64 },
      { x: 2, y: 71 },
      { x: 3, y: 69 },
      { x: 4, y: null },
      { x: 5, y: 88 },
      { x: 6, y: 94 },
      { x: 7, y: 91 },
      { x: 8, y: 103 },
      { x: 9, y: 112 },
      { x: 10, y: 108 },
      { x: 11, y: 119 },
      { x: 12, y: 127 },
    ],
  },
  {
    id: 'drift',
    label: 'Drift',
    points: [
      { x: 1, y: -12 },
      { x: 2, y: -7 },
      { x: 3, y: 4 },
      { x: 4, y: 9 },
      { x: 5, y: 2 },
      { x: 6, y: -5 },
      { x: 7, y: -14 },
      { x: 8, y: -9 },
      { x: 9, y: 3 },
      { x: 10, y: 11 },
      { x: 11, y: 6 },
      { x: 12, y: -2 },
    ],
  },
]

/** 9 × 6 cells at the default 100 px nominal cell — the Stage minimum. See above. */
const WIDTH = 900
const HEIGHT = 620

export default function Page() {
  // ⚠ Resolved once, here, and both results handed to `<Chart>`. `ChartProps.ctx`'s docblock
  // is emphatic about why the context that produced the plan must be the context the frame is
  // resolved against: a second `sizeContextFromPixels()` call inside the component would be
  // a second answer to the same question, and the two could disagree.
  const ctx: SizeContext = sizeContextFromPixels(WIDTH, HEIGHT)
  const plan = planChart('line', ctx, describeShape(DATA))

  return (
    <main>
      <Chart
        plan={plan}
        data={DATA}
        ctx={ctx}
        title="RSC fixture line chart"
        description="Three deterministic series rendered by a React Server Component, with no client JavaScript."
      />
    </main>
  )
}
