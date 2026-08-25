---
id: CR-VT01
title: Visual audit of every chart family across the responsive ladder
type: verification
state: ready
owner: Claude review agent
branch: claude/CR-VT01-visual-family-audit
worktree: /Users/SameeraD/Defence-Charts-CR-VT01
base_commit: 3d22609
depends_on: [D0.2]
started_at: not-started
last_checkpoint: 2026-08-25
---

# CR-VT01 — Visual audit of every chart family across the responsive ladder

## Objective

Independently inspect the rendered family matrix and report where a human cannot identify,
understand, or verify the data shown in an SVG. Cover every registered chart type at every
responsive rung, at desktop and narrow widths, with measured DOM/SVG evidence and focused
screenshots for every issue.

This is a review task. Claude must not fix source code, CSS, tests, registries, or contracts.
Codex will apply accepted fixes in a separate implementation task.

## Read first

- `/Users/SameeraD/Defence-Charts/AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/92-claude-research-workstream.md`
- `research/agent-work/claude/CR-VT01-visual-family-audit.md`
- `research/handoffs/D0.2-information-preservation.md`
- `apps/playground/src/family-matrix/README.md`
- `apps/playground/src/family-matrix/matrix.ts`
- `scripts/check-family-matrix.mjs`
- `scripts/check-family-matrix.test.mjs`

## Allowed write set

- `research/agent-work/claude/CR-VT01-visual-family-audit.md`
- `research/handoffs/CR-VT01.md`
- Temporary screenshots and raw measurements under `/tmp/defence-charts-CR-VT01/` only.

## Do not edit

- Any `packages/**` source, tests, CSS, exports, or generated package output.
- Any `apps/playground/src/**` source or CSS.
- `scripts/**`, registries, root release files, decisions, or other research files.
- Files owned by another active task.

## Acceptance criteria

- [ ] All 10 chart types × 6 rungs are inspected: 60 cards per viewport.
- [ ] Desktop (`1440×1100`) and narrow (`390×844`) observations are recorded.
- [ ] Each observation records the visible information, SVG/viewBox geometry, relevant semantic
      DOM counts, and a comprehension grade; do not report screenshots without measurements.
- [ ] Dark and light themes are checked; forced-colors and reduced-motion are sampled for every
      chart type, with any failure expanded to all affected rungs.
- [ ] Every issue has a reproducible selector, viewport, evidence path, severity, and a proposed
      direction that does not silently invent a new product contract.
- [ ] The report separates repository facts, visual observations, inferences, and proposals.
- [ ] Claude commits only the report and this handoff on the isolated branch.

## Baseline

- Branch: `codex/D0.2-visual-polish`
- Base commit: `3d22609` (current chart-information implementation checkpoint)
- Demo: `http://127.0.0.1:5186/`
- Fixture route: `apps/playground/src/family-matrix-fixture/`
- Current committed browser result: `scripts/results/d0.2-family-matrix.latest.json`
- Current committed screenshot: `scripts/results/d0.2-family-matrix.latest.png`
- Last known green command:
  `GX_REQUIRE_BROWSER=1 npx -y node@24 "$(which pnpm)" scripts/check-family-matrix.mjs`
- Current result summary: 60 cards, ten registered families, no console/page/ResizeObserver
  runtime errors in the latest matrix gate.

## Current checkpoint

### Completed

- Assignment and isolated write boundary prepared.
- Exact chart-family data fixtures and matrix selectors documented in the companion report brief.
- The current matrix implementation includes measured SVG frames, compact value context, and
  static identity rails for compact multi-series charts; Claude must verify these visually rather
  than assume they are correct.

### In progress

- Claude visual inspection and evidence capture.

### Remaining

- Populate the companion report with the full observation table, issue register, evidence paths,
  and implementation acceptance checklist.
- Commit the report and this handoff on `claude/CR-VT01-visual-family-audit`.

### Exact next action

```bash
cd /Users/SameeraD/Defence-Charts-CR-VT01
sed -n '1,260p' research/agent-work/claude/CR-VT01-visual-family-audit.md
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Audit surface | Repository fact | `FamilyMatrixApp.tsx`, `matrix.ts` | Inspect the local family matrix, not an ad-hoc chart. |
| Family set | Repository fact | `FAMILY_TYPES` | `line`, `area`, `bar`, `timebar`, `scatter`, `donut`, `kpi`, `progress`, `heatmap`, `funnel`. |
| Responsive set | Repository fact | `FAMILY_MATRIX` | `micro`, `tile`, `strip`, `panel`, `canvas`, `stage`. |
| Visual truth | Product acceptance | D0.2 information-preservation handoff | A chart must expose useful data context, not merely paint a fitted mark. |
| Code changes | Task boundary | This handoff | Claude reports; Codex implements. |
| External research | Excluded by default | This is a repository visual audit | Do not use web sources to override shipped contracts. Label any optional comparison as inference. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `research/agent-work/claude/CR-VT01-visual-family-audit.md` | Claude's evidence report and observation worksheet | no |
| `research/handoffs/CR-VT01.md` | Task state, scope, reproducibility, and final handoff | no |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| `73cd88b` | `npx -y node@24 "$(which pnpm)" test` | 0 | 74 files, 955 tests passed |
| `73cd88b` | `npx -y node@24 "$(which pnpm)" --filter @gx/playground build` | 0 | Vite build passed; 301 modules |
| `73cd88b` | `GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs` | 0 | Chromium matrix passed; 60 cards and runtime error arrays empty |
| `3d22609` | `npx -y node@24 "$(which pnpm)" test` | 0 | 74 files, 958 tests passed |
| `3d22609` | `npx -y node@24 "$(which pnpm)" build` | 0 | Turbo build passed; 9 packages successful |
| `3d22609` | `GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs` | 0 | Chromium passed 60 cards at desktop and narrow widths; containment and runtime error arrays empty |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None known for the baseline matrix gate | Run the command above | Claude should report visual defects even when automated gates are green. |

## Integrator changes requested

- After Claude's report is committed, Codex should review every issue against current plan/data
  contracts before changing code.
- Promote only confirmed issues into a new implementation handoff; do not edit this review report
  to turn proposals into decisions.

## Final handoff

- Worker commit: not started.
- Branch pushed or locally available: not started.
- Working tree clean: not started.
- Narrow restart check: rerun the matrix at `390×844`, then inspect the first failing card selector.
- Remaining risk/limitations: screenshot evidence is environment-dependent; report browser version,
  OS/font environment, and whether the observation is measured or visual judgment.
