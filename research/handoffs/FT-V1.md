---
id: FT-V1
title: ShiftCharts polished demo shell
type: implementation
state: handoff
owner: Codex
branch: Fine-Tuning-V1
worktree: /Users/SameeraD/Defence-Charts
base_commit: 20709d9af90fbe2e34b24a8eac6df415579f4bac
depends_on: []
started_at: 2026-08-26T00:00:00+05:30
last_checkpoint: 2026-08-26T23:25:50+05:30
---

# FT-V1 — ShiftCharts polished demo shell

## Objective

Turn the main local playground into a first-pass product showcase that makes the
drag/resize-to-chart behavior understandable within five seconds, while keeping
the existing engineering fixtures available and unchanged for verification.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `apps/playground/src/App.tsx`
- `apps/playground/src/grid-fixture/GridFixture.tsx`

## Allowed write set

- `apps/playground/src/App.tsx`
- `apps/playground/src/main.tsx`
- `apps/playground/src/ShiftChartsDemo.tsx`
- `apps/playground/src/shiftcharts-demo.css`
- `apps/playground/index.html`
- `apps/playground/README.md`
- `research/handoffs/FT-V1.md`

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- `research/00-decisions.md`
- `apps/playground/src/grid-fixture/**`
- `apps/playground/src/*fixture*`
- packages and central shared integration files not named above
- files owned by another active task

## Acceptance criteria

- [x] The main playground has a clear ShiftCharts showcase headline, a visible interaction cue, and three realistic dashboard widgets.
- [x] The primary demo uses the existing grid/chart primitives and retains stable widget identity through layout changes.
- [x] Edit mode, reset, and the optional inspector are understandable without exposing the engineering fixture vocabulary by default.
- [x] The main route has no horizontal overflow at the audited 620px viewport and remains coherent at desktop width.
- [x] Existing diagnostic fixture routes remain unchanged and the playground typecheck/build pass.
- [x] Browser verification covers initial render, responsive layout, and at least one real keyboard layout interaction; `git diff --check` passes.
- [x] Documentation describes only shipped behavior.

## Baseline

- Branch: `Fine-Tuning-V1`
- Base commit: `20709d9af90fbe2e34b24a8eac6df415579f4bac`
- Initial `git status --short`: clean
- Last known green command/commit: `20709d9 docs(E3.1): record keyboard cancel P0 verification`
- Local browser servers: main playground `http://127.0.0.1:5175/`; grid fixture `http://127.0.0.1:5184/`

## Current checkpoint

### Completed

- Audited the main resize lab and grid fixture at desktop and the 620px viewport.
- Confirmed the grid fixture is intentionally diagnostic and must remain available.
- Recorded the first-pass product direction: polished showcase shell, realistic widgets, visible edit/reset affordance, compact inspector on demand.

### In progress

- Inspected the existing `WidgetGrid`, `WidgetShell`, `AutoChart`, and playground entrypoint contracts.
- Added the first product-facing dashboard shell to the main playground route; `/?lab=1` keeps the resize lab reachable.
- Updated the playground README so its documented entrypoint matches the shipped local demo and lab toggle.
- Re-ran the local browser pass after removing decorative text glyphs from the product surface.
- No implementation work remains for this checkpoint.

### Remaining

- Coordinator integration/review only. Follow-up visual refinement can build on this committed shell.

### Exact next action

```bash
pnpm --filter @shiftcharts/playground typecheck
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Main route becomes the polished showcase | approved scope | User said “yes lets do it” after the audit recommendation | Keep existing diagnostics in their dedicated fixture routes and make `/` product-facing. |
| Use existing grid and chart primitives | implementation constraint | `AGENTS.md` build rules and current package architecture | No parallel layout or chart renderer. |
| First pass is shell and hierarchy, not a renderer rewrite | scope boundary | Audit found the largest issue was demo framing and responsive overflow | Defer visual token/color and chart-family expansion until the shell is validated. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `apps/playground/src/ShiftChartsDemo.tsx` | Product-facing dashboard demo composition | yes |
| `apps/playground/src/shiftcharts-demo.css` | Responsive presentation for the showcase shell | yes |
| `apps/playground/src/main.tsx` | Main route selection and grid style imports | yes |
| `apps/playground/index.html` | Product-facing document title | yes |
| `apps/playground/README.md` | Document the shipped local demo and measurement lab | yes |
| `research/handoffs/FT-V1.md` | Durable task contract and restart checkpoint | no |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| `20709d9` | startup checks and baseline inspection | 0 | Branch and worktree were clean before implementation. |
| `5342e0a` | `pnpm --filter @shiftcharts/playground typecheck` | 0 | TypeScript check passed; pnpm emitted only the known Node engine warning for v22.12.0 versus >=22.18. |
| `5342e0a` | `pnpm --filter @shiftcharts/playground build` | 0 | Vite production build passed; 346 modules transformed. |
| `5342e0a` | `pnpm --filter @shiftcharts/grid typecheck` | 0 | Grid package typecheck passed. |
| `5342e0a` | `pnpm test -- packages/grid/src/WidgetGrid.test.tsx packages/grid/src/KeyboardGrid.test.tsx` | 0 | Vitest passed 74 files and 973 tests. |
| `5342e0a` | `git diff --check` | 0 | No whitespace errors. |
| `5342e0a` | Browser at `http://127.0.0.1:5175/` | 0 | 620px viewport: title and headline present, 3 widgets present, `scrollWidth === innerWidth === 620`, no console errors/warnings. |
| `5342e0a` | Browser keyboard interaction | 0 | Net revenue moved from column 1 to column 2 and committed; reset restored column 1; read-only removed edit controls. |
| `5342e0a` | Browser route preservation | 0 | `/?lab=1` retained Resize lab and widget; grid fixture at `http://127.0.0.1:5184/` retained its root and heading with no console errors/warnings. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| Native pointer drag on the main CSS resize handle did not move the handle in the in-app browser driver | Two CUA attempts during audit | Browser-driver limitation; verify the product interaction through supported grid keyboard controls and DOM state. |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: `5342e0a feat(FT-V1): add polished ShiftCharts demo`
- Branch pushed or locally available: local branch `Fine-Tuning-V1`
- Working tree clean: pending final handoff commit
- Narrow restart check: `pnpm --filter @shiftcharts/playground typecheck`
- Remaining risk/limitations: Pointer drag on the standalone CSS resize handle is not reproducible in the in-app browser driver; keyboard grid movement is verified. No deployment or push was requested.
