---
id: CR-C03
title: Layout persistence and migration (with CR-C02 grid-profile prerequisite)
type: research
state: handoff
owner: claude-research
branch: claude/CR-C03-layout-persistence
worktree: /Users/SameeraD/Defence-Charts-CR-C03
base_commit: 6d17c11
depends_on: [P0.1, CR-C02]
started_at: 2026-08-25T09:00:00+05:30
last_checkpoint: 2026-08-25T09:45:00+05:30
---

# CR-C03 — Layout persistence and migration

## Objective

Clear the explicit gate `research/handoffs/C3.2.md` states: *"This task is intentionally not ready
for implementation until Claude delivers CR-C03 layout persistence and migration research."* Per
`92-claude-research-workstream.md`, `CR-C03` formally depends on `CR-C02` (public grid profile
contract), which had not been written either — both are delivered together in this task since `CR-C03`
cannot be honestly written without first confirming the profile question it assumes an answer to.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/92-claude-research-workstream.md`
- `research/handoffs/C3.2.md` (the gated task this report unblocks)
- `research/agent-work/claude/CR-C01-grid-engine.md` (this session's prior RGL evidence, reused for
  the "RGL leaves persistence to the host" fact)
- `research/agent-work/claude/CR-C04-grid-input-accessibility.md` (this session's prior task, same
  code area — `WidgetGrid.tsx`'s commit-callback surface, reused not re-derived)
- `packages/core/src/widget-layout.ts`
- `packages/core/src/widget-layout.test.ts`
- `packages/grid/src/adapter.ts`

## Allowed write set

- `research/agent-work/claude/CR-C02-grid-profiles.md`
- `research/agent-work/claude/CR-C03-layout-persistence.md`
- `research/handoffs/CR-C03.md`

## Do not edit

- `packages/**`
- `docs/**`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md` (master ledger)
- `research/handoffs/C3.2.md` or any other agent's handoff/in-progress files

## Acceptance criteria

- [x] `CR-C02`: test the 12-column contract's implications, single-column/narrow behavior, conversion/
      migration risk, and whether profile information should reach `ChartPlan` — confirmed against
      already-shipped code, not left as an open recommendation.
- [x] `CR-C03`: specify stable IDs, schema version, add/remove/rename behavior, invalid layouts,
      constraint changes, failed saves, conflicts, and reconciliation fixtures.
- [x] Storage stays host-owned; no persistence backend proposed or implied for the library itself.
- [x] Every claim labeled by evidence class; the one external source fetched is labeled precisely for
      what it does and does not establish.
- [x] The handoff records exact commands/fetches run, changed paths, and resume command.

## Baseline

- Branch: `claude/CR-C03-layout-persistence`
- Worktree: `/Users/SameeraD/Defence-Charts-CR-C03` (isolated `git worktree add`, separate from the
  shared main working directory and from this session's earlier `CR-C04` worktree)
- Base commit: `6d17c11` (`chore(D7.1): record integration closure` — tip of
  `Anti-gravity-and-other-Agent-changes` at task start; `D7.1` closed, `C3.2` is the sole remaining
  `backlog` item in the C-track)
- Initial `git status --short`: clean (fresh worktree)

## Current checkpoint

### Completed

- Read `packages/core/src/widget-layout.ts` in full: confirmed `GRID_COLUMNS`/`LAYOUT_SCHEMA_VERSION`
  already exist, `parseLayoutSnapshot()` already exists but has no migration branch (unconditional
  reject on any version mismatch), and no add/remove/rename reconciliation exists anywhere in
  `packages/`.
- Read `packages/grid/src/adapter.ts`: confirmed `normalizeLayoutSnapshot()` re-validates/re-compacts
  an existing item set but is not a reconciliation function against a changed widget set.
- Grepped `packages/core/src/widget-layout.test.ts`: confirmed zero test coverage for migration,
  reconciliation, post-save constraint changes, or conflicts.
- Fetched `redux-persist`'s migration docs as a precedented, directly transferable pattern shape
  (integer version + keyed migration map); recorded precisely what that source does and does not
  answer (sequencing, newer-than-current, missing-version were all confirmed absent from the doc by
  direct fetch, not assumed).
- Wrote `research/agent-work/claude/CR-C02-grid-profiles.md`: confirms the 12-column contract is
  already closed in shipped code (not merely recommended), states the narrow-width absence precisely,
  and gives `CR-C03` the conversion-risk fact it needs (any future profile is a breaking schema change).
- Wrote `research/agent-work/claude/CR-C03-layout-persistence.md`: proposes a sequential migration map,
  a new `reconcileLayoutSnapshot()` pure function with explicit add/remove/constraint-change policy
  (clamp, not reject, on constraint growth), keeps failed-saves/conflicts host-owned, and lists ten
  concrete reconciliation fixtures for `C3.2`'s test suite.

### In progress

- Nothing.

### Remaining

- Coordinator reviews both reports and decides whether to accept the recommended policy choices
  (clamp-not-reject on constraint violation; explicit-default-with-fallback for new-widget placement;
  strict-reject for a missing/unset version) or record deviations in `C3.2`'s own handoff.
- `C3.2` (Codex) implements against `CR-C03`'s proposal once the gate clears.

### Exact next action

```bash
git -C /Users/SameeraD/Defence-Charts-CR-C03 log -1 --oneline -- research/agent-work/claude/CR-C02-grid-profiles.md research/agent-work/claude/CR-C03-layout-persistence.md research/handoffs/CR-C03.md
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| `CR-C02` and `CR-C03` are delivered together in one task/branch | Process decision | `92-claude-research-workstream.md`: "CR-C03... Depends on: CR-C02"; neither existed yet | `CR-C03` cannot be honestly written without first confirming the profile question; both output files are produced, one handoff covers both |
| Migration/reconciliation belong in `@gx/core`, not `@gx/grid` | Repository evidence + inference | `widget-layout.ts` already owns every other layout invariant (validation, serialization); keeping it DOM-free and framework-agnostic matches `AGENTS.md`'s build rule for `@gx/core` | `C3.2`'s new modules should extend `packages/core/src/widget-layout.ts`, not add a parallel persistence module in `packages/grid` |
| Storage remains entirely host-owned | Existing decision | Decision 2 (`00-decisions.md`); `C3.2`'s own write-set explicitly forbids localStorage/URL/DB/network | No persistence backend is proposed by either report |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `research/agent-work/claude/CR-C02-grid-profiles.md` | Confirms the 12-column contract as closed and states the conversion-risk fact `CR-C03` needs | yes |
| `research/agent-work/claude/CR-C03-layout-persistence.md` | Migration/reconciliation proposal that clears `C3.2`'s gate | yes |
| `research/handoffs/CR-C03.md` | Durable checkpoint for both reports | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| working tree | `grep -n "describe(\|it(\|test(" packages/core/src/widget-layout.test.ts` | 0 | seven existing test cases listed; none cover migration/reconciliation/constraint-change/conflict, confirming the gap this report addresses |
| working tree | `grep -rln "migrat\|reconcil" packages/ --include="*.ts" --include="*.tsx"` | 0 | hits only in unrelated chart-interaction-state/value-display modules, confirming no layout-persistence migration/reconciliation code exists anywhere |
| N/A (read-only) | `git diff --check` | 0 | no whitespace errors in this worktree's changes |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None known | — | Both reports are complete proposals; no retrieval failure blocked either |

## Integrator changes requested

- Coordinator should review `CR-C02` and `CR-C03` together, clear `C3.2`'s gate (update
  `research/handoffs/C3.2.md`'s state once satisfied — this task does not edit that file itself, per
  its write-set), and decide on the three flagged policy choices in `CR-C03`'s Unknowns section.

## Final handoff

- Worker commit: pending — to be committed in this worktree together with this handoff
- Branch pushed or locally available: locally available at `/Users/SameeraD/Defence-Charts-CR-C03` on
  `claude/CR-C03-layout-persistence`
- Working tree clean: no — the three files above are new, pending commit
- Narrow restart check: `git -C /Users/SameeraD/Defence-Charts-CR-C03 diff --check && rg -n "^##|^###" research/agent-work/claude/CR-C02-grid-profiles.md research/agent-work/claude/CR-C03-layout-persistence.md`
- Remaining risk/limitations: the migration-sequencing and reconciliation-policy choices are this
  report's own proposal (labeled as such) since neither the existing code nor the one external source
  fetched dictates them; `C3.2` should treat them as a starting design, not an unquestionable spec.
