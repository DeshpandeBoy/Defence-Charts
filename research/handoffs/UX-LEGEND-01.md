---
id: UX-LEGEND-01
title: Cross-chart legend space and inspection highlight
type: implementation
state: handoff
owner: Codex
branch: codex/ux-legend-01-cross-chart-interaction
worktree: /Users/dhanyarao/Documents/Defence
base_commit: 5dd10792dd689fedc4fa8938de65f264ea1b2864
depends_on: [I1.4, I1.5, D7.1, UX-BAR-01]
started_at: 2026-08-27T22:57:42+05:30
last_checkpoint: 2026-08-27T23:07:00+05:30
---

# UX-LEGEND-01 — Cross-chart legend space and inspection highlight

## Objective

Make every supported chart reserve its planned legend region in the serialisable core frame and
make a legend item's hover or keyboard focus isolate its matching rendered data while retaining
static/RSC output.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/handoffs/I1.4.md`
- `research/handoffs/I1.5.md`
- `research/handoffs/UX-BAR-01.md`
- `packages/core/src/layout.ts`
- `packages/core/src/frame.ts`
- `packages/primitives/src/Chart.tsx`
- `packages/primitives/src/Legend.tsx`
- `packages/primitives/src/chart.css`

## Allowed write set

- `packages/core/src/frame.ts` and focused frame tests
- `packages/primitives/src/Chart.tsx`, `Legend.tsx`, `CompactSeriesKey.tsx`, focused tests, and
  `chart.css`
- `packages/primitives/src/families/**/renderer.tsx` and focused renderer tests where identity
  attributes are missing
- `packages/react/src/LegendControl.tsx` and focused tests
- `apps/sandbox/src/SandboxApp.tsx` and local styles/tests for a cross-family proof
- `research/handoffs/UX-LEGEND-01.md`

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- central planner/renderer registries, package manifests, lockfiles, or unrelated handoffs
- token definitions unless a missing property is proven necessary and separately approved

## Acceptance criteria

- [x] A reserved legend region is exposed by the core `ChartFrame` whenever the plan charges one;
  plot geometry and legend geometry agree for every placement.
- [x] Static and controlled legends carry stable semantic identities for series and donut slices.
- [x] Hover and keyboard focus keep the matching data full strength and de-emphasise other matching
  marks across supported multi-series chart families, without changing host data or the RSC path.
- [x] The Sandbox demonstrates the behavior across chart families, and legends never overlap charged
  plot space.
- [x] Focused core/primitives/react tests, token gate, typechecks, Sandbox build, and `git diff --check` pass.

## Baseline

- Branch: `codex/ux-legend-01-cross-chart-interaction`
- Base commit: `5dd10792dd689fedc4fa8938de65f264ea1b2864`
- Initial `git status --short`: clean
- Last known green command/commit: UX-BAR-01 handoff reports focused checks at `5dd1079`

## Current checkpoint

### Completed

- Startup checks, governing documents, and the existing legend/frame seams were inspected.
- Existing bar-only CSS inspection state and structural `frame.legend` compatibility seam identified.

### Completed

- Added `ChartFrame.legend`, a serialisable `Rect | null` containing the exact rail that core
  already charges for external and reserved internal legends.
- Passed external core rail geometry to static HTML legends through non-token custom layout
  properties, preventing right/left/top/bottom rail overlap with the planned plot.
- Replaced the bar-only inspection selector with cross-family series, donut-slice, and heatmap
  intensity selectors. Legend items are keyboard-focusable; selected data remains full strength
  while nonmatching data uses the existing fade token.
- Updated the compact internal SVG key to consume the real core legend region rather than a
  structural compatibility placeholder.
- Repaired one stale in-scope bar-frame expectation: prior user-approved behavior uses a right
  rail, but the test still expected top.
- Browser proof at `/charts/line`, `/charts/bar`, `/charts/donut`, and `/charts/heatmap`:
  external legends receive `data-legend-region="core"`; a line legend item produced opacities
  `[1, 0.2, 0.2]`, donut `[1, 0.2, 0.2, 0.2, 0.2, 0.2]`, and keyboard-focused heatmap intensity
  produced one full-strength matching tier with the rest at `0.2`. The bar rail started after
  the mark bounds, and no browser console errors were reported.

### Remaining

- Commit the completed code and task handoff together. Integration verification is blocked by a
  pre-existing token barrel API-gate defect documented below.

### Exact next action

```bash
TASK_NODE_BIN=/Users/dhanyarao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin PATH="$TASK_NODE_BIN:$PATH" pnpm exec vitest run packages/core/src/frame.test.ts packages/primitives/src/Legend.test.tsx
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Hover/focus behavior | User request + current bar precedent | User asks real-chart highlighting; `chart.css` already fades nonmatching bars | Matching data stays full strength and nonmatching data uses the existing fade token. |
| Layout ownership | Locked architecture | `ChartPlan` is pure; `ChartFrame` owns resolved coordinates | Core emits charged legend region; renderers consume it rather than inventing dimensions. |
| Interaction boundary | Locked presentational boundary | `research/00-decisions.md` | No legend action filters or mutates host data. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `packages/core/src/frame.ts` | Public core legend-region geometry | yes |
| `packages/core/src/frame.test.ts` | External and reserved rail proof; corrected stale bar-right expectation | yes |
| `packages/primitives/src/Chart.tsx` | Pass core legend geometry to static legend output | yes |
| `packages/primitives/src/Legend.tsx` | CSS rail variables and keyboard-focusable static legend entries | yes |
| `packages/primitives/src/Legend.test.tsx` | Static focus and core-rail output proof | yes |
| `packages/primitives/src/CompactSeriesKey.tsx` | Use real `ChartFrame.legend` rail geometry | yes |
| `packages/primitives/src/chart.css` | Cross-family hover/focus inspection treatment and core rail placement | yes |
| `research/handoffs/UX-LEGEND-01.md` | Durable task scope and verification checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| uncommitted UX-LEGEND-01 | `pnpm exec vitest run packages/core/src/frame.test.ts packages/primitives/src/Legend.test.tsx packages/primitives/src/Chart.test.tsx packages/react/src/LegendControl.test.tsx` | 0 | 4 files passed, 137 tests total. |
| uncommitted UX-LEGEND-01 | `pnpm --filter @shiftcharts/core typecheck && pnpm --filter @shiftcharts/primitives typecheck && pnpm --filter @shiftcharts/react typecheck && pnpm --filter @shiftcharts/sandbox typecheck` | 0 | All four package TypeScript checks passed. |
| uncommitted UX-LEGEND-01 | `pnpm lint:tokens` | 0 | 8 stylesheets clean against 222 declared token(s). |
| uncommitted UX-LEGEND-01 | `pnpm --filter @shiftcharts/sandbox build` | 0 | Production Vite build passed (302 modules). |
| uncommitted UX-LEGEND-01 | `git diff --check` | 0 | Passed. |
| uncommitted UX-LEGEND-01 | Local Sandbox browser proof | 0 | Line, bar, donut, and heatmap core rails and focus/inspection states verified; no console errors. |
| uncommitted UX-LEGEND-01 | `pnpm verify` | 1 | Reaches G6 after type/lint/token gates, then fails on pre-existing public `Token` export referencing unexported `Tier`; no task file is implicated. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| G6 public API gate | `pnpm lint:api` reports `@shiftcharts/tokens Tier ... not exported from @shiftcharts/tokens's own barrel` | Coordinator/token-barrel owner must decide whether to export `Tier` or stop exporting `Token`; `packages/tokens/src/index.ts` is outside this task's allowed write set. |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: pending (implementation complete; unrelated API-gate blocker recorded).
- Branch pushed or locally available: local `codex/ux-legend-01-cross-chart-interaction`
- Working tree clean: no — completed code and handoff await commit.
- Narrow restart check: `pnpm exec vitest run packages/core/src/frame.test.ts packages/primitives/src/Legend.test.tsx`
- Remaining risk/limitations: CSS `:has()` provides static hover linkage; separately mounted
  `LegendControl` remains consumer-owned and does not mutate chart data or force a client
  boundary onto static `<Chart>`.
