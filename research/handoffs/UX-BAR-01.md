---
id: UX-BAR-01
title: Bar orientation and interaction refinement
type: implementation
state: handoff
owner: coordinator
branch: codex-ux-bar-01-orientation-interaction
worktree: /Users/dhanyarao/Documents/Defence
base_commit: 9bff1ccd44fee3b20dde4614c4e816d89e78df7b
depends_on: [D1.1, I1.3, I1.4, I1.5]
started_at: 2026-08-27T21:54:00+05:30
last_checkpoint: 2026-08-27T23:06:00+05:30
---

# UX-BAR-01 — Bar orientation and interaction refinement

## Objective

Ship an explicit bar-chart orientation control; make horizontal-bar legends use the chart's
reserved top rail; and make hover/focus selection visually isolate the active bar/series with a
compact, legible tooltip, while preserving static/RSC rendering.

## Read first

- AGENTS.md
- research/00-decisions.md
- research/90-final-delivery-and-agent-plan.md
- research/91-codex-build-workstream.md
- research/handoffs/D1.1.md
- research/handoffs/I1.3.md
- research/handoffs/I1.4.md
- research/handoffs/I1.5.md
- packages/core/src/families/bar/planner.ts
- packages/core/src/frame.ts
- packages/react/src/InteractionOverlay.tsx
- packages/primitives/src/chart.css

## Allowed write set

- packages/core/src/families/bar/**
- packages/core/src/frame.ts and focused frame tests
- packages/react/src/InteractionOverlay.tsx and focused tests/styles
- packages/react/src/LegendControl.tsx and focused tests
- packages/primitives/src/families/bar/** and bar styling in packages/primitives/src/chart.css
- apps/sandbox/src/SandboxApp.tsx and its local styles/tests for the bar orientation control
- research/handoffs/UX-BAR-01.md

## Do not edit

- research/90-final-delivery-and-agent-plan.md
- package manifests, lockfiles, or unrelated chart families
- release state and unrelated handoffs

## Acceptance criteria

- [ ] `bar` and `timebar` accept vertical or horizontal orientation through a serialisable override and resolve matching rectangle geometry.
- [ ] Hover, focus, and keyboard selection of a bar highlight its series while de-emphasising non-active bars, without changing static chart output.
- [ ] Horizontal bar legends render in the reserved top rail, never overlap plotted marks, and retain accessible controls.
- [ ] Tooltip content distinguishes category, series, and value with refined token-driven structure that respects the Rail and neutral themes.
- [ ] Focused core/react/primitives tests, typechecks, token gate, and `git diff --check` pass; a browser/demo proof covers both orientations.

## Baseline

- Branch: Fine-Tuning-V1 (created task branch `codex-ux-bar-01-orientation-interaction`)
- Base commit: 9bff1ccd44fee3b20dde4614c4e816d89e78df7b
- Initial `git status --short`: clean
- Last known green command/commit: repository HEAD 9bff1ccd

## Current checkpoint

### Completed

- Startup checks and required task/research reading completed.
- `ChartPlan.orientation` now transposes bar frame geometry, zero baseline, category bands, and axis ticks for `bar`/`timebar` without changing the static plan contract.
- Bar SVG marks now expose stable series identity attributes; CSS legend hover isolates the referenced series and makes the others recede without client state or RSC changes.
- Sandbox bar pages expose a serialisable orientation selector and reserve a top external legend rail for either explicit orientation.
- The tooltip has a clear selected-reading header, category hierarchy, restrained divider, tabular value treatment, and series swatches using existing theme tokens.
- Focused frame, renderer, interaction, typecheck, token, lint, and sandbox-build checks passed.
- Corrected the user-reported tooltip scrollbar: the overlay no longer uses a scrollable overflow path, its placement estimate matches its simplified data-first header, and unavailable rows remain an explicit `+N more` disclosure.
- Corrected the user-reported composition drift: bar-family large-chart legends use the right-side vertical rail shown in the supplied reference, and an immediately visible Vertical / Horizontal control is rendered above each bar preview.

### In progress

- Nothing; ready for coordinator handoff.

### Remaining

- None.

### Exact next action

```bash
npx -y node@24 "$(which pnpm)" exec vitest run packages/core/src/families/bar/planner.test.ts packages/react/src/InteractionOverlay.test.tsx
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Orientation is an existing serialisable `ChartPlan` state | Current public contract | `packages/core/src/plan.ts` | Use the existing override surface rather than a new prop. |
| Rail visuals do not earn rounded cards or decorative shadow | Locked visual system | `DESIGN.md`, theme tokens | Tooltip refinement uses hierarchy, hairlines, color signal, and existing token values. |
| Legend focus must not own or filter host data | Locked presentational boundary | `research/00-decisions.md` | Interaction changes only rendered emphasis; host state remains external. |
| Horizontal bar axes are a frame concern | Current architecture | `packages/core/src/frame.ts` sees values and geometry | Reuse the existing plan orientation but generate value x-ticks and category y-ticks only for horizontal bars. |
| Tooltips must disclose unavailable rows, not become scroll containers | User-reported visual defect | supplied screenshot and `InteractionOverlay` CSS | Use clipped overlay bounds plus the existing `hiddenRowCount` disclosure. |
| Bar legend follows the supplied reference | User-directed visual requirement | supplied screenshots | Large bar charts use the existing right external legend rail, not the centered top rail. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| apps/sandbox/src/SandboxApp.tsx | Orientation control and top-rail legend choice | yes |
| packages/core/src/frame.ts | Horizontal bar coordinates and axes | yes |
| packages/core/src/frame.test.ts | Horizontal geometry and axis proof | yes |
| packages/primitives/src/families/bar/renderer.tsx | Stable bar series identity attributes | yes |
| packages/primitives/src/families/bar/renderer.test.tsx | Renderer identity proof | yes |
| packages/primitives/src/chart.css | Legend-hover focus treatment | yes |
| packages/react/src/InteractionOverlay.tsx | Tooltip hierarchy markup | yes |
| packages/react/src/InteractionOverlay.test.tsx | Tooltip hierarchy proof | yes |
| packages/react/src/interaction-overlay.css | Token-driven tooltip refinement | yes |
| apps/sandbox/src/sandbox.css | Visible bar orientation control styling | yes |
| research/handoffs/UX-BAR-01.md | Durable task contract and evidence | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| working tree | `npx -y node@24 "$(which pnpm)" exec vitest run packages/core/src/frame.test.ts packages/core/src/families/bar/planner.test.ts packages/primitives/src/families/bar/renderer.test.tsx packages/react/src/InteractionOverlay.test.tsx` | 0 | 4 files passed, including horizontal bar geometry, renderer identity, and tooltip hierarchy. |
| working tree | `npx -y node@24 "$(which pnpm)" --filter @gx/core typecheck && npx -y node@24 "$(which pnpm)" --filter @gx/primitives typecheck && npx -y node@24 "$(which pnpm)" --filter @gx/react typecheck && npx -y node@24 "$(which pnpm)" --filter @gx/sandbox typecheck` | 0 | All four TypeScript checks passed. |
| working tree | `npx -y node@24 scripts/check-tokens.mjs packages/primitives packages/react` | 0 | Token gate passed for the changed shared stylesheets. |
| working tree | `npx -y node@24 "$(which pnpm)" exec eslint packages/core/src/frame.ts packages/core/src/frame.test.ts packages/primitives/src/chart.css packages/primitives/src/families/bar/renderer.tsx packages/primitives/src/families/bar/renderer.test.tsx packages/react/src/InteractionOverlay.tsx packages/react/src/InteractionOverlay.test.tsx packages/react/src/interaction-overlay.css apps/sandbox/src/SandboxApp.tsx` | 0 | No lint findings. |
| working tree | `npx -y node@24 "$(which pnpm)" --filter @gx/sandbox build` | 0 | Vite sandbox build completed. |
| working tree | `git diff --check` | 0 | No whitespace errors. |
| working tree | `npx -y node@24 "$(which pnpm)" exec vitest run packages/core/src/families/bar/planner.test.ts packages/core/src/frame.test.ts packages/primitives/src/Legend.test.tsx packages/react/src/InteractionOverlay.test.tsx` | 0 | 4 focused files passed after the scrollbar, legend-rail, and visible-control corrections. |
| working tree | `npx -y node@24 "$(which pnpm)" --filter @gx/sandbox typecheck && npx -y node@24 "$(which pnpm)" --filter @gx/sandbox build` | 0 | Sandbox typecheck and production Vite build passed. |
| working tree | `npx -y node@24 scripts/check-tokens.mjs packages/react packages/primitives apps/sandbox` | 0 | Token gate passed for all changed stylesheets. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None | — | — |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: da636e2 (prior feature checkpoint `cdc0d66`)
- Branch pushed or locally available: local task branch
- Working tree clean: yes after `da636e2`
- Narrow restart check: `npx -y node@24 "$(which pnpm)" exec vitest run packages/core/src/frame.test.ts packages/primitives/src/families/bar/renderer.test.tsx packages/react/src/InteractionOverlay.test.tsx`
- Remaining risk/limitations: CSS legend inspection relies on the supported `:has()` selector; the static legend remains RSC-safe and a consumer may use the already-shipped controlled `LegendControl` when visibility state is required.
