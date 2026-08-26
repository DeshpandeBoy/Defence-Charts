---
id: CR-VT01
title: Visual audit of every chart family across the responsive ladder
type: verification
state: handoff
owner: Claude review agent
branch: claude/CR-VT01-visual-family-audit
worktree: /Users/SameeraD/Defence-Charts-CR-VT01
base_commit: 3d22609
depends_on: [D0.2]
started_at: 2026-08-26
last_checkpoint: 2026-08-26
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

- [x] All 10 chart types × 6 rungs are inspected: 60 cards per viewport (120/120 combinations).
- [x] Desktop (`1440×1100`) and narrow (`390×844`) observations are recorded.
- [x] Each observation records the visible information, SVG/viewBox geometry, relevant semantic
      DOM counts, and a comprehension grade; every non-"clean" row was additionally screenshotted
      before scoring — no "looks fine" rows without a measurable reason.
- [x] Dark and light themes are checked (60/60 desktop cards diffed field-by-field, zero
      content/geometry differences); forced-colors sampled (30/30: Micro/Strip/Stage × 10 types);
      reduced-motion set as the default context for every pass per the brief. No forced-colors
      failure required expansion beyond the sampled rungs — every forced-colors observation traced
      to an issue already confirmed at all rungs under normal rendering.
- [x] Every issue (VT-001..VT-011) has a reproducible selector, viewport, evidence path, severity,
      and a proposed direction explicitly labelled as a proposal for Codex, not a decision.
- [x] The report separates repository facts, visual observations, inferences, and proposals (see
      the report's per-issue "Type" classification and "Proposed direction" wording).
- [x] Claude commits only the report and this handoff on the isolated branch (verified via
      `git status --short` before commit — see Final handoff).

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

- Full 120-card audit (60 types×rungs × 2 viewports) with measured DOM/SVG evidence for every card,
  plus a 60-card light-theme diff and a 30-card forced-colors sample. Report fully populated:
  `research/agent-work/claude/CR-VT01-visual-family-audit.md`.
- 9 confirmed, reproducible issues (VT-001..VT-009, all P1 by the brief's scoring rubric) plus 2
  lower-confidence design-question proposals (VT-010, VT-011) written up with root cause, evidence,
  reproduction, and a proposal explicitly marked for Codex/coordinator judgment — not silently
  implemented.
- Ran the documented automated gate (`GX_REQUIRE_BROWSER=1 ... scripts/check-family-matrix.mjs`)
  against this worktree's own dev server: **exit 0, passes**. See "A process hazard found while
  setting up" and "Repository evidence" in the report for why the *first* attempt (against the
  default port `5186`) is not valid evidence about this worktree — a different, concurrently-running
  agent's dev server for the main checkout was already bound to that port. No files outside the
  allowed write set remain changed (the gate run's side-effect on
  `scripts/results/d0.2-family-matrix.latest.json` was reverted with `git checkout --`).

### In progress

- None — task-scoped work is complete. Coordinator review is the next step, per this task's lane
  (Claude reports, only the coordinator promotes/closes).

### Remaining

- None for this task. Follow-on (coordinator-owned): review the 9 confirmed issues, decide which to
  promote into a Codex implementation handoff, and evaluate VT-003's data-model proposal against
  `research/00-decisions.md` before deciding a direction.

### Exact next action

```bash
cd /Users/SameeraD/Defence-Charts-CR-VT01
sed -n '1,80p' research/agent-work/claude/CR-VT01-visual-family-audit.md   # report header + method
# Full issue register:
sed -n '/## Issue register/,/## Alternatives/p' research/agent-work/claude/CR-VT01-visual-family-audit.md
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
| `research/agent-work/claude/CR-VT01-visual-family-audit.md` | Claude's evidence report, full 120-row observation table, and 11-entry issue register | yes |
| `research/handoffs/CR-VT01.md` | Task state, scope, reproducibility, and final handoff | yes |

No file outside this write set was committed. `scripts/results/d0.2-family-matrix.latest.json` was
touched as a side effect of running the documented gate command (it writes its own result file) and
was reverted with `git checkout -- scripts/results/d0.2-family-matrix.latest.json` before this
checkpoint — confirmed via `git status --short` showing only the two files above as changed.

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| `73cd88b` | `npx -y node@24 "$(which pnpm)" test` | 0 | 74 files, 955 tests passed |
| `73cd88b` | `npx -y node@24 "$(which pnpm)" --filter @gx/playground build` | 0 | Vite build passed; 301 modules |
| `73cd88b` | `GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs` | 0 | Chromium matrix passed; 60 cards and runtime error arrays empty |
| `3d22609` | `npx -y node@24 "$(which pnpm)" test` | 0 | 74 files, 958 tests passed |
| `3d22609` | `npx -y node@24 "$(which pnpm)" build` | 0 | Turbo build passed; 9 packages successful |
| `3d22609` | `GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs` | 0 | Chromium passed 60 cards at desktop and narrow widths; containment and runtime error arrays empty |
| `35da6eb` (this session) | `npx --yes pnpm@10.34.5 install` then `npx --yes pnpm@10.34.5 --filter @gx/playground exec vite --config src/family-matrix-fixture.vite.ts --port 5199 --strictPort` (own isolated dev server; default port `5186` was already bound by a concurrent agent's server for the main checkout — see report's "A process hazard" section) | 0 | Server confirmed via `lsof`/`cwd` to be serving `/Users/SameeraD/Defence-Charts-CR-VT01/apps/playground` |
| `35da6eb` (this session) | `GX_REQUIRE_BROWSER=1 GX_FAMILY_MATRIX_ORIGIN=http://127.0.0.1:5199/ npx -y node@24 scripts/check-family-matrix.mjs` | **0** | `D7.1 complete family matrix: Chromium passed` — 60 cards, `outOfCard: []`, `summaryOverlaps: []`, both viewports. This is the valid, in-worktree baseline result. |
| `35da6eb` (this session, discarded) | Same command against the accidental default origin `http://127.0.0.1:5186/` (a different, concurrently-running agent's server for `/Users/SameeraD/Defence-Charts`) | 1 | **Not valid evidence about this worktree** — reported `donut aggregate value is not readable for donut-tile`, which does not reproduce against `3d22609`/this worktree's own server. Recorded here only so a future reader doesn't rediscover the same false lead. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None for the baseline matrix gate itself — it is genuinely green for this worktree. | `GX_REQUIRE_BROWSER=1 GX_FAMILY_MATRIX_ORIGIN=http://127.0.0.1:5199/ npx -y node@24 scripts/check-family-matrix.mjs` (start the dev server on a non-default port first if `5186` may be in use by another concurrent agent) | N/A — not a blocker. |
| 9 confirmed visual-comprehension defects invisible to the automated gate (VT-001..VT-009 in the report) | See the report's Issue register for exact selectors/reproduction per issue | Coordinator to review and promote into a Codex implementation handoff; owner becomes whichever Codex agent picks up the promoted work. |
| `scripts/check-family-matrix.mjs`'s own donut assertion block (~L184) is scoped `card.rung!=='micro'`, so it structurally cannot catch VT-001 (a Micro-only defect) even after a renderer fix, unless that guard is also widened. | Read `scripts/check-family-matrix.mjs` around the `card.type === 'donut'` block | Codex, alongside any VT-001 fix — noted as a gate-scope gap, not something this review task may edit itself. |

## Integrator changes requested

- After Claude's report is committed, Codex should review every issue against current plan/data
  contracts before changing code.
- Promote only confirmed issues into a new implementation handoff; do not edit this review report
  to turn proposals into decisions.
- Priority suggestion (Claude's opinion, not binding): VT-001, VT-004, and VT-008 produce actively
  wrong or non-functional visual claims (a fabricated total, a negative value indistinguishable from
  zero, a legend implying colour-coding the chart doesn't have) and are worth fixing ahead of the
  collision/legibility issues (VT-005/006/007), which are dense-but-correct rather than wrong.
- VT-003 needs a `packages/core` data-model decision (an optional per-point category/label field on
  `DataPoint`) before any fix — recommend routing it through CR-D01/CR-D02 rather than bundling it
  into the same implementation handoff as the CSS/frame-logic fixes above.
- Widen `scripts/check-family-matrix.mjs`'s donut assertion scope (currently skips Micro entirely)
  alongside any VT-001 fix, or the gate will stay green through a regression of the same shape.

## Final handoff

- Worker commit: pending (this checkpoint is written immediately before the commit described below).
- Branch: `claude/CR-VT01-visual-family-audit`, local to `/Users/SameeraD/Defence-Charts-CR-VT01`
  (not pushed to a remote — no remote push was requested or performed).
- Working tree clean: yes, aside from the two files in this task's allowed write set — confirmed via
  `git status --short` immediately before commit (the one incidental change,
  `scripts/results/d0.2-family-matrix.latest.json`, was reverted with `git checkout --`).
- Dev server: the isolated `vite --port 5199` process started for this audit was terminated before
  this checkpoint (`kill` on its PID, confirmed no listener remains on `5199`). The concurrent
  agent's unrelated server on port `5186` was left untouched throughout, per instructions to never
  touch the main checkout.
- Narrow restart check: `cd /Users/SameeraD/Defence-Charts-CR-VT01 && npx --yes pnpm@10.34.5
  --filter @gx/playground exec vite --config src/family-matrix-fixture.vite.ts --port 5199
  --strictPort &` then, from a fresh Playwright page at `http://127.0.0.1:5199/` with viewport
  `390×844`, inspect `[data-family-case="heatmap-stage"]`'s x-axis tick labels (VT-007) — the fastest
  single-card reproduction of a confirmed issue.
- Remaining risk/limitations: screenshot/label-width evidence is this-machine-and-browser-dependent
  (macOS 26.6.2, Chromium 151.0.7922.34 via Playwright 1.62.1); not cross-checked against Windows/
  Segoe UI Variable or another engine. Every issue in the register is independently confirmed via
  computed DOM/style values in addition to a screenshot, so the underlying defects (as opposed to
  their exact pixel measurements) should reproduce on any platform. State: `handoff` — only the
  coordinator may move this to `done`.
