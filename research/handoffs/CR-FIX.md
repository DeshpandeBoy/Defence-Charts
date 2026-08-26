---
id: CR-FIX
title: Address repository-wide code review findings
type: implementation
state: in progress
owner: Codex
branch: Fine-Tuning-V1
worktree: /Users/SameeraD/Defence-Charts
base_commit: 7790b51bdb28b80511d8e03c1e45f2f9ab2bbe26
depends_on: []
started_at: 2026-08-27T00:00:00+05:30
last_checkpoint: 2026-08-27T00:00:00+05:30
---

# CR-FIX — Address repository-wide code review findings

## Objective

Resolve the confirmed release, CI, accessibility, test-integrity, tree-shaking, and documentation
findings from the repository-wide review while preserving the existing chart/grid architecture.

## Allowed write set

Review-fix files under `packages/primitives`, `packages/core`, `scripts`, `docs/content/docs/api`,
`apps/playground/README.md`, and `PRODUCT.md`, plus this handoff and directly related tests.

## Current checkpoint

- Added family-specific primitive entrypoints and renderer isolation scaffolding.
- Fixed default browser-gate routing, categorical table labels, heatmap legend labels, donut Tile
  region ordering, stale bar comments, and public documentation drift.
- Added focused tests for family tables and expanded invariant/tree-shake coverage.
- Remaining: packed consumer proof, grid-session review, full verification, and final commit.

## Resume checks

```bash
PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm vitest run scripts/check-treeshake.test.mjs packages/core/src/invariants.test.ts packages/core/src/families/donut/planner.test.ts packages/primitives/src/DataTable.test.tsx packages/primitives/src/Legend.test.tsx
git diff --check
```
