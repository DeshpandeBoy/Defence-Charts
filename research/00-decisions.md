# Locked decisions

Confirmed on 2026-08-22. These are settled; downstream research assumes them.

| # | Decision | Choice | Consequence |
|---|---|---|---|
| 1 | Distribution | **Open source, npm, scoped packages** (`@scope/core`, `@scope/grid`, `@scope/charts-*`, `@scope/tokens`) | Public monorepo, permissive licence, tree-shakeable subpath exports, Changesets releases. |
| 2 | Library boundary | **Presentational only** | Consumer passes already-shaped data. No fetching, no SQL, no AI, no persistence. Smallest surface, widest reuse. |
| 3 | Grid model | **12 columns x unlimited rows** | Matches the `x/y/width/height` grid-unit model. Widget size is `(w,h)` in cells; grid grows vertically. |
| 4 | Theming | **CSS custom properties + TypeScript token types** | Every visual constant is a `var(--...)` overridable per-widget; typed tokens for JS-side needs. No runtime style provider, no Tailwind dependency, RSC-safe. |
| 5 | Chart core | **Raw d3 primitives + our own SVG render tree.** `d3-scale@4`, `d3-shape@3`, `d3-array@3`, `d3-format`, `d3-time-format`. **Not** visx, not Recharts, not ECharts. | See `raw/03-landscape-charting.md`. We must own the render tree anyway because the responsive-plan layer sits *above* it and no library models that. Once we own the tree, visx's marginal value collapses to "an Axis component". d3 is ISC, `sideEffects:false`, API-frozen since 2023, 91.7M/wk. Cost we accept: we rewrite axis tick math and per-corner bar radius, and we own the ESM-only dual-publish burden. |
| 6 | Grid engine | **Adopt `react-grid-layout@2`** — use `./core` for framework-agnostic collision, compaction, constraints, and types; verify the client wrapper exposed under `./react` in C0. | See `raw/04-landscape-grid-resize.md`. The installed 2.2.4 package splits algorithms/types under `./core` from React components/hooks under `./react`; `./core` alone is not the UI. We do not reimplement collision/compaction; we own the semantics and wrapper boundary. Pin the verified version and stay away from 2.2.0's critical layout bug. |
| 7 | Render boundary | **Two entry points over one render tree.** `<Chart plan={...}>` is hook-free and renders in a React Server Component with zero JS. `<AutoChart>` is `"use client"`, measures itself, and computes the plan. | Zero of the 11 charting libraries audited ship a `"use client"` directive; every consumer must author their own boundary. This is a first-paint story no competitor currently matches. Made possible by decision 8. |
| 8 | Plan is data | **`ChartPlan` is a plain serialisable object**, produced by a pure `planChart()` function. | The resolver runs identically on server or client. It is inspectable, snapshot-testable, overridable, and can be transmitted. This is what makes decision 7 possible and is the single most important structural choice in the library. |
| 9 | Build | **`tsdown` with `unbundle: true`, ESM-only.** Pin TypeScript **6.0.3**, not 7.x. | See `raw/07` §2. tsup is unmaintained and its own README points at tsdown. `unbundle: true` is the only tested configuration in which `"use client"` survives a Rolldown build on a non-entry file — so it is load-bearing for decision 7, not an optimisation. ESM-only because dual format + `unbundle` + CSS reproducibly emitted a `require()` for a file tsdown never wrote. Every peer dependency must be declared or Rolldown inlines `react/jsx-runtime`. |
| 10 | No DOM measurement in the resolver | **`planChart()` may not call `getComputedTextLength`, `getBBox`, `getTotalLength`, or `getBoundingClientRect`.** Text width comes from a character-advance model. | Required by decision 7 anyway (no DOM on the server), but `raw/07` §6 makes it non-negotiable: jsdom throws on all four, and happy-dom returns `0` from all four — which silently means *"every label fits"*, so a collision test passes forever while shipping the bug. The constraint pushes the architecture somewhere better; it is not a workaround. |
| 11 | Test stack | **Bare Node for the ladder; an injected `FakeResizeObserver` we own; Vitest browser mode + `@vitest/browser-playwright` for the small tier that needs a real browser.** jsdom permitted, **happy-dom banned.** | Decision 8 means the responsive ladder — the core IP — is tested with no DOM at all. happy-dom's `ResizeObserver` passes `typeof === 'function'` and then **never fires**, so `<AutoChart>` would take the adaptive path, never measure, and render its fallback green forever. Every registry RO shim is stale (newest 2025), so we write ~50 lines with an `emit(width, height, options?)` driver: resize becomes an input we control, not an event we wait for. ⚠ **Signature corrected 2026-08-23** — this row read `emit(el, w, h)` through A4, after the positional sketch in `raw/07` §6.2. The element is an optional `target` field instead, because one observer per widget is the pattern the spec is designed around, so almost every call site observes exactly one element and would otherwise name it on every line; the common call is `emit(320, 180)`. ⚠ **And the fake was a false green until A5**: its entry carried `contentRect` alone, while `useElementSize` reads `contentBoxSize[0]` first — so every fake-driven test ran a fallback branch no real browser takes. It emits both boxes now, with the legacy shape reachable only as `emit(w, h, { legacy: true })`. Decision 11 caught happy-dom's silent green and then shipped its own; the lesson generalises past the shim. `packages/testing/src/index.ts` is the signature of record. Playwright's component-testing packages are removed as of 1.63. |

## The tension in decision 7, resolved

Decision 7 looks like it contradicts the product thesis: adaptation needs `ResizeObserver`, which is
client-only. It does not, because of decision 8 — the plan is *data*, and the resolver is *pure*:

- **Static path (RSC, no JS):** caller knows the size (a report, a PDF, an email, a fixed dashboard
  slot). Server calls `planChart()`, passes the resulting plan to `<Chart>`. Pure server HTML.
- **Adaptive path (client):** `<AutoChart>` measures its own box, calls the *same* `planChart()`, and
  renders the *same* `<Chart>`. SSR emits the plan for a declared initial size so first paint is
  correct, then the observer takes over.

One render tree, one resolver, two entry points. No duplicated chart code.

## Token discipline and stack conventions

Enforce token discipline with a lint gate that rejects **raw hex/rgb/hsl colours, raw `px` values, and gradients**, requiring
`var(--...)` instead. Build this gate into the new repo from day one; it is exactly the discipline a
"granular visual control" library needs to keep honest.

Stack conventions: Next.js 16, React 19, TypeScript, CSS Modules with
design tokens, Storybook, Playwright, Vitest, with one amendment from decision 11:
**stories are test fixtures, not just docs.** Playwright deleted its component-testing packages and
replaced them with a story gallery exposing `window.mount()` — independently arriving at Storybook's
model. That convergence says the `*.stories.tsx` files should be the single source that both the docs
site and the browser-tier tests render.

## The product thesis, in one line

> A widget renders **different information**, not merely different dimensions, as its grid size changes —
> with obsessive, tokenised control over every stroke, gap, and tick.

## The claim that survives scrutiny

`raw/06` §7 compared granularity across ten libraries — Highcharts, amCharts 5, ECharts, Vega-Lite,
Recharts, Nivo, visx, Plot, Carbon, Spectrum — reading primary source for every cell. It disciplines
the pitch, and we should adopt its wording rather than a bolder one:

> *Every knob the best libraries expose, in one namespace, reachable from CSS, per widget, without
> JavaScript — plus a size ladder that changes what the chart says, not just how big it is.*

**Three of those four clauses are novel. The knob count is not.** What the comparison actually found:

- **Delivery is the real differentiator, not knob count** — but narrowly, and the narrow version is
  the checkable one. ⚠ **Corrected 2026-08-23** (`decisions/014`): Highcharts styled mode is **not**
  "colours only." It exposes stroke width, dash style, gridline width, tick colour and width, and
  typography, ships `--highcharts-color-{n}` as extensible custom properties, and reacts to
  `prefers-color-scheme` in v11+. What survives the correction: **one namespace covering every knob**
  rather than a colour-indexed subset with the rest class-based, and **per-widget scope on a shared
  dashboard**. Carbon still ships exactly two chart custom properties, both font families; everyone
  else is a JS options object, a JS theme prop, or per-element props.
  - **And the boundary Highcharts stops at is the platform, not a Highcharts weakness.** Tick length
    is `y2` on a `<line>`, and `x1`/`y1`/`x2`/`y2` are not CSS-settable in any browser. We cross that
    line only by an early rendering choice (`decisions/012`) — a real advantage, but a narrow, earned
    one, not evidence that a two-decade commercial library overlooked something.
- ⚠ **The zero-JS claim, corrected 2026-08-23** (`decisions/013`). *"Zero of the 11 audited ship a
  `"use client"` directive"* is verified and stands. *"None of the eleven can render server-side with
  zero JS"* is **false** — four libraries were installed and rendered: visx works inside an RSC at
  124 B page JS; Vega renders in bare Node but is inert; Observable Plot needs a DOM; nivo fails at
  import. Server-side SVG is table stakes. The wording that survives: **the first planned,
  size-adaptive chart library that renders with zero JS and stays themeable after render.**
- **The size ladder genuinely does not exist**, and after the two corrections above it is the
  **strongest** of the three claims, not the third. Only Carbon and Spectrum do anything with size, and
  **both only rescale.** Neither reveals, conceals, relabels, aggregates, substitutes or transposes.
  The three conceal rules found anywhere in ten libraries — Nivo's `labelSkipWidth`, Highcharts'
  `marker.enabledThreshold`, Spectrum's donut `MIN_ANGLE` — are each a single hard-coded special case.
- ⚠ **Where we merely match, say so.** Line stroke width, gridline colour/width, tick length and
  padding, bar padding, corner radius, point size and stroke, label offset, axis-line visibility:
  six to ten of the ten libraries expose each. Table stakes. **On raw knob count we do not beat
  Highcharts, and on guide API richness we do not beat Vega-Lite** (70 documented axis properties) —
  the honest framing is that Vega-Lite has the best axis API in open source and we should copy most
  of it.

Being accurate here is not modesty; a library that overclaims against a field this well documented
gets caught in the first comparison blog post.

## What the provenance tier does and does not mean

Every threshold and token ships labelled **A-lit** (perception research or a W3C/CSS spec), **A-impl**
(verified source of a shipped library), **B** (ours, consistent with published work) or **C** (ours,
invented). Shipping the labels is a differentiator. But two limits have to stay written down, because
both were hit during the research and both are easy to forget once the labels look authoritative:

1. **Provenance is per-token; correctness is per-composition.** `grid-color: #ddd` (Vega, Nivo) and
   `grid-opacity: 0.2` (Heer & Bostock 2010) are each individually citable, and each is a *different
   solution to the same problem* — make the gridline recede. Composed, they multiply into an
   invisible grid. Two Tier A defaults can be jointly wrong. See `10-responsive-ladder.md` §6.1.
2. **The tier answers "where did this come from?", never "is this right?"** Adobe Spectrum verifiably
   scales stroke width *down* at small sizes; that is A-impl and we still reject it, because it
   contradicts Okabe–Ito CUD guidance and CSS optical sizing. A-impl is a strong prior, not an
   authority. Where we diverge from a verified source we say so out loud, with the reasoning — a
   reader who knows the source will otherwise assume we simply got it wrong. See §6.2.

The corollary is the good news: where A-lit and A-impl agree *independently*, that is the strongest
evidence available. Heer & Robertson 2007's ~1000 ms transition and Spectrum's shipped
`DRAW_IN_ANIMATION_DURATION_MS = 1000` match exactly; Spectrum's `0.75 / 1 / 1.25` size ratios match
visionOS's 75–125 % user scaling. Cite both halves when it happens.
