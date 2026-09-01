---
id: MOTION-RESIZE-V1
title: Responsive resize motion core baseline and cinematic add-on
type: implementation
state: handoff
owner: Codex
branch: codex/MOTION-RESIZE-V1-cinematic-motion
worktree: /Users/SameeraD/Defence-Charts
base_commit: 0ac1a81e436536c41528964d1978ea472cff1da9
depends_on: [FT-V1]
started_at: 2026-09-01T00:00:00+05:30
last_checkpoint: 2026-09-01T18:45:12+05:30
---

# MOTION-RESIZE-V1 — Responsive resize motion

## Objective

Ship a reliable resize-motion baseline for chart geometry and an opt-in client-only
`@shiftcharts/motion` cinematic layer. Make the bar/timebar defect inspectable beside the
existing delayed behavior, with line and donut comparisons, stable identity, interruption,
fallback, and reduced-motion coverage.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/handoffs/FT-V1.md`
- `packages/grid/src/WidgetGrid.tsx`
- `packages/primitives/src/chart.css`
- `packages/react/src/AutoChart.tsx`

## Allowed write set

- `packages/grid/src/**` interaction signaling and tests
- `packages/primitives/src/**` stable mark metadata, geometry transitions, and tests
- `packages/tokens/src/**` resize/cinematic tokens and generated output
- `packages/motion/**` the new opt-in client package
- `apps/sandbox/src/**` the `/motion` comparison fixture and route
- `scripts/check-motion*.mjs`, `scripts/capture-motion-screenshots.mjs`
- package/build/consumer gate manifests and fixtures needed to register `@shiftcharts/motion`
- `package.json`, `pnpm-lock.yaml`
- `research/assets/motion/**`
- `research/handoffs/MOTION-RESIZE-V1.md`

## Do not edit

- `research/handoffs/FT-V1.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- unrelated playground/grid fixtures or user-owned work

## Decisions and assumptions

| Item | Class | Effect |
|---|---|---|
| Core preview suppresses long internal chart staging | approved implementation | Widget wrappers expose `interactionKind`, `interactionPhase`, and `activeWidgetId`; preview maps chart duration and stage delay to zero so geometry responds to the pointer immediately. |
| Dedicated release tokens | implementation | Same-rung resize uses `220ms`; recompose uses `460ms` with `100ms` stage overlap and a bounded resize ease. Existing semantic `300ms`/`1000ms` tokens remain for non-interactive changes. |
| Stable identity is markup metadata, not core state | architecture constraint | Bars, arcs, points, cells, paths, series, and other marks expose stable `data-shiftcharts-*` identity; `@shiftcharts/core` remains pure and serialisable. |
| Cinematic is opt-in | approved scope | `<MotionBoundary preset="cinematic" quality="auto">` observes only rendered marks and owns client-side interruptible animation. |
| Invalid correspondence is honest crossfade | semantic constraint | Equal compatible SVG path command streams morph; incompatible paths, family changes, aggregation changes, and enter/exit use crossfade/presence ghosts. |
| `/motion` is the durable comparison | acceptance fixture | The sandbox keeps the old delayed CSS behavior scoped to the left card and puts the corrected core/cinematic path on the right. Controls are synchronized across timebar/bar, line, and donut cases. |

## Files changed

| Area | Paths | Complete? |
|---|---|---:|
| Grid render context | `packages/grid/src/WidgetGrid.tsx`, `KeyboardGrid.tsx`, `index.ts`, `WidgetGrid.test.tsx` | yes |
| Mark identity and core motion | `packages/primitives/src/**`, `packages/tokens/src/**` | yes |
| Cinematic package | `packages/motion/package.json`, `LICENSE`, `README.md`, `tsdown.config.ts`, `src/**` | yes |
| Sandbox comparison | `apps/sandbox/src/MotionComparison.tsx`, `SandboxApp.tsx`, `main.tsx`, `sandbox.css`, package manifest | yes |
| Verification and release contracts | `scripts/check-motion*.mjs`, screenshot capture, package/API/tree-shake/consumer gates and fixtures, root scripts, lockfile | yes |
| Durable visual proof | `research/assets/motion/timebar-*.png`, `line-*.png`, `donut-*.png` | yes |

## Verification evidence

| Command or check | Exit | Exact result |
|---|---:|---|
| `pnpm build` | 0 | Turbo built all 12 workspace packages, including `@shiftcharts/motion`, sandbox, playground, docs, and RSC fixture. |
| `pnpm typecheck` | 0 | 17 Turbo tasks passed. Current Node 22.12.0 emits the repository-wide warning that the declared floor is >=22.18. |
| Focused Vitest for grid, chart families, and motion | 0 | 7 files and 99 tests passed; motion coverage includes geometry, interruption, incompatible-path crossfade/ghost cleanup, and reduced motion. |
| `pnpm exec vitest run scripts/check-api.test.mjs scripts/check-treeshake.test.mjs scripts/check-built-artifacts.test.mjs scripts/check-consumers.test.mjs scripts/generate-tokens-css.test.mjs` | 0 | 6 files and 45 package/API/generation tests passed. |
| `node scripts/check-package-gates.mjs` | 0 | E1.4 passed: 7 packages, 7 publint/attw pairs, 281 packed files, 8 CSS subpaths, and packed consumer/no-network proof. |
| `pnpm lint:boundary` | 0 | G3 recognizes 7 packages and client boundaries in react, grid, and motion. |
| `pnpm lint:tokens` | 0 | 9 stylesheets clean against 269 declared tokens. |
| `node --experimental-strip-types scripts/generate-tokens-css.mjs` | 0 | Generated token CSS/name output is current; 245 typed declarations, 0 unverified/untiered. |
| Scoped ESLint over changed JS/TS/TSX files | 0 | No findings in the changed motion implementation, fixtures, scripts, or package sources. CSS was ignored by ESLint as expected. |
| `node scripts/check-motion.mjs` on `SHIFTCHARTS_PLAYGROUND_ORIGIN=http://127.0.0.1:5187/?lab=1` | 0 | Existing G19 Chromium motion gate passed; line geometry interpolated, staging was measured, and reduced motion had no intermediate frames. Isolated port avoids the unrelated Vite server on 5173. |
| `node scripts/check-motion-comparison.mjs` | 0 | Real Chromium comparison gate passed on `http://localhost:5176/motion`: resize response, rapid reversal, line, donut/core fallback, no ghosts/overflow, and reduced-motion checks. |
| `pnpm capture:motion` | 0 | Saved durable current/cinematic screenshots for timebar, line, and donut under `research/assets/motion/`. |
| In-app Browser | 0 | `/motion` opened at `http://localhost:5176/motion`; heading, comparison fixture, and responsive layout loaded without browser errors. FT-V1 checklist was opened separately and left unchanged. |
| `git diff --check` | 0 | No whitespace errors. |

## Known failures and limitations

| Failure or limitation | Reproduction | Owner/unblock condition |
|---|---|---|
| `pnpm lint` still reports `console` no-undef at `apps/raw-demo/build.mjs:45-47` | `pnpm lint` | Pre-existing unrelated raw-demo lint configuration issue; changed motion files are clean. |
| Full `pnpm test` retains one pre-existing bar planner legend expectation (`top` versus actual `right`) | `pnpm test` -> 79 files passed, 1 failed; 1037/1038 tests passed | Coordinator should handle this baseline planner expectation separately; focused motion and package/API suites pass. |
| `pnpm lint:tokens:drift` cannot import `packages/tokens/src/tokens.ts` on the installed Node v22.12.0 without the newer runtime behavior | `pnpm lint:tokens:drift` | Use the repository’s declared Node >=22.18 runtime; the same check passes with `node --experimental-strip-types`. |
| The cinematic tail is a bounded WAAPI ease rather than a physics engine | `packages/motion/src/MotionBoundary.tsx` | Intentional first add-on boundary; a future premium spring adapter can be layered without changing core geometry or identity contracts. |

## Current checkpoint

Implementation, focused tests, full build, package gates, browser gates, screenshot capture, and
the handoff are complete. The branch is committed and ready for coordinator integration; FT-V1
remains a separate completed handoff.

## Exact resume command

```bash
pnpm --filter @shiftcharts/motion typecheck
```

## Integrator changes requested

- Review the `/motion` route at `http://localhost:5176/motion` and preserve the old/new screenshot
  artifacts during integration.
- Keep FT-V1 unchanged. If the default G19 port is used, ensure port 5173 is the intended
  playground server; this workspace currently has an unrelated Vite process there.

## Final handoff

- Worker commit: this handoff commit; identify it with `git log -1 --oneline`.
- Branch: `codex/MOTION-RESIZE-V1-cinematic-motion`
- Working tree: clean after the handoff commit.
- Narrow restart check: `pnpm --filter @shiftcharts/motion typecheck`
