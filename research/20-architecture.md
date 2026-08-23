# Architecture

Derived from the locked decisions in `00-decisions.md` and the landscape evidence in
`raw/03-landscape-charting.md` and `raw/04-landscape-grid-resize.md`.

Package scope is written as `@gx/*` throughout as a placeholder. Naming is an open item (see bottom).

---

## 1. The one-paragraph version

A pure function turns *size + data shape + overrides* into a **`ChartPlan`** — a plain object that
says exactly what to draw. A hook-free primitive layer renders that plan as SVG. A thin client layer
measures containers and adds interaction. A grid shell arranges widgets on 12 columns. Everything
visual is a CSS custom property. That is the whole library.

```
size + dataShape + overrides ──▶ planChart() ──▶ ChartPlan ──▶ <Chart> ──▶ SVG
        (pure, isomorphic)        (pure)        (data)      (hook-free)
```

---

## 2. Package graph

```
@gx/tokens          CSS custom properties + generated TS types.        deps: none
   ▲
@gx/core            Types, scales, ticks, layout math, planChart().    deps: d3-scale, d3-shape,
   │                NO React. NO DOM. Pure + isomorphic.                     d3-array, d3-format,
   │                                                                          d3-time-format
   ├── @gx/primitives   Hook-free SVG marks + axes. RSC-safe.          deps: @gx/core, react (peer)
   │      ▲             <Chart plan={...}> lives here.
   │      │
   │      ├── @gx/react     "use client". <AutoChart>, useElementSize, tooltip,
   │      │                 crosshair, brush, legend interaction.       deps: @gx/primitives
   │      │
   │      └── @gx/grid      12-col widget grid shell.                   deps: react-grid-layout@2
   │                        Wraps react-grid-layout/core.                     (./core), @gx/react
   │
   └── @gx/testing     Plan snapshot helpers, our own FakeResizeObserver with an emit()
                       driver, a11y matchers. (dev-facing)
```

**Rules the graph enforces:**

| Rule | Why |
|---|---|
| `@gx/core` may not import `react` | Makes the resolver usable from Node, a worker, a test, or another framework. Proves the plan is data. |
| ⚠ `@gx/core` may not call **any DOM measurement API** — `getComputedTextLength`, `getBBox`, `getTotalLength`, `getBoundingClientRect` | Text width comes from a character-advance model instead. Required for the server path, and the only way the ladder is testable: jsdom throws on all of these and happy-dom returns `0` for all of them. See §6a. |
| ⚠ `@gx/primitives` may not emit `<line>` for any geometry a `--gx-*` token controls | Same species as the rule above: a platform fact that pushes the architecture somewhere better rather than an obstacle to route around. `x1`/`y1`/`x2`/`y2` are **not CSS-settable in any browser, and none is planned**, so `line { y2: var(--gx-tick-length) }` parses, passes the token gate, builds, warns about nothing, and does nothing. Use `<rect>` for ticks and gridlines, `<path>` where a path already exists. A `<line>` stays legal for anything no token controls. Gate G14; see `decisions/012`. |
| `@gx/primitives` may not import `react-dom`, may not use state/effects/refs | Keeps the RSC path real. Allowed hooks: `useMemo`, `useCallback`, `useId` only — verified present in React 19's `react-server` build. |
| ⚠ `@gx/primitives` elements carry **no visual presentation attributes** — everything comes from classes | `<line stroke="#ddd" />` is CSS-shaped but is not CSS, so a CSS-only gate cannot see it and the token gate has a hole exactly where the theming pitch lives. Taking every visual property from a class is also what makes per-widget CSS theming work at all. Decided at A1 (`30-implementation-plan.md` A1). Note this closes the *authored* hole only; the rule above closes the *platform* one. |
| Only `@gx/react` and `@gx/grid` carry `"use client"` | One boundary, declared once, in the two packages that genuinely need it. `react-grid-layout@2.2.4` ships none of its own, so `@gx/grid` must supply it. |
| No package emits a raw colour or length literal in CSS | Colour means `#hex`, `rgb()`, `hsl()`, **`oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, `color()` and named colours**; length means `px` and **every other absolute or font-relative unit** (`43-theming.md` §6.1a — widened after the stated `hex/rgb/hsl` + `px` rule was executed and found to pass `oklch()`, the notation `DESIGN.md` derives the whole palette in). Enforced by a **PostCSS-based** token lint gate — not the ported regex script, which cannot express the positional rule ([decision 015](decisions/015-token-gate-is-a-parser.md)) — with one narrow allowlist: the theme source files of `@gx/tokens`, and only in custom-property declaration values (`43-theming.md` §6.1). CI asserts the gate both passes there and *fails* on a planted hex elsewhere. |

**Why a `@gx/charts-*` package per chart type is *not* in this graph:** it was in the original
sketch, but per-type packages fragment the plan resolver, which needs a single switch over chart
type to stay coherent. Instead, ship one `@gx/primitives` with **subpath exports per chart type**
(`@gx/primitives/line`, `/bar`, `/donut`) so tree-shaking still gives per-type granularity without
per-type versioning. Revisit only if bundle measurements say otherwise.

---

## 3. `@gx/core` — the part that matters

### 3.1 Contracts

```ts
// What the container is.
type SizeContext = {
  width: number;            // px, content box
  height: number;           // px, content box
  cols: number;             // grid units, 1..12
  rows: number;             // grid units
  aspect: 'portrait' | 'square' | 'landscape' | 'ultrawide';
  sizeClass: SizeClass;     // 'micro' | 'tile' | 'strip' | 'panel' | 'canvas' | 'stage'
};

// What the data looks like — NOT the data itself. The resolver never sees values.
type DataShape = {
  series: number;
  categories: number;
  points: number;
  hasNegative: boolean;
  labelMaxChars: number;
  temporal: boolean;
};

// The output. Plain, serialisable, snapshot-testable, hand-authorable.
// Full field list: 40-chart-plan.md §3–§4.
type ChartPlan = { /* … */ };

function planChart(
  type: ChartType,
  ctx: SizeContext,
  shape: DataShape,
  policy?: Partial<PlanPolicy>,   // thresholds + atomic typography; applied BEFORE resolution
  overrides?: PlanOverrides,      // DeepPartial<ChartPlan>; forced AFTER resolution
): ChartPlan;
```

⚠ `policy` and `overrides` were previously one argument. They are separated because they apply at
different times, and merging them makes `aggregateAfter` ambiguous — as policy it is a threshold the
resolver consults, as an override it is a decided value the resolver may not revise. See
`40-chart-plan.md` §5.

`DataShape` rather than the data itself is deliberate: it keeps the resolver cheap, keeps it pure,
and means a plan can be computed server-side from metadata alone.

### 3.2 Override precedence

Cascading, highest wins — modelled on Vega-Lite's `config` cascade:

```
1. library defaults
2. theme-level overrides         <GxConfig charts={{ line: { ... } }}>
3. per-chart props               <Chart plan={{ legend: { placement: 'absent' } }}>
4. planFn                        <Chart planFn={(p, ctx) => ({ ...p, aggregate: { after: 5 } })}>
```

`planFn` last so an escape hatch can always see and amend the fully-resolved plan.

⚠ Both examples were `legend: 'hidden'` / `aggregateAfter: 5` at seed time. `'hidden'` is not a
placement — it is a *visibility*, and the Conceal Means Gone rule (`DESIGN.md:233`) forbids hiding
a dropped element rather than removing it, so the shorthand named the one behaviour the system bans.
The settled shapes are `LegendPlan` and `AggregatePlan`, `40-chart-plan.md` §4.4 and §4.8.

#### ⚠ The token split — corrected against `raw/07` §8.6

An earlier version of this cascade had a second level reading *"token values from CSS (`--gx-*` →
resolved once, client-side)"*. **That was a real bug, and it would have broken every chart.** CSS
custom properties can only be resolved by `getComputedStyle` in a browser. The server has no such
value. So any token feeding `planChart()` would produce one plan on the server and a different plan
on the client — a **hydration mismatch on every chart**, and a direct violation of decision 7.

The fix is a rule about which tokens exist in which mechanism:

| Class | Examples | Mechanism | May feed `planChart()`? |
|---|---|---|---|
| **Presentation tokens** | stroke width, colour ramp, corner radius, gap, transition duration, `GRAD` | **CSS custom properties.** Consumed by the render tree as `var(--gx-*)` at paint time. | **Never.** |
| **Plan-input tokens** | `tick-target-spacing`, `plot-height-saturation`, `categories-max-radial`, `aggregate-after`, minimum cell size, **atomic fitting typography + `FontMetrics`** | **TypeScript token objects**, passed through `<GxConfig>` or props. Plain serialisable values. | **Yes — only these.** |

⚠ **Corrected: `font-family` was previously listed as a presentation token, and that was wrong.**
The test is not "is this visual?" but **"does this value change the outcome of a fit-or-collide
decision?"** Six tokens do: `font-family`, `font-size`, `font-weight`, `font-feature-settings`,
`font-stretch`, and `letter-spacing`. All are plan inputs. A consumer who swapped `--gx-font-family`
for a wider face under the old classification would move rendered text width while the planner kept
its built-in advance table — the plan says the labels fit, the browser collides them, and nothing in
the system can detect it. Full argument: `41-text-metrics.md` §2.

`GRAD` is the one font axis that stays presentation: it is verified to change typographic colour
without changing advance widths, which is why landmark emphasis uses it instead of `font-weight`
(`41-text-metrics.md` §3, `42-typography.md` §3).

To avoid two sources of truth, `PlanPolicy.typography` replaces all six values and the matching
metrics atomically, while `@gx/tokens` generates their CSS custom properties from the default object.
Gate **G17** checks the committed CSS byte-for-byte. One authored value, two emitted forms.
Overriding a generated CSS variable directly is the documented footgun.

**Rule: tokens may drive presentation, never plan inputs.** A presentation token can change freely,
client-side, per-widget, without the plan knowing — that is exactly the granular control the product
promises, and it costs nothing because it never crosses the server/client boundary. A plan-input
token is an *argument to a pure function* and must therefore be serialisable and identical in both
environments.

This is decision 4 ("CSS custom properties **+** TypeScript token types") turning out to be load-
bearing in a way that was not obvious when it was made: the two halves are not two spellings of the
same thing, they are two different mechanisms with different reasons to exist.

Consequence for Milestone B3: the responsive-threshold tokens are **TS-side**, not `--gx-*` custom
properties. A consumer retunes them through `<GxConfig>`, which works identically on server and
client.

### 3.3 Hysteresis — ⚠ corrected against the literature

An earlier version of this doc specified an 8 px deadband passed into the resolver as `prevClass`.
`raw/05-theory-responsive-viz.md` shows that is the wrong primary mechanism. No visualization paper
studies hysteresis at all, and the web platform solves the underlying problem two other ways:

1. **Prevent the cycle structurally.** CSS refuses sibling-size queries because "it would introduce
   layout cycles"; `ResizeObserver` responds to an unresolved cycle by **throwing an error**, not by
   damping. Rule: *the measured element's size must be grid-determined, never content-determined,
   and a plan may only affect descendants of the measured box.*
2. **Mask the switch with animation.** A ~1 s eased transition means a boundary crossed twice inside
   a second reads as one continuous motion. Animation converts flicker into smear.

Order of attack: containment first (it prevents a true infinite loop, which a deadband cannot),
animation second, deadband only if flicker is still observable in practice. If we do ship one, it
must be a **fraction of the boundary width (~2–3%)**, not an absolute — 8 px means very different
things at a 120 px boundary and a 1200 px one.

**Consequence for the contract — settled:** `planChart()` **is** a pure function of size alone, with
no `prevClass`. `ChartPlan` has no such field and `SizeContext` gains none. Containment prevents the
true loop (a deadband only slows one), animation converts flicker into smear, and §6a makes purity
load-bearing for testability as well as for the server path. Revisit only if flicker is still
observable at A5 — and then as `PlanPolicy`, so the resolver stays pure. `40-chart-plan.md` §9.

**Test that protects this:** drag every chart type across every rung boundary and assert the
`ResizeObserver` loop error never fires.

---

## 4. `@gx/grid`

Adopts `react-grid-layout@2`'s `./core` for collision, compaction, and constraints. We supply:

- the 12-column geometry and the widget size families;
- resize handles on all four corners, matching the reference implementation;
- per-widget minimum sizes that the reference implementation **does not have** — a widget should be
  able to declare "below 2×2 I am meaningless";
- the wiring that hands each widget its own `SizeContext`.

Reference geometry extracted from the shipped Basedash bundle, as a sanity check rather than a
target: `MIN_COLUMN_WIDTH=140`, gutter `12`, row height `188`, container padding `12`, and a single
breakpoint at `containerWidth <= 480 → single column`. That single breakpoint is the proof that
chart adaptation must be per-widget self-measurement, not grid breakpoints.

---

## 5. Build and publish — ⚠ resolved against `raw/07`

**Bundler: `tsdown` with `unbundle: true`.** Not tsup — tsup is unmaintained, and its own npm README
now says *"This project is not actively maintained anymore. Please consider using tsdown instead."*
Last publish 2025-11-12, zero releases in 2026. unbuild is dormant. The live choice in 2026 is
Rolldown vs Rollup, and Rolldown won on the one requirement that matters most to us.

**`"use client"` survival — empirically tested by the agent, not read off a changelog.** With
tsdown@0.22.14 / rolldown@1.2.5:

| Configuration | Directive |
|---|---|
| Directive on a non-entry module that gets bundled in | **STRIPPED** |
| Directive on a file that is an entry point | PRESERVED |
| `unbundle: true`, any file | PRESERVED per-file, in both ESM and CJS |

So `unbundle: true` is not a tree-shaking nicety — it is what makes decision 7 shippable. ⚠ It is the
*concept* `preserveModules` names, but **not the key**: `preserveModules` is a Rollup output option
and does nothing in tsdown. Write `unbundle: true`.

Rollup would need `rollup-plugin-preserve-directives`, whose last release is 0.4.0 (2024-02-02).
`bunchee` 7.0.1 is the only first-class directive tool and comes from the Next.js team, but its
zero-config-by-convention model fights a many-subpath layout like ours.

**ESM-only.** `07` closed the open question with a reproducible bug rather than an opinion: tsdown
0.22.14 with `unbundle` + dual format + CSS emitted a `require("./chart2.cjs")` pointing at a file it
never wrote. Dual publish costs us a broken artifact class for a consumer we cannot name.

Other settled points:

- **Always declare peer dependencies.** Trap found in testing: with `unbundle: true` and no declared
  peer, Rolldown silently inlined `react/jsx-runtime` into the output.
- **Pin TypeScript 6.0.3, not the 7.0.2 latest.** TanStack Table, TanStack Query and Base UI all pin
  6.0.3, and tsdown itself warns that TS 7 support is experimental.
- `"sideEffects": ["*.css"]` on any package shipping CSS; `false` elsewhere.
- Token lint gate (rejects raw colour literals — hex, `rgb()`, `hsl()`, `oklch()`, `lab()`, `hwb()`, `color()`, named colours — raw length literals, and gradients; requires `var(--...)`) written on day one. **PostCSS-based, new code rather than a port** ([decision 015](decisions/015-token-gate-is-a-parser.md)). Rule set, allowlist and both-directions CI assertion: `43-theming.md` §6.
- Corroboration that this is a real stack and not a bet: TanStack Table 9 and TanStack Query 5 both
  build on tsdown@0.22.14 today; Mantine is on Rolldown 1.1.4.
- **`react-grid-layout@2.2.4` emits no `"use client"` anywhere in its published output** — confirming
  §2's rule that it must be wrapped behind our own boundary in `@gx/grid`.

The CI fixture app stays mandatory regardless. The directive test above passed *today*, at pinned
versions; the fixture is what tells us when an upgrade breaks it.

### 5.1 The rest of the stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Majority pattern among comparables; the Nx preset in the sample is cache-only, which is Turborepo's job. |
| Release | **Changesets** | Used by 5 of 10 comparables; semantic-release and release-please by **none**. |
| Publish | **npm trusted publishing via GitHub Actions OIDC** | Provenance generated automatically, no `--provenance` flag; Changesets' own docs prefer it to staged publishing. |
| PR previews | **pkg.pr.new** | Named in the Changesets docs; ephemeral, and does not pollute version history the way snapshot releases do. |
| CSS | **CSS Modules + `@tsdown/css`** | Per-file CSS is emitted alongside JS under `unbundle`. |

### 5.2 `"use client"` placement — per file, not per package

§2's rule ("only `@gx/react` and `@gx/grid` carry it") is right at *package* granularity but needs a
file-level refinement. Next's docs: *"You only need to add it to the files whose components you want
to render directly within Server Components."* Combined with the directive test above:

- Put the directive at the top of **each public client entry file** (the one exporting `<AutoChart>`,
  the one exporting the grid shell) — not on every internal file, and not once at a package root.
- Build with `unbundle: true` as belt-and-braces: even a non-entry file then keeps its directive.
- ⚠ **Never use `output.banner` to force the directive globally.** It would mark server-safe modules
  as client and destroy the `@gx/primitives` RSC story — the whole point of decision 7.

### 5.3 Per-package packaging

| Package | `"use client"` | `sideEffects` | Notes |
|---|---|---|---|
| `@gx/tokens` | no | `["*.css"]` | Ships a stylesheet; no runtime JS. |
| `@gx/core` | no | **`false`** | Pure. The strict `false` is meaningful here and should be enforced. |
| `@gx/primitives` | **no** | `["*.css"]` | Subpath exports per chart type. |
| `@gx/react` | **yes, per file** | `["*.css"]` | Directive on each client entry. |
| `@gx/grid` | **yes, per file** | `["*.css"]` | Must supply the directive `react-grid-layout@2` lacks. |
| `@gx/testing` | no | `false` | Dev-facing. |

⚠ `sideEffects: ["*.css"]` rather than `false` is the one place strictness is a bug: `false` tells
bundlers a bare `import './chart.css'` is droppable, and the styles silently vanish.

### 5.4 The `exports` map

ESM-only with sibling `.d.ts` lets us use **bare string targets and avoid condition objects
entirely** — so the types-must-come-first ordering rule never gets a chance to bite. This is
`@tanstack/react-table@9`'s shape, extended with CSS:

```jsonc
{
  "name": "@gx/primitives",
  "type": "module",
  "sideEffects": ["*.css"],
  "engines": { "node": ">=20" },
  "exports": {
    ".":              "./dist/index.js",
    "./line":         "./dist/line/index.js",
    "./bar":          "./dist/bar/index.js",
    "./donut":        "./dist/donut/index.js",
    "./styles.css":   "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "peerDependencies": { "react": "^19" },
  "publishConfig": { "access": "public", "provenance": true }
}
```

**No `main`, no `module`, no top-level `types`** — types resolve through the sibling `.d.ts`, which
`node16` and `bundler` both handle. Adding legacy fields reintroduces exactly the ambiguity `exports`
exists to remove.

### 5.5 CI gates, by value per unit of effort

1. **`publint --strict`** — catches a malformed `exports` map before users do.
2. **`attw --pack . --exclude-entrypoints ./styles.css --profile node16`** — the exclusions are not
   optional: a CSS subpath fails attw in *every* resolution mode, and node10 fails for every subpath,
   always. Without them the gate is permanently red and gets disabled.
3. **A real Next.js 16 App Router fixture that imports each package and builds.** Assert the build
   succeeds *and* grep the output for the directive.
4. **Tree-shaking assertion** (§6e) — converts "import one chart, ship one chart" into a gate.
5. **Public-API surface test** (§6e) — the `ts-morph` walk for missing/forbidden exported types.
6. **Token lint gate** — rejects raw colour literals (hex, `rgb()`, `hsl()`, `oklch()`, `lab()`,
   `hwb()`, `color()`, named colours), raw length literals (`px`, `rem`, `em`, `pt`, …), and
   gradients; requires `var(--...)`. Allowlisted only in `packages/tokens/src/themes/**/*.css`, and
   only in custom-property declaration values (`43-theming.md` §6.1). **PostCSS-based, not the ported
   regex script** ([decision 015](decisions/015-token-gate-is-a-parser.md)). ⚠ Run in **both**
   directions: a gate never observed to fail is a job that exits 0 — and the *allow* direction is where
   this one was measured to break, at four false positives in six rejections. ⚠ It is CSS-only, so an
   SVG presentation attribute in TSX (`<line stroke="#ddd" />`) slips through — see §6.2 there for the
   A1 decision that closes it.
7. **`@gx/core` imports nothing from React** — a one-line dependency-cruiser rule protecting the
   single most valuable property in the architecture.

---

## 6. Testing strategy — ⚠ rewritten against `raw/07` §6

The earlier version of this section called testing "unusually tractable" and assigned `@gx/react` to
"browser-mode tests with a real `ResizeObserver`". Both claims survive, but only because of a
constraint I had not accounted for. `07` probed jsdom 29.1.1 and happy-dom 20.11.6 directly rather
than trusting their docs, and found something that lands on the product thesis:

**Neither headless DOM can measure SVG, and they fail in opposite ways.**

| API | jsdom 29.1.1 | happy-dom 20.11.6 |
|---|---|---|
| `text.getComputedTextLength()` | **throws** | returns **`0`** |
| `text.getBBox()` | **throws** | returns all-zeros |
| `path.getTotalLength()` | **throws** | returns **`0`** |
| `svg.getScreenCTM()` | **throws** | identity matrix |
| `ResizeObserver` | `undefined` | `function` — **but never fires** |

jsdom throws loudly; you cannot ship a false green. happy-dom lies quietly: every method exists and
returns zero, so a label-collision routine asked "does this text fit?" concludes **yes, always**. The
test passes and the bug ships. This is confirmed by design, not a gap awaiting a fix — jsdom's README
lists layout as a permanent non-goal, jsdom 30.0.1 has zero files matching `resizeobserver`, and
`SVGGraphicsElement.webidl` has every geometry method commented out.

Two hard consequences:

**6a. `planChart()` must never call a DOM measurement API — this is now a contract, not a
preference.** Text width must come from a character-advance model (font-size × per-character
metrics), because that is pure, testable in bare Node, and works on the server — which decision 7
requires anyway. The jsdom limitation is not an obstacle to route around; it points at the better
design. The corollary is the good news: since the plan is data (decision 8), the responsive ladder is
tested by plain Node unit tests with **no DOM, no shim, no browser**, and that tier carries most of
the weight.

**6b. Never use the environment's built-in `ResizeObserver`. Inject a controllable fake.** In jsdom
it is mandatory because it is absent; in happy-dom it is mandatory for a worse reason. `07` verified
the stub: observe a 400×200 div, change its width to 800px, and the callback fires **zero times** —
not even the initial observation a real browser delivers on `observe()`. `<AutoChart>` would
feature-detect it, find it, take the adaptive path, never receive a measurement, and render its
fallback size forever, green the whole way.

The registry offers nothing healthy — `resize-observer-polyfill` 1.5.1 (2018), `@juggle/resize-observer`
3.4.0 (2022), `jsdom-testing-mocks` 1.16.0 (2025), none with a 2026 release. So `@gx/testing` ships
our own ~50-line fake with an `emit(width, height, options?)` driver. **The point is not the polyfill: it is
that resize becomes an input we control rather than an event we wait for.** Every rung of the ladder
then becomes `emit(320, 180)` → assert the plan.

⚠ **Signature corrected at A5** — this section read `emit(el, width, height)` through A4, after the
sketch in `raw/07` §6.2. The observed element moved into an optional `target` field on a third
argument, because §6b's own point is that there is **one observer per widget**: almost every call site
watches exactly one element and would otherwise have named it on every line. ⚠ **And the entry it
emits was widened at the same time, for a worse reason.** It carried `contentRect` alone, while
`useElementSize` reads `contentBoxSize[0]` first and treats `contentRect` as the fallback — so every
fake-driven test was exercising a branch no real browser takes, green over code nobody runs. That is
the happy-dom failure in §6b arriving through our own front door, and it is why the injected fake is
only half the discipline: **a fake that is easy to control is also easy to make agree with itself
about the wrong thing.** It now emits both boxes from one set of numbers, with the legacy shape
reachable only as `emit(w, h, { legacy: true })`.

Revised tiers:

| Layer | How it is tested | Environment |
|---|---|---|
| `planChart()` | Plain unit tests + **plan snapshots**: a table of `(type, size, shape) → plan`. **The responsive ladder is tested here.** | Bare Node. No DOM at all. |
| Ladder stability | Sweep width up then down across every rung; assert the plan is a pure function of size. | Bare Node. |
| `@gx/primitives` | Render to string; assert structure and token usage. | Node. Hook-free, so no client runtime needed. |
| `@gx/react` | Drive the injected `FakeResizeObserver`; assert the rendered plan. | jsdom + our fake — **never** happy-dom, whose silent zeros make this tier untrustworthy. |
| Real measurement + interaction | Vitest browser mode, Playwright provider. | Real browser. Smallest tier. |
| Visual | Screenshot the *plan fixtures*, not ad-hoc charts. | Real browser, bounded set. |

**Browser tier: Vitest browser mode with `@vitest/browser-playwright`, not Playwright component
testing.** `@playwright/experimental-ct-react` has been **removed and is no longer published**;
the deletion is in `main`'s docs and the 1.63 alpha, with 1.62.1 the last stable. Playwright's own
post-mortem is worth heeding — *"the Node.js/browser boundary leaked … module mocks silently did not
apply"* — and its replacement is a story gallery exposing `window.mount()`, which is Storybook's model
arrived at independently. **That is a strong signal that our `*.stories.tsx` should be treated as test
fixtures, not just docs.** Vitest 4.1.11 shipped 32 releases in 2026 with 5.0.0-rc.2 in flight; one
runner and one assertion API across both tiers. Keep plain `@playwright/test` for full-page e2e.

### 6c. Snapshots — ⚠ my earlier line was half right, for the wrong reason

I had written that snapshotting SVG path strings is "avoided … because it breaks on a rounding
change." `07` counted six libraries and the rounding premise is false, while the conclusion survives
on a better argument.

**The rounding problem is already solved.** `d3-shape@3.2.0` `src/path.js` rounds every generated
path coordinate to **3 decimal places by default** and exposes `.digits(n)`. Decision 5 puts us on
`d3-shape` directly, so we inherit bit-stable path output for free — and should go further and call
**`.digits(2)`** deliberately in our render tree, documenting it. "SVG assertions are brittle" is
folklore, not a fact.

**The real argument is about review, not stability:**

- An **inline expected `d` string is a specification.** When it changes, the diff is in the test file,
  in the PR, and a reviewer must consciously accept new geometry.
- A **`.snap` file is a recording.** When it changes, the fix is `-u`, and nobody reads 459 lines of
  regenerated markup. For a library where the geometry *is* the product, that is the worst failure
  mode available.

The cross-library tally makes the norm unambiguous — **not one of six libraries snapshots composed
chart markup:**

| Library | Runner | SVG snapshots | Exact `d` assertions |
|---|---|---|---|
| d3-shape | mocha, **no DOM at all** | 0 | **348**, via a rounding normaliser |
| Recharts | Vitest + jsdom | 7 of 315 files, leaf primitives only | **669 inline `d:'M…'` literals** |
| visx | Jest + jsdom | 0 | 5, pure geometry only |
| nivo | Jest + enzyme | 27 — of *computed data*, not markup | 0 |
| ECharts | Puppeteer + pixelmatch | no committed goldens | n/a |
| Chart.js | Karma, real browsers | 666 golden PNGs (canvas) | n/a |

Note the shape of that table: **the two libraries with the highest geometry-assertion density are the
two that got the DOM out of the way.** d3-shape has no DOM at all and leads by a wide margin. That is
decision 8's argument arriving from an unrelated direction — a pure `planChart()` returning a plain
object is the most testable artefact in the table.

**Policy:** semantic assertion helpers as the primary tier; `toMatchInlineSnapshot()` for path
geometry; file snapshots only for leaf primitives at fixed sizes; **plan snapshots for the ladder.**

### 6d. Build the `expect*` helper library before the charts

Recharts' `test/helper/` is the single most copyable artefact `07` found. Fourteen domain assertion
helpers — `expectLine`, `expectBars`, `expectAxisTicks`, `expectPieSectors`, `expectScale`,
`expectLegendLabels`, `expectDots`, `expectStackGroups`, … — each querying by semantic class,
projecting to a plain object, and comparing against an explicit expected array:

```ts
export function expectLines(container: Element, expected: ReadonlyArray<{ d: string | null }>) {
  const actual = Array.from(container.querySelectorAll('.recharts-curve.recharts-line-curve'))
    .map(line => ({ d: line.getAttribute('d') }))
  expect(actual).toEqual(expected)
}
```

This is what carries 315 spec files. Write ours first, not after the charts exist.

### 6e. Two CI gates most libraries never build — both directly on our pitch

Recharts' `vitest.config.mts` defines six named `projects`; two run in the **`node`** environment
against the *published artefact*, and both are ours to copy:

- **Tree-shaking as an enforced test.** Iterate every stable exported symbol, bundle it alone, assert
  the resulting component set equals a known-expected set, print a `symmetricDifference` on failure.
  Our packaging pitch is literally *"import one chart, ship one chart"* — this converts that claim
  from marketing into a gate.
- **Public-API surface as an enforced test.** Walk the type graph from `src/index.ts` with `ts-morph`,
  collecting `missingExports` (types referenced by public props but not exported — the classic
  "cannot name the type of this prop" bug) and `forbiddenExports` against a ban list. Cheap, and it
  prevents the most common `.d.ts` papercut.

### 6f. Determinism is a prerequisite, not a nicety

Every library in the table does something explicit about it. The concrete checklist:

- **`process.env.TZ = 'UTC'`** — load-bearing for us specifically: every time-axis chart formats
  through `d3-time-format`, and without a pinned zone the tick labels differ between a contributor's
  laptop and CI.
- **Fake only `requestAnimationFrame`/`cancelAnimationFrame`.** Recharts' comment warns the wider
  Vitest 4 timer surface *"interferes with React scheduling"*.
- `restoreMocks: true` and `unstubGlobals: true` — the injected-`ResizeObserver` pattern in 6b
  depends on both.
- Disable animation in every geometry and screenshot test (`isAnimationActive={false}` appears in 49
  of Recharts' 85 VR files).

**One trap we structurally avoid.** Recharts' `test/README.md` warns that `getBoundingClientRect`
must be mocked *"otherwise nothing renders and nothing happens"* — tooltip, legend and the chart
itself all depend on it. Our static path never measures: `<Chart plan={...}>` is handed its
dimensions. That is a concrete testability dividend of decision 7, worth stating out loud.

### 6g. Visual regression — self-hosted, in Docker, deliberately small

`07` found Recharts running **85 VR specs against 1,149 committed PNG baselines** across three
browsers, in a pinned `mcr.microsoft.com/playwright:v1.62.1-jammy` image, explicitly *"so that we can
have a consistent environment which will allow us to avoid test flakes due to different fonts and box
shadows."* No Chromatic, no Percy, zero marginal cost.

Vitest 4 now ships **`toMatchScreenshot()`** natively (pixelmatch, pluggable comparator), which
collapses the component-level screenshot tier into the same runner — no separate Playwright project.
Two documented traps: Vitest defines **no default tolerance** (use `allowedMismatchedPixelRatio`, so
the threshold scales with image size, not a fixed count), and running `vitest --update` locally
*"defeats the whole point of a controlled environment"* — regenerate baselines from a
`workflow_dispatch`-only CI job. That is the same "determinism comes from the environment, not the
assertion" conclusion Recharts reached with Docker, arrived at independently.

**Our policy:** self-hosted committed baselines, generated in a pinned Docker image,
**chromium-only** to start, `reducedMotion: 'reduce'` set on the context (which doubles as the §7
reduced-motion check). Keep the set deliberate — **one screenshot per chart type per rung of the
ladder**, because that set *is* the ladder's specification and it is the most valuable artefact a
reviewer can look at. Hosted free tiers (Chromatic / Percy / Argos, all ~5,000 snapshots/mo) each
cover only about four full runs of a Recharts-sized suite, which argues for a small set regardless of
route.

**Copy `<ChartSizeDimensions />` early.** Recharts ships a debug-only overlay that draws a measuring
tape plus a text label of the computed width/height into the chart itself, so a pixel diff reads as
*"500 → 480"* instead of an inscrutable smudge. For a library whose entire thesis is size-driven
behaviour, this is close to essential.

**And the correct answer to "how do you unit-test `ResizeObserver`" is: mostly, you don't.** Test the
pure resolver in Node (6a/6b); test the *actual layout response* in a real browser — under hardcoded
sizes, `100%`/`50%` of a fixed parent, a flexbox parent at `flexBasis: 75%`, and aspect-ratio cases —
where the real observer, the real flexbox algorithm and real font metrics all participate. jsdom has
no layout engine, so it cannot answer that question even in principle.

⚠ **Do not adopt `@storybook/test-runner`** — 0.24.4 (2026-05-14) against Storybook 10.5.10, and its
own README now points at `@storybook/addon-vitest`.

---

## 7. Accessibility — a markup decision, not a testing one

`raw/07` §6.6 found that the most widely recommended chart-a11y pattern on the internet **does not
work**, and that the fix constrains what `@gx/primitives` emits. So this belongs here, not in the
testing section.

### 7.1 `role="img"` silently deletes your data table

The standard advice is `<svg role="img" aria-label="…">` with a visually-hidden `<table>` inside for
screen readers. Per the WAI-ARIA Graphics Module (W3C Recommendation, 2018-10-02):

> certain roles, such as `img` or `graphics-symbol`, when assigned to a parent element, **will cause
> all child DOM structure to be omitted from the accessibility tree**.

`role="img"` is *Children Presentational: True*. The table inside is erased. The markup looks right,
**axe passes**, and a screen-reader user gets the label and nothing else.

| Role | Use for | Name required | Children preserved |
|---|---|---|---|
| `graphics-document` | the chart `<svg>` as a whole | **yes** | **yes** |
| `graphics-object` | a series, a group of bars | no | **yes** |
| `graphics-symbol` | a legend swatch, a point marker | **yes** | no — children erased |

**So: `role="graphics-document"` on the `<svg>`, never `role="img"`.** It requires a name *and*
preserves children, so `graphics-object` series and `graphics-symbol` markers stay reachable.

### 7.2 The data table goes *outside* the `<svg>`, in a `<figure>`

W3C WAI's *Complex Images* tutorial independently rules out the other common pattern —
`aria-describedby` pointing at a table — because described-by content is *"treated as one continuous
paragraph of text"*, losing *"structural information, such as any headings and tables"* and the
navigation mechanisms that go with them. It *"only works for long descriptions that are text-only."*

Its recommended structure is a `<figure>` containing the graphic and a `<figcaption>` holding
headings, text and a table. **Two independent lines of evidence converge on the same markup**, which
is a strong signal it is right.

The tutorial also says plainly: **"Make long descriptions available to everyone."** That is a design
instruction, and it fits this library unusually well. A `<details>`-toggled data table inside a
`<figure>` is (a) correct per WAI, (b) useful to sighted users, (c) pure markup with no client JS so
it renders in an RSC — and (d) **it is another rung of the responsive ladder**: shown alongside at
large sizes, collapsed at small. Fold it into `10-responsive-ladder.md`.

### 7.3 What automated a11y checking actually covers — much less than assumed

`axe-core`'s `svg-img-alt` rule has this selector:

```
:is([role='img'], [role='image']), [role='graphics-symbol'], svg[role='graphics-document']
```

**It only matches an `<svg>` that already declares one of those roles.** An unlabelled `<svg>` with
no `role` is never matched, so axe reports nothing and a completely inaccessible chart passes clean.
Only **2 of axe's 105 rules** apply to an SVG chart at all, against a general-case ceiling of *"57%
of WCAG issues automatically"* from axe's own README.

There is a useful inversion here: **adopting the graphics roles is what switches the automated
checking on.** Set `role="graphics-symbol"` on legend swatches and axe starts *requiring* names for
them. The accessibility work and its enforcement arrive together.

Also: **contrast checks do not run in jsdom** (disabled in `jest-axe` for that reason), so the unit
tier gives close to nothing on a11y. It has to happen in the browser tier or it is theatre. And
⚠ **`vitest-axe` is abandoned** — 0.1.0, untouched since 2022-10-21, still widely recommended in blog
posts. Use `@axe-core/playwright` and `@storybook/addon-a11y`.

> **UNVERIFIED:** real assistive-technology support for `graphics-document`/`graphics-object`. No
> current support matrix was found, and Highcharts — the most a11y-invested vendor in the field —
> solves this with a text description, keyboard navigation and a data-table export rather than the
> graphics roles. Treat the roles as the correct semantic floor and the `<figure>` + `<table>` as the
> thing that actually delivers the information. Do not rely on the roles alone.

### 7.4 Reduced motion — opt *in* to animation

WCAG SC 2.3.3 covers this, and chart transitions are squarely in scope: they are triggered by
interaction (a resize, a filter change) and are **never essential to the information**, since the
final frame carries all of it. For users with vestibular disorders the stakes are *"nausea, headaches,
and dizziness."*

Technique C39 specifies a polarity worth getting right:

```css
/* opt IN to motion rather than opting out */
@media (prefers-reduced-motion: no-preference) {
  .series { transition: d var(--gx-motion-duration) ease; }
}
```

Using `no-preference` rather than `reduce` makes **the safe path the default** — an unsupporting
browser, or a user whose OS preference is unset, gets no animation rather than unwanted animation.
For a library that cannot know its consumer's context, that is the correct default.

**Prefer the CSS query over the JS API.** `window.matchMedia` is `undefined` in jsdom, so a
reduced-motion branch cannot even execute in the default unit environment without a stub — and a
naive `window.matchMedia?.(…)` optional-call silently takes the *motion-allowed* path. The CSS query
needs no JS, works in RSC, and is testable via Playwright's `reducedMotion` context option. Same
lesson as §6a: the constraint pushes toward the better implementation. Where JS must branch, inject
the preference as a prop so the pure path stays pure.

**The assertion that matters:** the final rendered state must be **pixel-identical with and without
reduced motion**. Reduced motion must remove the transition, never change the result — that is the
common bug, where the "reduced" path skips a layout step rather than skipping the tween. One
Playwright test per chart type, both contexts, same baseline.

---

## 8. Open items

1. **Name and npm scope.** Everything above says `@gx/*` as a placeholder. Needs deciding before
   any package is published, and the npm scope must be checked for availability.
2. **Token prefix.** `--gx-*` placeholder; pending `raw/06-design-tokens-widgets.md` §6.
3. ~~Hysteresis validation~~ — ✅ resolved in §3.3 against `raw/05`. Containment first, animation
   second, deadband only if flicker survives both.
4. ~~Whether `prevClass` in the resolver is worth the purity cost~~ — ✅ **resolved: no.** Settled in
   §3.3 and `40-chart-plan.md` §9. `planChart()` ships pure. Revisit only if A5 shows flicker, and
   then via `PlanPolicy` rather than resolver state.
5. ✅ Build stack — resolved in §5. ✅ Test stack — resolved in §6.
