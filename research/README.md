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

**Next:** Milestone A1. Nothing blocks it — and the A2–A4 pointers it hands off to now resolve to
real specifications rather than to each other.
