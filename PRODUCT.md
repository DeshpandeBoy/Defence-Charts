# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Greenfield monorepo, no code written yet (research-only phase). Settled by `research/00-decisions.md` and `research/20-architecture.md`:

- Open source, npm, scoped packages (`@scope/tokens`, `@scope/core`, `@scope/primitives`, `@scope/react`, `@scope/grid`, `@scope/testing`) — name/scope itself is undecided, see Capabilities and Constraints.
- Build: `tsdown` with `unbundle: true`, ESM-only. TypeScript pinned to **6.0.3** (not 7.x).
- Chart math/drawing: raw `d3-scale@4`, `d3-shape@3`, `d3-array@3`, `d3-format`, `d3-time-format` — no visx, Recharts, or ECharts.
- Grid engine: adopts `react-grid-layout@2`'s framework-agnostic `./core` subpath (pinned away from `2.2.0`, a known layout bug).
- Theming: CSS custom properties (`--gx-*` placeholder prefix) + matching TypeScript token types. No runtime style provider, no Tailwind dependency. Two themes ship — "The Emission-Line Rail" as the default and a neutral escape hatch resetting to field-convention defaults — selected by class or stylesheet import, never by a JS prop.
- Conventions: React 19, TypeScript, CSS Modules with design tokens, Storybook, Playwright, Vitest, Changesets releases.
- ⚠ **Next.js 16 is a consumer convention and a test fixture, not a dependency.** The library is
  framework-agnostic React. Next appears in exactly three places: the RSC fixture app CI renders at
  A4/A5, the Fumadocs docs site at D, and the environment consumers are assumed to be in. Nothing
  under `packages/` may import from `next/` — if `@gx/react` ever did, decision 7 (RSC-safe render,
  zero JS) would be a Next.js feature rather than a property of the library.
- Test stack: bare Node for the core "ladder" logic, an injected `FakeResizeObserver` (not jsdom/happy-dom's), Vitest browser mode via `@vitest/browser-playwright` for the tier needing a real browser. **happy-dom is banned**; jsdom is permitted.
- Token discipline: lint gate rejects raw hex/rgb/hsl colours, raw `px` values, and gradients; requires `var(--...)`. Runs from day one, with a narrow allowlist for the tokens package itself — the one place literal values must live (`research/43-theming.md`).

## Users

Frontend/app developers who embed charts and dashboard widgets into their own products, and drag/resize them in a grid layout. The library is presentational only — the consumer supplies already-shaped data; the library never fetches, queries, persists, or otherwise owns data.

## Product Purpose

A chart + grid widget library where a chart changes **what information it shows**, not just its pixel dimensions, as the space it's given changes ("the responsive ladder"). Paired with deep, per-widget, CSS-level control (~183 named tokens) over every stroke, gap, tick, and colour. Success looks like: a widget dragged smaller becomes a genuinely different, honest chart rather than an unreadable shrunken one, and any single widget can be restyled from a stylesheet with no JS and no re-render.

⚠ **Six of those tokens are the exception, and the exception is load-bearing.** `font-family`, `font-size`, `font-weight`, `font-feature-settings`, `font-stretch`, and `letter-spacing` change the outcome of a fit-or-collide decision, so overriding them in CSS alone would let the planner keep predicting labels fit while the browser collides them (`research/41-text-metrics.md` §2). They are authored as typed values and their custom properties are *generated* from those values, so the two cannot drift. Everything else — every colour, length, opacity, dash, radius — restyles from CSS exactly as claimed.

## Positioning

The combination of three things, none of which coexist elsewhere in the charting field (per `research/00-decisions.md` and `raw/06`). **Ordered by how well each survives scrutiny — the ladder leads, and that is a deliberate inversion of earlier positioning advice** (`research/decisions/013`, `014`):

1. **A genuine responsive information ladder** — six size families (Micro/Tile/Strip/Panel/Canvas/Stage) where a chart reveals, conceals, relabels, aggregates, or substitutes content based on published human-perception research, not just rescaling. Only Carbon and Spectrum do anything with size today, and both only rescale. **This is the one claim with no credible prior art in a shipping library.**
2. **Plan-as-data architecture** — a pure `planChart()` function (size + data-shape description + preferences → a plain serialisable `ChartPlan` object) is fully decoupled from a hook-free `<Chart>` renderer. This is what lets a chart render on the server with **zero JavaScript** *and stay themeable after render*. Both halves are needed: Vega's `toSVG()` is zero-JS but bakes presentation into attributes, so it is inert; nivo fails at import inside an RSC; Observable Plot returns a DOM node and structurally cannot. **visx is the honest near-miss** — hook-free, no `"use client"`, and it renders in an RSC today at 124 B of page JS — but it has no planner and no size-awareness.
3. **Chart geometry themeable via plain CSS custom properties**, per widget, with no re-render. ⚠ **The weakest of the three, and it must be stated narrowly.** Highcharts styled mode already exposes stroke width, dash, gridline width, tick colour and width, and typography, and ships `--highcharts-color-{n}`. What holds against it: one namespace covering every knob rather than a colour-indexed subset, and per-widget scope on a shared dashboard. What also constrains it: `x1`/`y1`/`x2`/`y2` on `<line>` are not CSS-settable in any browser, so geometry-via-CSS is real but only on a restricted element set (`research/decisions/012`).

⚠ **Zero of the 11 libraries audited ship a `"use client"` directive** — that statement is verified and defensible. The stronger version, *"none of the eleven can render server-side with zero JS"*, was tested empirically on 2026-08-23 and is **false**; do not use it. The wording that survives: *the first planned, size-adaptive chart library that renders with zero JS and stays themeable after render.* Re-run those four tests before any public launch — the field moves and the result has a shelf life.

Explicitly **not** the differentiator: raw knob count (Highcharts has more), axis-API richness (Vega-Lite's is better and should be partly copied), or server-side SVG on its own (table stakes).

## Operating Context

Research phase — still no code or `package.json`. `research/` plus `DESIGN.md` are the complete input to the build. Decisions were confirmed on 2026-08-22 (`research/00-decisions.md`); the visual world was seeded the following day (`DESIGN.md`).

A readiness review on 2026-08-23 found Milestone A1 genuinely unblocked but three specifications missing that A2–A4 depend on, two of which *read* as though they existed (the plan pointed at a document; the document did not contain the thing). Those gaps are now closed by documents, not code:

- `research/40-chart-plan.md` — the `ChartPlan` field contract. `research/20-architecture.md` previously deferred the field list to `10-responsive-ladder.md`, which had none. This is the library's public contract and the reason for staying on `0.x`.
- `research/41-text-metrics.md` — `measureText()` and font metrics as a **plan-input** token. Previously a correctness bug rather than a gap: `font-family` was classed presentation-only, so a consumer swapping in a wider face would move rendered text width while the planner kept its built-in table — the plan says the labels fit, the browser collides them.
- `research/42-typography.md` and `research/43-theming.md` — one reconciled type scale, and the two-theme token architecture.

The next concrete step is Milestone A1 (a single line chart, in a draggable box, proving the core idea end-to-end before any breadth).

A from-scratch, standalone public open-source npm project, **MIT licensed** — not derived from or dependent on any other codebase. The primary evidence/reference product studied throughout research is Basedash (demo video + frame-by-frame analysis in `research/00-source-analysis.md` and `research/assets/`) — treated as a studied reference and a source of anti-patterns to avoid (e.g. its single 480px breakpoint), not as a product to imitate wholesale, and not a dependency of any kind.

⚠ **MIT was decided on 2026-08-23, having been assumed rather than stated for the whole research phase** — `research/raw/03-landscape-charting.md` evaluates the entire charting field *"for an MIT, presentational-only… library"*, which is the brief the build-vs-adopt call was made against. It ships in `package.json` and a root `LICENSE` from the first commit. The copyright holder line is blocked on the project name, which is the same unblock.

## Capabilities and Constraints

- **Presentational only.** No fetching, no SQL, no AI, no persistence.
- **Six packages, strict dependency direction:** `tokens → core → primitives → react → grid`.
  - `core` ("the brain": `planChart()`, scales, tick math) **must not** import React or touch the browser/DOM at all — enforced by an automated CI check.
  - `primitives` (`<Chart>`, `<Axis>`, `<Grid>`, `<LinePath>`, `<Bars>`, ...) are pure SVG, no state/effects/refs, RSC-safe.
  - `react` (`<AutoChart>`, tooltips, crosshairs, brushing, clickable legends) is the only client-only (`"use client"`) layer.
  - `grid` is the 12-column dashboard shell; it only ever reports box size to a widget, it never decides what the widget shows. Per-widget minimum sizes are a deliberate addition Basedash lacks.
- **No DOM measurement in the planner.** `planChart()` may not call `getComputedTextLength`, `getBBox`, `getTotalLength`, or `getBoundingClientRect`; text width comes from a character-advance table. Non-negotiable because jsdom throws and happy-dom silently returns `0` on all four, which would let broken label-collision layouts pass tests forever.
- **Two token mechanisms, never mixed:** CSS custom properties drive *presentation* only (server can't read them); anything that changes what `planChart()` decides is a typed value through a `<GxConfig>` component, so server and client always agree. ⚠ The split runs by **consequence, not by token name** — the test is *"does this token's value change the outcome of a fit-or-collide decision?"* Six do, all text-measurement properties (`research/41-text-metrics.md` §2); their custom properties are generated from the typed values rather than authored alongside them.
- **ESM-only**, `tsdown` with `unbundle: true` (the only tested config where `"use client"` survives the build) — protected by a CI job that builds a real Next.js app and greps the output.
- **Undecided, not to be invented:** the project name and npm scope (currently `@gx/*` placeholder — blocks publishing, not code); 43 `--gx-*` token names referenced but not yet specified; 6 token defaults the research explicitly declined to guess at; the six neutral-theme hex values, which are derivable at B1 rather than guessable; and whether Roboto Flex ships `tnum`, which blocks generating the metrics table.

## Brand Commitments

**The Emission-Line Rail** — the visual world, established with the user and recorded in `DESIGN.md` ahead of implementation. The system is modelled on a spectroscope's working plate: a calibrated rail, and against it, named emission lines at exact wavelengths. It was chosen because it answers the product's hardest constraint natively — an instrument at low resolution shows *fewer* lines, not blurrier ones, and never fakes a peak it did not measure. That is the responsive ladder in a language that predates it.

Load-bearing commitments. Full statements and their reasoning live in `DESIGN.md`; do not restate them loosely from this record:

- **Every series hue is a real named emission line at a stated wavelength**, computed wavelength → CIE 1931 XYZ → linear sRGB → OKLCH. Hue is inherited from the physics and is not adjustable; a hue with no wavelength behind it does not enter the palette.
- **Colour is signal.** Charcoal is the default state of every surface; colour applied to something that does not encode a value is a defect.
- **Hue carries series identity for at most six series** — measured, not assumed. Past six, dash pattern and point shape take over. Hue *and* dash *and* point shape are active simultaneously by default: redundancy is the system's normal operating mode, not an accessibility toggle a consumer switches on.
- **No shadows, no glows, no blurs, no translucency, no gradients, no corner radius.** Absent, not softened. Depth is communicated only by 1px hairlines and by ground value. ⚠ Shadows and corner radius are **Rail-only** — the neutral theme restores both, which is what the escape hatch is for; the elevation tokens exist as *names* in both themes precisely so a class can swap them (`research/43-theming.md` §3.2). **Gradients are the exception to the exception**: banned in every theme, because the reason is semantic — a gradient encodes a value that varies where no value varies — and a semantic ban does not relax into a stylistic preference.
- **Stroke weights increase as a widget gets smaller** — a deliberate, documented divergence from Adobe Spectrum, which verifiably scales them down (`research/00-decisions.md`, "What the provenance tier does and does not mean"). ⚠ Unlike shadows and corners, this one is **cross-theme**: it exists for a legibility reason, not a visual one, so the neutral theme keeps it. That is the general test — *every divergence that exists for a measurement or legibility reason is cross-theme; every divergence that exists for a visual reason is Rail-only* (`research/43-theming.md` §7).

⚠ The palette's own acceptance criteria — the 4.5 contrast floor and the ΔE separation targets — are **this project's own choices and carry no external authority** (`DESIGN.md:247`). No minimum-contrast or minimum-colour-separation threshold exists anywhere in the research. Cite them as ours.

The Emission-Line Rail ships as the library's **default theme**, alongside a documented **neutral escape-hatch theme** that resets to field-convention defaults for consumers who want the ladder without the visual world.

Still genuinely undecided and not to be invented: **the project name and the npm scope** (`@gx/*` is a placeholder, `DESIGN.md:249`). These block publishing, not code.

## Evidence on Hand

`DESIGN.md` and everything under `research/`:

- `DESIGN.md` — the visual world ("The Emission-Line Rail"), seeded with the user before implementation. Palette derivation, the five typographic ranks, the layout and elevation rules, and an explicit list of what was left unresolved at seed time so it is not quietly invented later.
- `research/00-source-analysis.md` + `research/assets/*.jpg` — Basedash demo video, frame-by-frame evidence, the product thesis.
- `research/00-decisions.md` — locked product + architecture decisions, and the two standing limits on what a provenance tier means.
- `research/10-responsive-ladder.md` — the core design IP: how a chart's information content changes with size, cross-checked against published responsive-viz research.
- `research/20-architecture.md` — package graph, contracts, boundaries, testing strategy.
- `research/30-implementation-plan.md` — milestones A–E and sequencing risks.
- `research/40-chart-plan.md` — the `ChartPlan` / `PlanOverrides` / `ChartType` field contract.
- `research/41-text-metrics.md` — the `FontMetrics` plan-input token, `measureText()`, and the reference typeface.
- `research/42-typography.md` — the reconciled A–E type scale and its token mapping.
- `research/43-theming.md` — default and neutral themes, and the token lint-gate allowlist.
- `research/raw/01`–`07` — per-chart-type specs, grid model, charting-library landscape, grid/resize landscape, responsive-viz theory, design-token/widget-aesthetics survey, monorepo/packaging landscape.

No real product screenshots, testimonials, pricing, or deployment exist yet — none should be fabricated.

## Product Principles

1. Deciding what to draw (`planChart()`, pure and data-only) is strictly separated from drawing it (`<Chart>`, hook-free) — nearly every other architectural choice follows from this split.
2. A chart at a small size is a different, honest chart, not a shrunken one. Size boundaries come from published perception research, not taste — and every threshold ships labelled with where it actually came from, including when it's our own invention.
3. Every visual property is controllable per-widget from ordinary CSS with zero re-render; anything that would make the server and the client disagree is deliberately kept out of that mechanism — which is why the six text-measurement properties are typed values with generated custom properties rather than plain CSS.
4. Reuse hard, already-solved problems (d3 for scales/shapes, `react-grid-layout/core` for collision and compaction) rather than reinventing them, so effort concentrates on the genuinely novel parts.
5. Prove the idea on the smallest possible slice before building breadth — one chart type, fully working end-to-end, before more chart types, more tokens, or the grid shell.

## Accessibility & Inclusion

Best-effort, research-driven — no formal compliance target (e.g. no mandated WCAG level) is currently required. Follow the W3C/ARIA guidance already established in research: `role="graphics-document"` on the `<svg>` (never `role="img"`, which deletes children from the accessibility tree); a visible, collapsible data table in a `<figcaption>` inside a `<figure>`, itself treated as another rung of the ladder rather than a bolted-on feature; animation is added only when the user has expressed *no* motion preference, never removed from an explicit one.
