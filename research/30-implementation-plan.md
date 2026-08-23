# Implementation plan

Sequenced from `20-architecture.md`. The ordering principle: **prove the thesis end-to-end on one
chart type before building breadth.** Everything before Milestone A is scaffolding; everything after
is repetition of a pattern that Milestone A has already validated.

---

## Milestone A — the walking skeleton (the proof)

**Definition of done:** a line chart in a resizable box. Drag it from small to large and the
information content visibly changes — ticks densify, the legend appears, values get direct labels —
and none of that is hardcoded to a breakpoint. Someone watching says *"oh, I see."*

If Milestone A does not produce that reaction, the thesis is wrong and everything after it is waste.
That is why it comes first.

### A1. Repo foundation
- **pnpm workspaces + Turborepo.** The majority pattern among comparables; the Nx preset in the
  sample is cache-only, which is Turborepo's job.
- TypeScript **6.0.3 — pinned, not 7.x** (`raw/07`: TanStack and Base UI all pin
  6.0.3; tsdown warns TS 7 is experimental). Strict mode. Package skeletons from the architecture graph.
- **Build: `tsdown` with `unbundle: true`, ESM-only.** Not tsup — it is unmaintained and its own
  README points at tsdown. `unbundle` is the *only* config in which `"use client"` survives a
  Rolldown build on a non-entry file, so it is load-bearing for decision 7, not an optimisation.
- **Declare every peer dependency explicitly.** With `unbundle: true` and an undeclared peer,
  Rolldown silently inlines `react/jsx-runtime` into the output.
- Write the token lint gate (rejects raw hex/rgb/hsl colours, raw `px` values, and gradients). Day one, not later —
  it is much harder to retrofit token discipline than to start with it. Three things it needs that
  no seed document specified, all now in `43-theming.md` §6:
  - **The allowlist**, which is narrow in two dimensions at once — `packages/tokens/src/themes/**/*.css`,
    and *only* as the value of a `--gx-*` custom-property declaration. `color: #b4e4fd;` stays rejected
    even inside the tokens file; the gradient ban has no allowlist at all. Without this the gate fails
    on the tokens package on the day it is mandated.
  - **A planted raw hex in a non-allowlisted package**, asserted to fail CI. A gate never observed to
    fail is not a gate.
  - ✅ **SVG presentation attributes — decided.** `<line stroke="#ddd" />` in `@gx/primitives` is
    CSS-shaped but is not CSS, so a gate that parses stylesheets never sees it. **Primitives carry no
    visual attributes at all and take everything from classes** — the same discipline that makes
    per-widget CSS theming work, and it restores the gate's coverage rather than documenting a hole.
- **Linter: ESLint 9, flat config (`eslint.config.js`).** Named here because `pnpm lint` was a CI job
  with no tool behind it. It is specifically what gate **G2** needs — the ban on `getBBox`,
  `getComputedTextLength`, `getTotalLength` and `getBoundingClientRect` inside `@gx/core`
  (`maps/04-ci-gate-map.md`). Flat config over `.eslintrc` because per-package overrides in a
  workspace are plain array entries rather than a cascade, and G2 applies to exactly one package.
  ESLint owns the TS/TSX rules **only** — it does not own the token gate; see below.

⚠ **The token gate is a Node script, not stylelint — and it is not a port.** `20-architecture.md` calls
it *"the ported token lint gate"* and `raw/04:353` names the source: `check-css-module-tokens.mjs`,
~137 lines, three global regexes over whole-file text. It was executed against the rule `43-theming.md`
§6 specifies rather than reasoned about, and it is wrong in **both** directions. Full evidence in
[`decisions/015-token-gate-is-a-parser.md`](decisions/015-token-gate-is-a-parser.md); the two results
that change A1's estimate:

| | |
|---|---|
| **Rejects valid CSS** | Six rejections against a theme file, **two of them correct**. Two false positives are the positional gap (`--gx-series-1: #b4e4fd` is a token definition, not a violation); the other two are a `#ffffffBB` inside a base64 data URI and a `#ff0000` inside a `content` string — regexes failing to parse CSS, nothing to do with the allowlist |
| **Passes invalid CSS** | `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, `color()` and every named colour sail through. ⚠ `DESIGN.md` derives the entire palette in OKLCH, so the notation the gate is blindest to is the one this design system most invites |

**Build it on PostCSS.** Verified by execution: `walkDecls()` returns `prop` and `value` as separate
fields and custom properties arrive as ordinary declarations whose `prop` begins `--`, so §6.1's
positional rule reduces to `decl.prop.startsWith('--gx-')` and both parse-level false positives vanish
without a special case. ⚠ **It is a new dependency** — `@tsdown/css@0.22.14` depends on `lightningcss`
and `postcss-load-config`, so the build's CSS engine is lightningcss and PostCSS is only an optional
plugin pipeline. Taken anyway: `postcss` is three small pure-JS packages against a per-platform native
binary, and the gate is a standalone CI check that should not be coupled to the bundler's engine.

Estimate accordingly: **a PostCSS plugin implementing a positional allowlist over the widened rule set
of `43-theming.md` §6.1a**, not a 137-line copy. Nothing here was unspecified — the estimate was wrong,
which is the harder failure to notice. The one thing worth lifting from the source is its shape:
`rawFontViolations()` already reaches for declaration-level context, which is the tell that the global
regexes were the wrong tool in the original too.

⚠ **The widened rule set has one trap.** `currentColor`, `transparent` and the CSS-wide keywords must
stay permitted — `currentColor` is *mandated* for chrome by `43-theming.md` §3.1. A named-colour list
that swallows them turns a mandate into a violation.

- ⚠ **Determinism preconditions belong in A1's config, before the first test** — they are specified in
  `20-architecture.md` §6a and `maps/04-ci-gate-map.md`, but were not previously sited at a milestone:
  `process.env.TZ = 'UTC'` (d3-time-format tick labels differ between a laptop and CI otherwise);
  fake **only** `requestAnimationFrame`/`cancelAnimationFrame`, because the wider Vitest 4 timer
  surface interferes with React scheduling; `restoreMocks` + `unstubGlobals`, both of which the
  injected-`ResizeObserver` pattern depends on; and **happy-dom banned**, jsdom permitted.

  ✅ **Built and executed.** Three findings from doing it, none of which the spec anticipated:

  1. **A prose comment switched the test environment.** The assertion that `@gx/core` runs without a
     DOM failed on first run — `globalThis.document` was defined despite `environment: 'node'`. The
     cause was a sentence in the test file mentioning the Vitest environment directive while explaining
     when to use it. Vitest matches that directive with a regex over the whole file, comments included.
     Measured at 776 ms of jsdom setup versus 0 ms. Now gate **G16**, which is deliberately stricter
     than Vitest: the directive is an instruction in the header and prose everywhere else.
  2. **`toFake` is inert in the node environment.** Node ships no global `requestAnimationFrame`, and
     fake timers replace globals rather than inventing them. The setting is still correct — it governs
     the DOM tests where frames exist — but frame control could only be proven under jsdom, so the
     assertion moved to a file that has one. Configuring it and never exercising it would have left the
     A6 transition work resting on an untested premise.
  3. **The happy-dom argument is now executed, not asserted.** A test calls `getBBox()` and
     `getComputedTextLength()` under jsdom and requires them to *throw*. That is the entire basis of the
     ban — jsdom throws, happy-dom returns `0` — and it had only ever been written down. Gate **G15**
     backs it as a dependency-graph fact, checking manifests *and* the lockfile, since a transitive pull
     is enough for Vitest to resolve the shim by name.

- ⚠ **Node 22 is the floor, and dev tooling sets it, not the library.** `dependency-cruiser@18` — the
  only current major — declares `^22||^24||>=26`. That excludes Node 20 (EOL April 2026) and Node 25
  (odd-numbered, skipped), so gate **G1** fails at *startup* with a version error rather than a
  dependency error on both. Resolved by raising `engines.node` to `>=22`, recording the narrower tooling
  range in `devEngines.runtime` with `onFail: "warn"`, and pinning CI to **Node 24**. Shipping a
  consumer floor at an already-EOL runtime was a defect independent of the tooling, so the two agree now
  rather than needing to be reconciled later.

  ⚠ **Consequence for local development:** on Node 25 `pnpm lint:deps` refuses to run at all. `pnpm
  verify` cannot complete on such a machine. Use Node 22 or 24 — `npx node@24` is enough to reach a
  supported runtime without a global install.

⚠ **The class-only rule is one of two, not one.** It fixes *authored* presentation. It does **not**
fix the platform: `x1`/`y1`/`x2`/`y2` on `<line>` are not CSS-settable in any browser, so a class
carrying `y2: var(--gx-tick-length)` also does nothing. Both failures have the same shape — a token
that looks like it works and quietly doesn't — but only the first is an A1 concern. The second is the
element-choice rule in [`decisions/012-no-line-element-for-tokened-geometry.md`](decisions/012-no-line-element-for-tokened-geometry.md),
and it binds at **A4**, when `@gx/primitives` is written.

- CI: typecheck, lint (ESLint 9), token gate, test. Nothing else yet. ⚠ **The gate is planted in both
  directions** (`43-theming.md` §6.3) — a raw hex in a non-allowlisted package asserted to fail, *and* a
  fixture theme file asserted to pass clean. The second is not ceremony: the measured failure mode is
  four false positives in six rejections, so the fixture carries the cases that broke it — a token
  definition, a `calc()` multiplier, a unitless `0`, a `currentColor`, and a data URI.
- Decide the name and claim the npm scope. **Blocking for publish, not for code.**
- ✅ **Licence: MIT.** Decided 2026-08-23 rather than left implicit. It was never stated in the corpus,
  but it was assumed throughout — `raw/03` evaluates the entire charting field *"for an MIT,
  presentational-only… library"*, which is the brief the build-vs-adopt call was made against, and
  `PRODUCT.md` says "open-source" without qualification. MIT is what the research already assumed, and
  nothing in the design needs more. Goes in `package.json` and a root `LICENSE` from the **first**
  commit rather than being retrofitted across seven; `publint` flags a missing `license` field at E3
  regardless. ⚠ The copyright holder line is blocked on the project name — same unblock, one edit.
  Apache-2.0 is the only alternative worth a second thought (explicit patent grant); it is heavier than
  a presentational chart library needs, and choosing it later is a relicence, so it is named here and
  declined rather than left open.

### A2. `@gx/core` types
- `SizeContext`, `DataShape`, `ChartPlan`, `ChartType`, `PlanOverrides`, `PlanPolicy`, `FontMetrics`.
  **`ChartPlan` is fully specified in `40-chart-plan.md` §3–§4** — field list, per-field provenance
  tier, and the six line/area rungs hand-authored — so A2 transcribes a settled contract rather than
  inventing one under scaffolding pressure. `planChart()` takes **five** parameters:
  `(type, ctx, shape, policy?, overrides?)`; `policy` carries thresholds *and* `fontMetrics`, applied
  before resolution, and `overrides` is forced after it.
- `resolveSizeClass()` — the six size families, anchored to the published plot-height boundaries
  (6 / 24 / 40 / 80 px), not to invented numbers.
- `measureText()` from a **character-advance model** (font-size × per-character metrics table). ⚠ Now
  a hard contract, not a convenience: `@gx/core` may not touch `getComputedTextLength`, `getBBox`,
  `getTotalLength` or `getBoundingClientRect`. jsdom throws on all of them; happy-dom returns `0` for
  all of them, which silently means *"every label fits"* — a label-collision test would pass forever
  while shipping the bug. See `20-architecture.md` §6a.
- ⚠ **The metrics table is a plan input, not a hidden constant** (`41-text-metrics.md`). Six CSS
  properties change the outcome of a fit-or-collide decision — `font-family`, `font-size`,
  `font-weight`, `font-feature-settings`, `font-stretch`, `letter-spacing` — so all six are typed
  values on `PlanPolicy`, and `@gx/tokens` *generates* their CSS custom properties from those typed
  objects. One authored value, two emitted forms; a consumer cannot move one without the other.
  Signature: `measureText(text, rank, metrics, letterSpacing?)`. The table is keyed **by type rank**
  (A–E), not by font size, because the scale ships weights 400/500/700 and `wght` changes advances.
- ⚠ **Two things block table generation, not merely documentation** (`41-text-metrics.md` §4.1, §4.2):
  whether Roboto Flex actually ships `tnum` (inspect `GSUB` on the released TTF — `fonttools ttx -t GSUB`),
  and the `safetyFactor`, which must be calibrated against the fallback stack the library will
  actually hit (SF, Segoe UI Variable, Roboto, DejaVu Sans) because the library must not ship the font.
  Where `measureText()` is inexact it must err **wide**.
- No React anywhere. Enforced by a dependency-boundary lint rule, not by convention.

### A3. `planChart()` for line/area only
- Implement the ladder rungs from `10-responsive-ladder.md` for one type. **Per-rung complete specs,
  not diffs** — the corpus study documents content that appears *only* at small sizes.
- Ticks: `max(2, round(width / 100))`. ⚠ No upper cap — the earlier `clamp(floor(width/90), 2, 8)`
  was wrong on both the divisor and the cap.
- Label degradation in the published order: `abbreviate → split → rotate → transpose`.
- Every threshold carries its **provenance tier (A/B/C)** in the source, so the docs can state which
  numbers are research and which are taste.
- **Plan snapshot suite**: a table of `(size, shape) → plan` swept across widths.
- **Stability test** (⚠ renamed from "monotonicity" — the ladder is deliberately non-monotonic):
  sweep width up then down across every threshold and assert the plan is a pure function of size —
  the same width yields the same plan regardless of approach direction. Any asymmetry means we have
  accidentally introduced state.

At the end of A3 the core thesis is testable with zero UI. That is the point.

### A4. `@gx/primitives` — line renderer
- Hook-free SVG: `<Chart>`, `<Axis>`, `<Grid>`, `<LinePath>`, `<AreaPath>`, `<PointMarks>`, `<Labels>`.
- Steal, as decided: visx's `tickLineProps` / `tickLabelProps`-as-function pattern and the
  `children: (ticks: ComputedTick[]) => ReactNode` render prop. Observable Plot's `tickSpacing`
  (px budget) alongside `tickCount` — the px budget wins at small sizes.
- Call **`.digits(2)`** on every d3-shape generator and document it. d3-shape rounds to 3 decimals by
  default, which is what makes exact `d`-string assertions viable at all; tightening to 2 is free
  determinism. This is a deliberate choice, not an incidental one.
- ⚠ **Accessible markup is part of the render tree, not a later pass** (`20-architecture.md` §7):
  `role="graphics-document"` on the `<svg>` — **never `role="img"`**, which is Children Presentational
  True and erases everything inside it from the accessibility tree. The data table goes in a
  `<figcaption>` *outside* the `<svg>`, inside a `<figure>`. Pure markup, no client JS, renders in RSC.
  Retrofitting this later means rewriting every component's root element.
- Build the **`expect*` semantic assertion helpers** alongside — `expectLine`, `expectAxisTicks`,
  `expectBars`, `expectScale`. Recharts runs 315 spec files on this pattern; write ours before the
  charts multiply, not after.
- ⚠ **Never emit `<line>` for geometry a token controls** — `x1`/`y1`/`x2`/`y2` are not CSS-settable
  in any browser, and none is planned. `<rect>` for ticks and gridlines (`width` = stroke thickness,
  `height` = tick length, both plain CSS lengths), `<path>` where a path already exists. This is baked
  into `Axis` and `Grid` **here**, at A4, because discovering it at B1 means rewriting the render tree
  with thirty tokens already documented as working. Full evidence and the two alternative
  substitutions: [`decisions/012-no-line-element-for-tokened-geometry.md`](decisions/012-no-line-element-for-tokened-geometry.md).
  - The token lint gate **cannot** catch this in either direction — it checks that a `var()` was used,
    not that the property it lands on exists. Add gate **G14**: an element-set snapshot per chart type,
    so a `<line>` appearing where a `<rect>` was is a reviewable diff rather than a silent regression.
- **RSC fixture app** in CI: a Next.js 16 App Router page rendering `<Chart plan={...}>` in a server
  component with JS disabled, asserting the SVG is in the HTML. This is the test that protects
  decision 7 from being silently broken by a bundler upgrade. **Next.js appears here as a fixture
  only** — nothing under `packages/` may import from `next/`.

### A5. `@gx/react` — `<AutoChart>`
- `useElementSize()` — `ResizeObserver`, `contentBoxSize`, rAF-batched.
- `<AutoChart>` = measure → `planChart()` → `<Chart>`. Nothing else.
- SSR emits a plan for a declared initial size so first paint is correct and does not flash.
- ⚠ **Write our own `FakeResizeObserver` in `@gx/testing` before writing this component.** Every
  registry option is stale (newest is 2025), and more importantly happy-dom's built-in is a no-op
  stub that *never fires* while still passing `typeof === 'function'` — so `<AutoChart>` would
  feature-detect it, take the adaptive path, never get a measurement, render its fallback forever,
  and go green. Tests must **drive** resize via `emit(el, w, h)`, never wait for it.
- ⚠ **Containment rule enforced here**: the measured box's size must be grid-determined, and the
  plan may only touch descendants. Ship the CI test that drags across every rung boundary and asserts
  the `ResizeObserver` loop error never fires. (This one needs a real browser — the fake cannot
  produce the loop error.)

### A6. Transitions ⚠ (new — was missing entirely)
- Animate rung changes rather than cutting. ~300 ms for rescale-only, up to ~1000 ms when marks move.
  The 1000 ms upper bound is **A-lit and A-impl at once**: Heer & Robertson 2007 measured it, and
  Adobe Spectrum ships `DRAW_IN_ANIMATION_DURATION_MS = 1000`. Independent agreement to the
  millisecond — cite both.
- Two-stage at most: axis/ticks first, marks second.
- Persist gridlines through a tick-count change — they are the landmarks that make it legible.
- Honour `prefers-reduced-motion`: cut, and skip staging.
- **This is the primary hysteresis mechanism**, not a deadband. Measure whether flicker is still
  observable afterwards; only then consider a deadband, expressed as a fraction of the boundary
  width, never as an absolute px value.

**→ Milestone A demo: one resizable box, one line chart, visible semantic adaptation.**

---

## Milestone B — the visual control surface

The second half of the thesis: *granular control over every stroke, gap, and tick.*

### B1. Full token tree
`raw/06` §6 delivered **183 fully specified tokens** — each with a default, a provenance tier and a
named primary source — across **234 distinct `--gx-*` names** appearing in the document. ⚠ The gap of
51 is not slack: those are names referenced in prose, `var()` fallback chains and CSS examples but
never given a row. **Every one of the 51 must either get a specified row or be deleted before the
tree ships**, because an undefined `var(--gx-…)` in our own stylesheet resolves to nothing and fails
silently. Make that a build-time check, not a review item: the generator emits the token set, so a
script can assert that every `--gx-*` occurrence in any authored CSS is a member of it.

Groups: canvas/surface, grid+axis, marks (line/area/bar/point/arc), labels, legend, tooltip/crosshair,
motion, plus the responsive-threshold tokens the ladder consumes. Distribution is uneven and that is
informative — `arc` (37) and `legend` (21) carry the most because they are where the field is weakest
(see B2), `surface` (5) the least because a rectangle has few knobs.

- **Naming rule** (so it survives the rename): `--<prefix>-<group>[-<element>]-<property>[-<modifier>]`,
  with `<group>` drawn from a closed set of **English chart vocabulary** — `surface`, `plot`, `axis`,
  `tick`, `label`, `line`, `area`, `bar`, `point`, `arc`, `legend`, `tooltip`, `crosshair`, `motion`,
  … — never product vocabulary, so group names never change with the product name.
- Prefixing is not stylistic: **CSS custom properties are global and inherit**, so an unprefixed
  `--grid-color` in a consuming app's `:root` would silently retheme our charts. There is no scoping
  mechanism; the prefix *is* the namespace. Precedent: Highcharts `--highcharts-*`, Carbon `--cds-charts-*`.
- Author in TypeScript, generate CSS. Type token names as a template literal
  `` type Token = `--${Prefix}-${TokenName}` `` so a prefix change propagates through the type system
  and every consumer gets a compile error rather than a silent no-op.
- Dimensions carry their unit in the value (`2px`, never `2`) because `calc()` requires it; ratios and
  counts are documented as unitless and never given one.
- Light and dark palettes, colour-blind-safe categorical ramp. Colour is already well solved by
  Carbon and Spectrum — we add structure (slot tokens, length variants, redundant-encoding ramps),
  not new palettes.

⚠ **Review defaults by composition, not only by token.** `10-responsive-ladder.md` §6.1 documents a
case where two individually-citable Tier A defaults (`grid-color: #ddd` from Vega/Nivo, `grid-opacity:
0.2` from Heer & Bostock) multiply into an invisible gridline. Any token pair modulating the same
perceptual channel — colour × opacity, stroke width × dash, font size × weight — needs a composed
check. Two good citations are not evidence that the pair is right together.

⚠ **`raw/06` §6.9 carries ~29 threshold tokens forward from `raw/05` with a `--chart-*` → `--gx-*`
mapping table.** Tiers are unchanged in the carry-over, and **`raw/05` remains the authority** for
those values — if the two ever disagree, `05` wins and `06`'s copy is the stale one. Better still,
generate `06`'s table from `05` rather than maintaining a second copy.

⚠ **Six items the agent flagged as UNVERIFIED rather than guessing**, and which must not be given a
Tier A label on the strength of looking plausible: `--gx-motion-easing`; the `--gx-axis-translate`
half-pixel default; Spectrum's named dash-ramp arrays; `--gx-widget-gap`; `--gx-plot-border-width`;
and `--gx-line-join` — where **ECharts verifiably ships `bevel`**, contradicting the agent's own
preferred `round`. That last one is the useful shape of the whole exercise: the verified answer
disagreed with the intuitive one, which is exactly why the tier is worth the effort.

### B2. Prove we exceed the field
`raw/06` §7 produced the granularity table across ten libraries. **Every ● in that table becomes a
token or a plan field, or we write down why not.**

Prioritised from its "honest read":

- **Two cheap wins where the entire field is weak.** *Legend item gap* — Recharts hard-codes it
  inline, Plot has no knob at all, Carbon doesn't expose it. *Label halo* — only Nivo exposes it
  properly (width + colour + opacity); Highcharts has one compound string, Spectrum a private constant.
- **The best-of set — eight knobs, each currently in exactly one library.** Collecting them in one
  coherent namespace is genuinely novel, but it is *curation, not invention*, and should be described
  that way: dash **phase** per guide element (Vega-Lite), stroke **cap** per guide element
  (Vega-Lite), pixel-density tick spacing with **separate x and y** (Plot), point auto-hide on
  density (Highcharts), band-cell start/end positions (amCharts), series-count-aware bar gaps
  (ECharts), size-tiered stroke/point/gap (Spectrum), three-part label halo (Nivo).
- **Copy most of Vega-Lite's axis API.** It is the best in open source — 70 documented properties
  including `labelFlush`/`labelFlushOffset`, `labelBound`, `tickBand`, `tickExtra`,
  `minExtent`/`maxExtent`, `translate`. Not beating it is fine; not learning from it is not.

### B3. Threshold tokens
Every number in the ladder — tick spacing budget, aggregate-after count, minimum cell size, point
budget — is a token, not a constant. A consumer who disagrees with our taste can retune the
adaptation without forking.

⚠ **These are TypeScript token objects, not `--gx-*` custom properties.** They are arguments to a
pure function, so they must be serialisable and identical on server and client. A CSS custom property
can only be resolved by `getComputedStyle` in a browser — reading one into `planChart()` would give
the server one plan and the client another, i.e. a hydration mismatch on every chart. Presentation
tokens (stroke, colour, radius, gap, duration) stay in CSS, where per-widget override is free. See
`20-architecture.md` §3.2 for the full split.

⚠ **Each token ships with its provenance tier** — and `raw/06` §6.1 sharpened the scheme in a way we
should adopt everywhere. Tier A splits in two, because the two kinds of "verified" are not the same
kind of evidence at all:

| Tier | Means | Example |
|---|---|---|
| **A-lit** | Research literature or a W3C/CSS spec. Evidence about **human vision**. | `grid-min-spacing: 8px` (Heer & Bostock 2010); `plot-height-saturation: 80px` |
| **A-impl** | Verified source of a shipped library. Evidence about **convention**. Note where ≥3 independent libraries agree — convergence is the only extra evidence available. | `grid-width: 1px` (Vega, Nivo, visx, ECharts, Highcharts all `1`) |
| **B** | Ours, but consistent with published work — inside a range where the field disagrees, or a straightforward derivation. | `grid-minor-opacity: 0.5` |
| **C** | Pure invention. May still be right; the docs must not imply a source. | `widget-gap: 16px` |

**Why the split matters:** four libraries defaulting line stroke to `2px` tells you what looks
*normal*, not what is *legible*. Collapsing both into one "Tier A" would let convention masquerade as
perception research — exactly the overclaim the tier system exists to prevent. Where the field
disagrees materially, publish the spread rather than hiding it behind one number.

---

## Milestone C — the grid

### C1. `@gx/grid` on `react-grid-layout@2/core`
- 12 columns, four-corner resize handles, vertical compaction.
- **Per-widget minimum sizes** — the gap in the reference implementation.
- Each widget receives its own `SizeContext`. The grid does not decide chart content; it only reports
  size. Keeping that boundary clean is what makes widgets reusable outside the grid.
- Pin away from `2.2.0`.

### C2. Widget chrome
Header, value slot, footer, padding, corner radius, border treatment — the "widget look", tokenised.
Informed by the widget/bento research in `raw/06`.

---

## Milestone D — breadth

Only now. One chart type at a time, each following the A3→A4 pattern: ladder first, snapshots second,
renderer third.

Priority order, by how much the responsive thesis pays off per type:

1. **Bar / column** — transpose to horizontal is the most dramatic adaptation in the set.
2. **Donut / pie** — the reference implementation's own money shot: Reflow + Reveal + Aggregate at once.
3. **KPI / number** — the micro end; proves the ladder works at 1×1.
4. **Scatter** — the point-budget and renderer-substitution case.
5. **Activity heatmap** — the binning case (daily → weekly below minimum cell size).
6. **Funnel, progress, sparkline** — straightforward once the pattern is set.

---

## Milestone E — ship

### E1. Docs site
- **Fumadocs**, on Next.js 16 / React 19. `raw/07` §7 checked the docs app's `package.json` in nine
  comparables: **exactly one uses a docs framework at all** (shadcn/ui → Fumadocs); everyone else
  hand-rolls. Of the named alternatives, **Nextra has shipped nothing in 2026** and **VitePress's
  stable line is a year old**; Fumadocs shipped 91 releases in 2026 and its peer deps are exactly
  `next: 16.x.x` / `react: ^19.2.0`.
- **No playground library.** Sandpack, react-live and react-runner are all dormant (zero 2026
  releases each); react-live cannot resolve modules at all, so `import { LineChart } from '@gx/primitives'`
  simply cannot run, and react-runner's peers exclude React 19. Use **Shiki** for static code plus
  **`@stackblitz/sdk`** for "open in a real editor" — the pattern Radix and Recharts both use.
- **`<ResizeLab>`** — the hero component: drag a chart and watch the live `SizeContext` and a diffed
  `ChartPlan` update beside it. This is the single page that has to land the thesis.
  ⚠ It must **not** read the CSSOM per pointer move — see B3's token split; that would force style
  recalculation on every frame and make the hero demo janky.
- ⚠ **Do not use CSS `resize: both` for the drag handle.** `raw/07` verified against caniuse-db that
  it is **unsupported on every iOS Safari version through 26.5** (desktop Safari is fine). The
  one-line solution silently breaks on every iPhone — on the one page carrying the library's entire
  argument. Build a `setPointerCapture` handle instead. Container queries are safe (93.96%, iOS 16+).
- **No charting library in the sample ships drag-to-resize demos.** This is a differentiator, not a chore.

### E2. The responsive-semantics page
A dedicated page documenting every rung of every ladder, with its provenance tier. The reference
implementation documents *none* of this; the gap is our opening and it should be the best page on
the site. The VRT baseline set (one screenshot per chart type per rung) *is* this page's illustration.

### E3. Release
- Changesets, npm trusted publishing via GitHub Actions OIDC, pkg.pr.new for PR previews.
- `publint --strict` and `attw` in CI, with the CSS-subpath exclusions from `20-architecture.md` §5.5.
- `0.x` until the `ChartPlan` shape has survived contact with real consumers. It is the public
  contract of the whole library, and the thing that will be hardest to change later.

---

## Sequencing risks, honestly stated

| Risk | Where it bites | Mitigation |
|---|---|---|
| The ladder feels *arbitrary* rather than *inevitable* to users | Milestone A demo falls flat | ✅ **Largely retired.** `raw/05` grounded the size families in published plot-height results (24 / 40 / 80 px) and gave 16 Tier-A citable tokens. The residual risk is now confined to Tier C, and shipping the tier labels turns that residue into visible rigour. |
| `"use client"` gets stripped by the bundler | Silently, at any release | ✅ **Understood, not merely feared.** `raw/07` tested it: Rolldown strips the directive from any non-entry module it bundles, and preserves it per-file under `unbundle: true`. That config is now mandatory (A1). The CI fixture app in A4 remains the regression guard — assert on built output, never trust a changelog. |
| We rewrite axis tick math badly | Milestone A4 | Accepted cost of decision 5, and known: visx's `AxisBottom` edge cases (`rangePadding`, `hideZero`, orientation sign) are the specific things to get right. |
| ~~d3's ESM-only publish causes consumer pain~~ | — | ✅ **Dissolved.** We ship ESM-only ourselves (`20-architecture.md` §5), so d3's ESM-only publish is no longer an asymmetry we have to bridge. `victory-vendor` and `@visx/vendor` exist to solve a problem we opted out of having. |
| Scope creep into data fetching | Continuously | Decision 2 is load-bearing. Presentational only. |
| ⚠ A plan change alters the size of the box being measured | Anywhere, as an infinite `ResizeObserver` loop | The containment rule (`20-architecture.md` §3.3) plus the loop-error CI test in A5. A deadband cannot fix this class of bug — only structure can. |
| ⚠ Tier A tokens are angular-size claims in pixel clothing | Print, kiosk, or high-DPI output | Heer 2009 publishes in mm, Talbot 2010 in labels-per-inch. Document the assumption now; add a density multiplier only if a real consumer needs it. |
| ⚠ **A headless DOM reports that every label fits** | Any label-collision or tick-density test, silently green | happy-dom returns `0` from every SVG measurement API and never fires `ResizeObserver`. Mitigation is structural: `planChart()` may not call the DOM at all (A2), and resize is an injected input (A5). Ban happy-dom from this repo — jsdom's loud throw is the safer failure. |
| ⚠ **Playwright component testing is being deleted** | If we adopt it now | `@playwright/experimental-ct-react` is removed in `main` and the 1.63 alpha; 1.62.1 is the last publish. Use Vitest browser mode + `@vitest/browser-playwright` instead, and treat `*.stories.tsx` as test fixtures — Playwright's own replacement converged on exactly that model. |
| ⚠ **Two citable defaults compose into a wrong result** | Anywhere in the token tree, and it looks *more* rigorous than a guess | Found live: `grid-color: #ddd` (Vega/Nivo) × `grid-opacity: 0.2` (Heer & Bostock) = invisible gridline, both labelled Tier A. Provenance is per-token; correctness is per-composition. Review any pair modulating one perceptual channel together. See `10-responsive-ladder.md` §6.1. |
| ⚠ **A verified source is wrong for our case** | Silently, wherever we defer to convention | Spectrum scales stroke width *down* at small sizes, against Okabe–Ito and CSS optical sizing. We diverge deliberately (§6.2) and document the disagreement. The tier label answers *"where did this come from?"*, never *"is this right?"* — treat A-impl as a strong prior, not an authority. |

---

## Immediate next actions

1. ✅ `raw/05` landed — the ladder is reconciled (`10-responsive-ladder.md` v2).
2. ✅ `raw/07` landed in full (1,129 lines). The build stack (tsdown + `unbundle`, ESM-only, TS 6.0.3),
   the test stack (bare Node for the ladder, injected fake RO, Vitest browser mode), the accessibility
   markup and the docs-site choice are settled and folded into `20-architecture.md` §5–7 and E1.
3. ✅ `raw/06` landed in full (1,967 lines / 131 KB). The `--gx-*` token tree and the ten-library
   granularity comparison are folded into B1–B3 and `00-decisions.md`. **All research streams are
   now closed.**
4. **Decide the name and npm scope.** Now the only thing blocking publish, and cheaper than it looks:
   `raw/06` §6.0 verified the prefix appears *only* as the first path segment (0 hits elsewhere), so
   the rename is one regex, one generator constant, and one template-literal type. Still blocking for
   publish, not for code.
5. **Start A1.** Nothing is blocked any more.
6. Optional, later: retrieve Talbot, Setlur & Agrawala 2014 *Four Experiments on the Perception of Bar
   Charts* from ACM DL — the most likely published home for a minimum bar width, which is currently
   Tier C.
