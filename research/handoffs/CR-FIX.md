---
id: CR-FIX
title: Address repository-wide code review findings
type: implementation
state: done
owner: Codex
branch: Fine-Tuning-V1
worktree: /Users/SameeraD/Defence-Charts
base_commit: 7790b51bdb28b80511d8e03c1e45f2f9ab2bbe26
depends_on: []
started_at: 2026-08-27T00:00:00+05:30
last_checkpoint: 2026-08-27T00:14:16+05:30
---

# CR-FIX — Address repository-wide code review findings

## Objective

Resolve the confirmed release, CI, accessibility, test-integrity, tree-shaking, and documentation
findings from the repository-wide review while preserving the existing chart/grid architecture.

## Allowed write set

Review-fix files under `packages/primitives`, `packages/core`, `scripts`, `docs/content/docs/api`,
`apps/playground/README.md`, and `PRODUCT.md`, plus this handoff and directly related tests.

## Current checkpoint

- Added family-specific `@shiftcharts/primitives/line`, `/bar`, and `/donut` entrypoints with
  published declarations and renderer-isolated bundles.
- Fixed default browser-gate routing, categorical table labels, heatmap legend labels, donut Tile
  region ordering, stale bar comments, and public documentation/product drift.
- Expanded tree-shake coverage to every registered renderer family and added packed artifact,
  consumer, and subpath-resolution assertions.
- Reset grid keyboard sessions on cancel and mode changes; added the corresponding regression test.
- Final matrix expectation now records the donut Tile `value` region introduced by the planner fix.
- Full verification and all browser/RSC gates pass; tracked working tree is clean after commit.

## Verification evidence

- `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm verify` — 75 test files,
  978 tests, typecheck/lint/package/build/tree-shake/boundary/typography/token gates passed.
- `pnpm lint:rsc` — server-rendered stage chart passed with JavaScript disabled.
- `pnpm lint:containment` — 178 sizes swept, 0 unattributed overflow.
- `pnpm lint:grid` — Chromium keyboard/pointer/resize/environment matrix passed.
- `pnpm lint:motion` — resize staging and reduced-motion checks passed.
- Packed artifact and consumer proof passed: 9 JS/declaration entrypoints, 7 CSS subpaths, all
  three consumers build, and the Next fixture resolves its declared 16.3.3 dependency.

Remaining: none.

## Resume checks

```bash
PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm vitest run scripts/check-treeshake.test.mjs packages/core/src/invariants.test.ts packages/core/src/families/donut/planner.test.ts packages/primitives/src/DataTable.test.tsx packages/primitives/src/Legend.test.tsx
git diff --check
```
