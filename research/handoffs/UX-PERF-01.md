---
id: UX-PERF-01
title: Interaction rendering performance — measurement and hot-path foundation
type: implementation
state: in progress
owner: Codex
branch: codex/ux-perf-01-hover-rendering
worktree: /Users/dhanyarao/Documents/Defence
base_commit: 26c9cc9a41be5af0c732e6e29aa2098ddaee1fae
depends_on: [I1.1, I1.2, I1.3, I1.5, UX-LEGEND-01]
started_at: 2026-08-27T23:55:00+05:30
last_checkpoint: 2026-08-27T23:48:00+05:30
---

# UX-PERF-01 — Interaction rendering performance

## Objective

Make the client tooltip/crosshair hover path measurable and remove its two cheapest unnecessary
costs: a geometry read for every pointer event and a React update when the resolved datum has not
changed. Preserve the static/RSC renderer, controlled interaction semantics, touch and keyboard
behavior, and the DOM-free core boundary.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/handoffs/I1.1.md`, `I1.2.md`, `I1.3.md`, `I1.5.md`, and `UX-LEGEND-01.md`
- `packages/react/src/AutoChart.tsx`
- `packages/react/src/InteractionOverlay.tsx`
- `packages/react/src/InteractionOverlay.test.tsx`
- `scripts/check-interaction-browser.mjs`

## Allowed write set

- `packages/react/src/InteractionOverlay.tsx`, `interaction-overlay.css`, and focused tests
- a new local interaction-preparation module/test in `packages/react/src/` if needed
- `apps/playground/src/interaction-fixture/**` and/or a new performance-only fixture beneath
  `apps/playground/src/`
- a new focused browser evidence runner under `scripts/` and its checked-in result in
  `scripts/results/`
- `research/handoffs/UX-PERF-01.md`

## Do not edit

- `packages/core/**`, `packages/primitives/**`, package manifests, lockfiles, central export
  barrels, root verification scripts, master plan/ledger, or unrelated handoffs
- high-level motion tokens: this task must use frame pacing, not turn the unused 33ms token into
  a 30fps hover cap

## Acceptance criteria

- [x] A real-browser fixture records reproducible interaction timing evidence for representative
  line-series density; it does not claim a universal performance budget from one machine.
- [x] Pointer coordinate conversion uses a cached SVG client rect and has a correct invalidation
  path for resize and pointer re-entry.
- [x] Hovering within the same resolved datum does not schedule a React state update or recreate
  an active datum identity.
- [x] Pointer/touch/keyboard contracts from I1.5 remain valid; static `<Chart>` still mounts no
  client interaction code.
- [x] Focused tests, react typecheck, browser fixture, `git diff --check`, and changed-path audit
  are recorded. Broader verification is the coordinator's responsibility.

## Baseline and diagnosis

- Branch began clean at `26c9cc9` after the cross-chart legend interaction work.
- `InteractionOverlay.nearestPoint()` calls `svg.getBoundingClientRect()` and linearly scans all
  rendered points on each `onPointerMove`.
- It creates a new `{ seriesId, pointIndex }` object and calls `setActiveKey()` even when the
  pointer remains over the already active datum.
- No browser interaction performance evidence runner exists; `check-grid-stress.mjs` explicitly
  measures grid layout rather than pointer interaction.

## Current checkpoint

- Governance documents and dependency handoffs reviewed.
- Branch created and task contract established.
- Browser baseline captured before the hot-path change: 24/24 client-rect reads, 23 distinct
  resolved datums, 207.3ms total / 8.64ms per sample, Chromium 151.0.7922.34, zero runtime errors.
- Implemented SVG client-rect caching with resize/scroll/frame-change/pointer-leave invalidation.
- Implemented a ref-backed semantic identity guard so repeated same-datum pointer events do not
  enqueue React state or commit a render.
- Post-change browser evidence: 1/24 client-rect reads, 23 distinct resolved datums, 207.6ms total
  / 8.65ms per sample, Chromium 151.0.7922.34, zero runtime errors.
- Full I1.5 browser matrix passed after the change; focused React test now has 11 passing tests.

## Decisions and constraints

| Item | Decision | Reason |
|---|---|---|
| Scope | Cache/bail-out first; indexing and imperative retained layers are separate follow-on work | Keeps the first change bounded and measurable. |
| Frame pacing | Do not throttle hover to 33ms | It would cap visual response at ~30fps, conflicting with the interaction objective. |
| State identity | Preserve `{seriesId, pointIndex}` semantic contract | I1.1 made identity stable through resize/filtering; implementation may use a scalar internal key only. |
| Architecture | No core or primitive changes | Interaction caches are client-only derived state and must not compromise RSC/static output. |

## Verification evidence

| Command | Exit | Exact result |
|---|---:|---|
| `/opt/homebrew/bin/pnpm exec vitest run packages/react/src/InteractionOverlay.test.tsx --reporter=dot` | 0 | 1 file, 11 tests passed; existing keyboard test emits a pre-existing act warning. |
| `/opt/homebrew/bin/pnpm --filter @shiftcharts/react typecheck` | 0 | TypeScript passed. |
| `/opt/homebrew/bin/pnpm --filter @shiftcharts/playground typecheck` | 0 | TypeScript passed. |
| `/opt/homebrew/bin/pnpm exec eslint packages/react/src/InteractionOverlay.tsx packages/react/src/InteractionOverlay.test.tsx apps/playground/src/interaction-fixture/InteractionFixture.tsx scripts/check-interaction-performance.mjs` | 0 | Focused lint passed. |
| `node scripts/check-interaction-performance.mjs` (pre-change) | 0 | Baseline captured in `scripts/results/ux-perf-01-interaction-baseline.json`. |
| `node scripts/check-interaction-performance.mjs` (post-change) | 0 | 24 samples, `boundsReads: 1`, 23 distinct datums, zero runtime errors; latest result in `scripts/results/ux-perf-01-interaction.latest.json`. |
| `node scripts/check-interaction-browser.mjs` | 0 | I1.5 touch/keyboard/legend/resize/static/reduced-motion/forced-colors matrix passed with zero runtime errors. |
| `git diff --check` | 0 | Passed. |

## Exact next action

```bash
sed -n '1,320p' scripts/check-interaction-browser.mjs
sed -n '1,320p' apps/playground/src/interaction-fixture/InteractionFixture.tsx
```

Then implement the next bounded slice: a prepared client interaction index, starting with sorted
X lookup for line/timebar and precomputed series/data maps. Do not add a k-d tree until a scatter
benchmark demonstrates that 1D lookup is insufficient.
