# CR-C02 — Public grid profile contract

Status: proposal for coordinator review
Date/access window: 2026-08-25, repository-only (no external retrieval needed — this is a
repository-evidence confirmation task, not a new-claim task)
Repository baseline: branch `claude/CR-C03-layout-persistence`, worktree
`/Users/SameeraD/Defence-Charts-CR-C03`, base commit `6d17c11` (tip of
`Anti-gravity-and-other-Agent-changes` at task start — `D7.1` closed, `C3.2` is the sole remaining
`backlog` item in the C-track, explicitly gated on `CR-C03`, which itself depends on this task)

## Exact question and exclusions

Test the implications of the locked 12-column contract; treat 6/18-column profiles as a proposal;
define single-column/narrow behavior, conversion/migration risk, and whether any profile information
should reach `ChartPlan`, per `92-claude-research-workstream.md`'s `CR-C02` brief. Default
recommendation stated in the brief itself: *"ship 12 columns in v1 and defer profiles."* Excluded:
reopening the RGL engine choice (locked, decision 6) and layout persistence/migration mechanics
(`CR-C03`, this task's own downstream dependent, written separately).

## Current repository evidence

- `packages/core/src/widget-layout.ts:9-10` — `export const GRID_COLUMNS = 12`, with the doc comment
  *"The locked public v1 grid width. Profiles such as 6 or 18 columns need a later contract."* **This
  is not a proposal to evaluate — it is already the shipped code**, consistent with decision 3
  (`00-decisions.md`: *"12 columns x unlimited rows"*).
- `packages/core/src/widget-layout.ts:38-42` — `LayoutSnapshot` carries `columns: typeof GRID_COLUMNS`
  as a **literal type**, not a general `number`. A snapshot with any other column count cannot be
  constructed by `createLayoutSnapshot()` and is rejected on parse (`parseLayoutSnapshot()`, same file,
  lines 208-214: throws `invalid-snapshot` if `candidate.columns !== GRID_COLUMNS`). **The single-profile
  constraint is enforced at the type and runtime-validation level, not merely documented.**
  Cross-checked against `packages/core/src/widget-layout.test.ts:103` (*"rejects unsupported versions,
  profiles, malformed JSON, and missing items"*) — a live test already exercises the column-profile
  rejection path.
- `packages/grid/src/adapter.ts:1-2,16` — imports `GRID_COLUMNS` from `@gx/core` and pins
  `RGL_VERSION = '2.2.4'` (matching `CR-C01`'s independently-verified installed version) as the single
  profile the adapter is built and verified against.
- No file anywhere in `packages/` references `6` or `18` as a column count, and no `profile` field
  exists on `ChartPlan` (checked via `packages/core/src/plan.ts`, already read in this session's prior
  `CR-D00` task and not re-derived here) or on `WidgetLayout`/`LayoutSnapshot`. **Nothing in the shipped
  contract carries profile information anywhere.**
- `research/90-final-delivery-and-agent-plan.md` §3 "Reconciled contradictions" (already noted in this
  session's earlier `CR-000` task) states the 6/18-column research remains explicitly deferred past C1
  and is not reopened by default.

## External evidence

Not applicable. This is a repository-evidence confirmation task per its own brief; the question is
"does the shipped single-profile contract match the locked decision," not a new external claim.

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| — | — | — | — | — |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| n/a — repository-internal confirmation | n/a | — |

## Findings

### The 12-column contract is already closed, not merely recommended

`CR-C02`'s brief frames this as an open test ("test the implications... default recommendation:
ship 12 columns and defer profiles"), written before `C0`–`C2` existed. The code now shipped
(`C0.1`–`C2.2`, all `done` per the live ledger) already implements exactly that default: `GRID_COLUMNS`
is a single locked constant, `LayoutSnapshot.columns` is typed to that literal, and both construction
and parse paths reject any other value. **Classification: `closed`, confirmed by repository evidence**,
not merely recommended.

### Single-column/narrow behavior

No narrow-width/single-column responsive breakpoint exists in `@gx/grid`'s own contract — the grid
itself does not reflow to fewer columns at small viewport widths; `GRID_COLUMNS` is a constant, not a
function of measured width. This is consistent with the architecture's actual responsive mechanism:
per-widget adaptation happens inside each chart via `planChart()`'s size ladder (`10-responsive-ladder.md`),
not by the grid changing its column count. A host wanting a narrow/mobile layout today would need to
either supply a different `LayoutSnapshot` for that viewport (a host-level decision, consistent with
decision 2's presentational-only boundary) or wait for a future profile contract. **This report does
not invent a narrow-width behavior the code does not have** — it records the current absence
precisely, which is itself the answer this sub-question needs for `CR-C03` and `C3.2` to proceed
without assuming a narrow-mode conversion path exists.

### Conversion/migration risk

Because `columns` is part of the persisted `LayoutSnapshot` shape and is validated on parse, **any
future profile work is a breaking schema change**, not an additive one — a saved snapshot from a
12-column-only world has no `x`/`w` values that are meaningful in, say, an 18-column world without an
explicit conversion function (a straight scale would not preserve visual proportions cleanly across
non-integer ratios like 12→18 = 1.5×, which does divide evenly for widths but not for existing gap/
margin assumptions). **This is the concrete migration-risk fact `CR-C03` needs**: profile support, if
ever added, must be a new `LAYOUT_SCHEMA_VERSION` with an explicit migration function, never a silent
reinterpretation of existing `x`/`y`/`w`/`h` values under a new `columns`.

### Should profile information reach `ChartPlan`?

No, and nothing today does or should. `ChartPlan` (per `packages/core/src/plan.ts`, `10-responsive-ladder.md`)
is keyed on measured pixel size and cell-derived `SizeClass`/`aspect`, not on the grid's column count
directly — a widget's `(w, h)` in cells combined with actual measured pixels (per `AGENTS.md`'s build
rule: *"`@gx/grid` owns outer layout geometry and never decides chart information content"*) already
gives the planner everything it needs regardless of whether the grid is 12, 6, or 18 columns wide. Grid
column count affects how many cells a given pixel width represents, not what a chart plans to show at
a given pixel size. **Adding a profile field to `ChartPlan` would violate the ownership boundary
`CR-I01`/`83` §14 already established** (grid must not leak into chart content decisions) and is not
recommended.

## Alternatives

- **Reopen the engine/column question now, since `91` and `92` list 6/18-column profiles as a live
  research thread.** Rejected: decision 6 and the master plan's own reconciliation (`90` §3) already
  close this for the current milestone; re-litigating it here would contradict the higher-authority
  master plan without new evidence that changes the calculus. Nothing found in this pass supplies such
  evidence.
- **Add a `profile` field to `LayoutSnapshot` now, unused, to ease a future migration.** Rejected: an
  unused field is exactly the kind of premature surface `AGENTS.md`'s "no half-finished
  implementations" spirit warns against, and it would not actually simplify a future migration — the
  conversion math (see above) is the hard part, not the field's presence.

## Recommendation and confidence

Confirm the 12-column-only contract as **closed** (already shipped, not merely proposed), record the
narrow-width absence precisely rather than inventing behavior, and state the conversion-risk fact
above as the input `CR-C03` needs. **Confidence: high** — every claim here is a direct repository read
of already-merged code and its accompanying tests, not a new design proposal.

## Conflicts with locked/current decisions

None. This confirms decision 3 and the `90` §3 reconciliation; it does not challenge either.

## Unknowns

- Whether a future profile contract (if ever commissioned) would use a scale-and-reflow conversion or
  require hosts to re-author layouts manually — not decided here, correctly deferred as out of scope
  for a v1-only report.

## Affected APIs, files, tests and docs

None requiring change — the shipped contract already matches this report's confirmed recommendation.
This report exists to give `CR-C03` a citable, confirmed answer to build on, not to request a code
change.

## Implementation acceptance checklist

- [ ] `CR-C03` treats `LayoutSnapshot.columns` as fixed at `12` for all v1 persistence/migration design
      — no migration path needs to account for a profile change in v1.
- [ ] Any future profile proposal is scoped as a new, explicit `LAYOUT_SCHEMA_VERSION` with a stated
      conversion function — never a silent reinterpretation of stored `x`/`y`/`w`/`h`.
- [ ] No `profile`/`columns`-derived field is added to `ChartPlan`.

## Proposed promotion

**No change** — this report confirms already-shipped, already-correct behavior. **Clarification**
only: `92-claude-research-workstream.md`'s `CR-C02` entry could be marked closed with a pointer to the
shipped `widget-layout.ts` contract, since its own default recommendation is already implemented, not
merely still-recommended.
