# Research — responsive grid-based chart widget library

Working research for the new project in `Defence/`. Everything here is input to the build plan.

## Read in this order

| File | What it is |
|---|---|
| **`01-plain-english.md`** | **Start here.** The whole design explained without jargon — what we're building, how it works, what we build first, what's still unknown. |
| `00-decisions.md` | Locked product + architecture decisions. |
| `00-source-analysis.md` | Basedash demo video + frame-by-frame evidence. The product thesis. |
| `assets/` | Extracted video frames cited by the analysis. |
| `10-responsive-ladder.md` | **The core design IP.** How a chart changes information content with size. |
| `20-architecture.md` | Package graph, contracts, boundaries, testing strategy. |
| `30-implementation-plan.md` | Milestones A–E and sequencing risks. |
| `40-chart-plan.md` | The `ChartPlan` / `PlanOverrides` / `ChartType` field contract. The library's public API. |
| `41-text-metrics.md` | `FontMetrics` as a plan-input token, `measureText()`, and the reference typeface. |
| `42-typography.md` | The reconciled A–E type scale and its `--gx-*` mapping. |
| `43-theming.md` | Default + neutral themes, composition review, token lint-gate allowlist. |
| `50-viewer-evidence.md` | **The viewer's half of the evidence base.** What we know about how they read a chart and how they interact with one, what tier each claim sits at, and the A1 instrument that closes the rest. |
| `../DESIGN.md` | The visual world ("The Emission-Line Rail"). Palette derivation, type ranks, layout and elevation rules. |
| `../UX.md` | **Who it is for and what hurts.** The user problems, the use cases, and how the product is handed over so it is understood. The half `01-plain-english.md` deliberately leaves out. |
| `60-commercial-model.md` | **If there is ever a Pro or Enterprise tier.** Why runtime API keys are the wrong mechanism here, where enforcement actually works, and the one architectural seam that has a deadline at A4. Analysis, not a decision. |
| `maps/` | **Five flow maps** — package graph, runtime flow, milestone DAG, token flow, CI gates. Derived from the files above; they hold no values of their own. Read these when you need *"if I change X, what else moves?"* |
| `decisions/` | **Decision register.** Decisions 1–11 are indexed from `00-decisions.md`, not copied; 012 onward get their own file with evidence and amendment lists. |
| `html-explained/` | **The whole project, for someone who does not read this folder.** A single self-contained `index.html` — open it in a browser, no build step. It is a *rendering* of the files above, not a source: nothing is decided here, and when it disagrees with a file above, the file above wins. |
| `raw/01-basedash-chart-types.md` | Per-chart-type spec scraped from Basedash docs. |
| `raw/02-basedash-grid-model.md` | Basedash dashboard grid, filters, embedding. |
| `raw/03-landscape-charting.md` | React charting library landscape + build-vs-adopt call. |
| `raw/04-landscape-grid-resize.md` | Drag/resize grid library landscape + algorithms. |
| `raw/05-theory-responsive-viz.md` | Responsive-viz theory. Validates the ladder's thresholds. |
| `raw/06-design-tokens-widgets.md` | Chart design tokens + widget aesthetics + size families. |
| `raw/07-arch-oss-packaging.md` | Monorepo, build, exports, testing, release. |

`raw/` files are written by research agents. `_dump.py` recovers results from completed
workflow runs; agents launched directly write to `raw/` themselves.

## Status

**All research streams are closed.** `raw/01`–`raw/07` are complete; every finding has been folded
into the design documents (`10`, `20`, `30`, `40`–`43`, and `../DESIGN.md`). Nothing is in flight.

**Settled:** distribution, library boundary, grid model, theming, chart core (d3 primitives, own
SVG tree), grid engine (`react-grid-layout@2/core`), render boundary (RSC-safe `<Chart>` +
client `<AutoChart>`), plan-as-data, **build stack** (tsdown + `unbundle: true`, ESM-only, TS 6.0.3
pinned), **test stack** (bare Node for the ladder, injected fake `ResizeObserver`, Vitest browser
mode with the Playwright provider), **accessibility markup** (`role="graphics-document"`, never
`role="img"`), the **`--gx-*` token tree** (198 declared presentation tokens, four-tier provenance), and the
**docs stack** (Fumadocs + Shiki + StackBlitz, no playground library).

**Design written:** the responsive ladder, the package graph, the milestone plan, and — closing the
three gaps that read as specified but weren't — the **`ChartPlan` field contract** (`40`), **text
metrics as a plan input** (`41`), the **reconciled A–E type scale** (`42`), and the **two-theme
architecture with the token lint-gate allowlist** (`43`).

Four things those documents changed rather than merely added, worth knowing before reading the
older files:

- **`planChart()` takes five parameters**, not four — `policy` (thresholds and atomic fitting typography)
  applied before resolution, `overrides` forced after.
- **The presentation / plan-input split runs by consequence, not by token name.** Six text-measurement
  properties are plan inputs; `20-architecture.md` §3.2's table was wrong about `font-family` and is
  corrected in place.
- **`--gx-label-landmark-grade` supersedes both `landmark-weight` spellings**, and retargets Carbon's
  semibold to `GRAD` — because `wght` changes glyph advances and would invalidate the metrics table.
- **`prevClass` is settled out of the resolver**; the live 1% deadband now lives in the client
  boundary and passes previous state into a pure classifier.

**Three decisions were written up after a verification pass on 2026-08-23 and are now ✅ applied.**
They live in `decisions/`: **012** — never emit `<line>` for tokened geometry, because `x1`/`y1`/`x2`/`y2`
are not CSS-settable in any browser; **013** — the zero-JS claim narrowed after testing visx, Vega,
Observable Plot and nivo empirically; **014** — Highcharts styled mode exposes far more than colour.

Two of those changed what the product *says*, not just what it builds, and are worth knowing before
reading `01-plain-english.md` or `PRODUCT.md`:

- **The ladder is now the headline, not the theming.** CSS theming is the *weakest* of the three
  claims — Highcharts already does most of it, and 012 restricts geometry-via-CSS to an element
  subset. The ladder is untouched by any of this and is the only claim with no credible prior art.
- **"None of the eleven can render server-side with zero JS" is retired as false.** visx renders
  inside an RSC today at 124 B of page JS. The wording that survives: *the first planned,
  size-adaptive chart library that renders with zero JS and stays themeable after render.* Decision 7's
  own row — *"zero of the 11 ship a `"use client"` directive"* — was verified true and is untouched.

**One new CI gate came out of this: G14**, an element-set snapshot at A4, because the token lint gate
structurally cannot tell that a `var()` landed on a property that does not exist.

**Open — and it is now a short implementation list:**

1. **Project name and npm scope.** Blocking for publish, not for code. Everything is `@gx/*`
   placeholder; `raw/06` §6.0 verified the prefix appears only as the first path segment, so the
   rename is one regex plus one generator constant plus one template-literal type. ⚠ **That claim is
   now enforced rather than verified once.** B1 slice 2 added G7's `token-name` rule, which rejects
   any `--gx-*` declaration where the prefix recurs mid-name — so the property the cheap rename
   depends on cannot quietly stop being true between now and the rename.
2. **Windows fallback measurement** remains explicitly unverified. The released Roboto Flex digit
   behavior and the available-face `safetyFactor: 1.57` calibration are now committed; Segoe UI
   Variable is not guessed.
3. **C1-C2:** the twelve-column grid, per-widget sizing/compaction, and widget chrome.
4. **D:** chart breadth, starting with bar/timebar and donut before the remaining families.
5. **E:** project name/npm scope, release automation, public examples, and publishing.

**Next:** Milestone **C1** — the twelve-column grid and per-widget sizing/containment. Milestone A is
closed (A1-A6), and B1-B3 are closed for the current line/area planner. B1 generated the token tree
and Rail + Neutral themes, B2 wired the renderer control surface, and B3 added typed threshold policy
with the provenance/consumption gate. The six previously unverified implementation defaults remain
explicitly non-research claims; B3 records that distinction in their provenance rather than silently
promoting them. B2's G20 audit is wired into `verify` and CI, and its 30 research knobs now name 0
undeclared tokens.

B1 **slice 1** reversed the token direction — the tree is authored in `packages/tokens/src/tokens.ts`
and `theme.css` is generated from it, so a tier and a source are now fields rather than comments.
B1 **slice 2** renamed the declarations to `raw/06` §6.0's grammar and gave **G7 a sixth rule** so
the next name that disobeys it fails CI. The B1 census is now green: the shipped tree reports zero
untiered and zero unverified declarations.

⚠ **Slice 2's own finding, and it is about `raw/06` rather than about the tree.** §6.0 publishes a
19-group closed set; §6.2–§6.9 of the same document specify names using **13 first segments it omits**,
so a gate copying that list verbatim would reject `--gx-title-font-size`, which §6.5 specifies. The
gate enforces the union in use and a test parses `raw/06` to assert it stays covering — see
[`43-theming.md`](43-theming.md) §6.1d. §6.0 now carries the annotation under its table.

⚠ **One caveat, found by auditing the claim rather than repeating it — and then by running it.** The
token lint gate is described everywhere as *ported*, and the source — `check-css-module-tokens.mjs`,
named at `raw/04:353` — was executed against the rule `43-theming.md` §6 specifies. It is wrong in
**both** directions: six rejections against a theme file of which two were correct, and every modern
colour function (`oklch()`, `lab()`, `hwb()`, `color()`) plus every named colour passes untouched —
which matters because `DESIGN.md` derives the whole palette in OKLCH. **Decision: build it on PostCSS,
and widen the rule set past `hex/rgb/hsl` + `px`.** Nothing was unspecified; the estimate was wrong.
See [`decisions/015-token-gate-is-a-parser.md`](decisions/015-token-gate-is-a-parser.md).

✅ **Licence: MIT**, decided 2026-08-23 — the assumption `raw/03` was already evaluating the field
against, now written down. Copyright holder is blocked on the project name.
