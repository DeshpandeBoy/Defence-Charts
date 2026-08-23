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
| `../DESIGN.md` | The visual world ("The Emission-Line Rail"). Palette derivation, type ranks, layout and elevation rules. |
| `../UX.md` | **Who it is for and what hurts.** The user problems, the use cases, and how the product is handed over so it is understood. The half `01-plain-english.md` deliberately leaves out. |
| `maps/` | **Five flow maps** — package graph, runtime flow, milestone DAG, token flow, CI gates. Derived from the files above; they hold no values of their own. Read these when you need *"if I change X, what else moves?"* |
| `decisions/` | **Decision register.** Decisions 1–11 are indexed from `00-decisions.md`, not copied; 012 onward get their own file with evidence and amendment lists. |
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
`role="img"`), the **`--gx-*` token tree** (183 specified tokens, four-tier provenance), and the
**docs stack** (Fumadocs + Shiki + StackBlitz, no playground library).

**Design written:** the responsive ladder, the package graph, the milestone plan, and — closing the
three gaps that read as specified but weren't — the **`ChartPlan` field contract** (`40`), **text
metrics as a plan input** (`41`), the **reconciled A–E type scale** (`42`), and the **two-theme
architecture with the token lint-gate allowlist** (`43`).

Four things those documents changed rather than merely added, worth knowing before reading the
older files:

- **`planChart()` takes five parameters**, not four — `policy` (thresholds *and* `fontMetrics`)
  applied before resolution, `overrides` forced after.
- **The presentation / plan-input split runs by consequence, not by token name.** Six text-measurement
  properties are plan inputs; `20-architecture.md` §3.2's table was wrong about `font-family` and is
  corrected in place.
- **`--gx-label-landmark-grade` supersedes both `landmark-weight` spellings**, and retargets Carbon's
  semibold to `GRAD` — because `wght` changes glyph advances and would invalidate the metrics table.
- **`prevClass` is settled out of the resolver**, not deferred.

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

**Open — and it is now a short list:**

1. **Project name and npm scope.** Blocking for publish, not for code. Everything is `@gx/*`
   placeholder; `raw/06` §6.0 verified the prefix appears only as the first path segment, so the
   rename is one regex plus one generator constant plus one template-literal type.
2. **43 `--gx-*` names referenced but never specified** — must each get a row or be deleted before
   the token tree ships. See `30-implementation-plan.md` B1. (Was 51; `42-typography.md` §4
   specified eight.)
3. **Six UNVERIFIED token defaults** the research agent declined to guess at. Same section.
4. **Whether Roboto Flex ships `tnum`** (`41-text-metrics.md` §4.1) and the **`safetyFactor`**
   calibration (§4.2). These block *generating the metrics table* at A2, not A1.
5. **The six neutral-theme hex values** and the five composition pairs with no structural guarantee
   (`43-theming.md` §4–§5). Derivable at B1; deliberately not guessed.

**Next:** Milestone A1. The A2–A4 pointers it hands off to now resolve to real specifications rather
than to each other, the linter is chosen (**ESLint 9, flat config**, which is what gate G2 needs), and
the SVG presentation-attribute question A1 was asked to decide is decided: **primitives carry no
visual attributes and take everything from classes.**

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
