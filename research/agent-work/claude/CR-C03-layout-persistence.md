# CR-C03 — Layout persistence and migration

Status: proposal for coordinator review
Date/access window: 2026-08-25, repository evidence plus one external retrieval (dated below)
Repository baseline: branch `claude/CR-C03-layout-persistence`, worktree
`/Users/SameeraD/Defence-Charts-CR-C03`, base commit `6d17c11`
Depends on: `CR-C02-grid-profiles.md` (this session, same branch) — confirms the persisted shape is
locked to the 12-column profile for all of v1, which this report assumes throughout.

## Exact question and exclusions

Specify stable IDs, schema version, add/remove/rename behavior, invalid layouts, constraint changes,
failed saves, conflicts, and reconciliation fixtures for grid layout persistence, per
`92-claude-research-workstream.md`'s `CR-C03` brief. Storage remains host-owned. This is the explicit,
named gate on `C3.2` (`research/handoffs/C3.2.md`: *"This task is intentionally not ready for
implementation until Claude delivers CR-C03... Do not invent persistence policy or storage ownership
while that research is missing"*). Excluded: choosing or implementing an actual storage backend
(localStorage/URL/DB — explicitly host-owned, `C3.2`'s own write-set forbids the library from adding
any); keyboard/touch input mechanics (`CR-C04`, a separate, already-delivered report in this session on
a different branch).

## Current repository evidence

- `packages/core/src/widget-layout.ts:12-13` — `LAYOUT_SCHEMA_VERSION = 1` already exists as an
  exported constant, and `LayoutSnapshot.version` is typed to that literal (line 39), not a general
  `number`. **A version field already exists; a migration mechanism does not.**
- `packages/core/src/widget-layout.ts:187-220` (`parseLayoutSnapshot`) — already handles: JSON-string
  or pre-decoded input, malformed JSON, non-object payloads, non-array `items`, and (lines 201-207)
  **unconditionally throws `unsupported-version` for any version other than the current one — there is
  no migration branch.** This is the exact, precise gap this report exists to close: today, changing
  `LAYOUT_SCHEMA_VERSION` in a future release would make every previously saved layout fail to load,
  because `parseLayoutSnapshot` has nowhere to route an old-version payload before rejecting it.
- `packages/core/src/widget-layout.ts:84-89` (`createWidgetId`) — a widget ID is any non-empty,
  trimmed-non-blank string; **stability is a caller convention (the host supplies the same string
  across sessions), not something the library derives, generates, or persists metadata about.** No ID
  history, alias, or rename-tracking field exists anywhere in `WidgetLayout`, `LayoutSnapshot`, or any
  related type.
- `packages/core/src/widget-layout.ts:154-170` (`validateWidgetLayouts`) — already rejects duplicate
  IDs within one snapshot (`duplicate-id`) and validates every item's coordinates/constraints
  individually. **There is no cross-check against a separate "current widget set"** — nothing compares
  a loaded snapshot's IDs against the IDs a host is about to render this session. Add/remove/rename
  reconciliation is entirely unimplemented, not merely unfinished.
- `packages/grid/src/adapter.ts:90-96` (`normalizeLayoutSnapshot`) — re-validates and re-compacts a
  snapshot's *existing* items through the pinned RGL `./core` algorithms (`correctBounds`,
  `getCompactor('vertical')`). It operates on the item set as given; it does not add a missing widget
  or drop an extra one. **Confirmed by direct read: this function is not a reconciliation step**, and
  nothing else in `packages/grid/src` is either (grepped `migrat|reconcil` across `packages/`: the only
  hits are in unrelated chart-interaction-state and value-display modules, not layout persistence).
- `packages/core/src/widget-layout.test.ts` — grepped every `describe`/`it`: round-trip serialization,
  default canonicalisation, duplicate-ID rejection, and unsupported-version/profile/malformed-JSON
  rejection are covered. **Zero tests exist for migration, add/remove/rename reconciliation,
  post-save constraint changes, or conflicting saves** — confirming this is unimplemented, not just
  untested.
- `packages/grid/src/WidgetGrid.tsx` (read in this session's prior `CR-C04` task, same facts reused
  here) — `onLayoutChange`/`onLayoutCommit` already hand the host a deduplicated, committed
  `LayoutSnapshot` on every settled drag/resize. This is the **save trigger** a host would wire to its
  own storage; the library already produces exactly the payload a host needs to persist. What is
  missing is entirely on the **load** side (parse-time migration/reconciliation), not the save side.

## External evidence

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| A widely-used precedent for versioned, host-persisted UI/app state uses an integer version number plus a keyed map of migration functions (`{0: migrateFn, 1: migrateFn, ...}`), invoked automatically when the stored version is below the app's current version; migration is skipped if the stored version already matches | Official documentation (project docs, not independently exhaustive — see Retrieval log) | [redux-persist, `docs/migrations.md`](https://github.com/rt2zz/redux-persist/blob/master/docs/migrations.md), retrieved 2026-08-25 | The general shape (`version: number` + `{[version]: migrate}`) is a legitimate, precedented pattern directly transferable to `LayoutSnapshot.version` | The document itself does **not** state whether migrations apply sequentially (0→1→2) or jump directly to the newest, nor what happens when the stored version is *higher* than the app's current version, nor the behavior for a missing/unset version — confirmed absent by direct fetch, not assumed. This report's proposal below states its own answers to these three questions as **inference/proposal**, not as citations of this source |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| `redux-persist` migrations doc | Fetched directly, 2026-08-25 | Confirmed the pattern shape but not the three sequencing/edge-case questions above; those are this report's own proposal, labeled as such |
| A charting/dashboard-library-specific precedent for grid-layout schema migration (e.g., a public library with the same "12-column persisted layout" shape) | Not attempted this pass | `react-grid-layout` itself (this project's engine) documents *that* layouts can be serialized (`CR-C01`'s finding: README §"Saving Layout to LocalStorage") but not a migration scheme — RGL leaves persistence entirely to the host, consistent with this project's own decision 2. No further external precedent was sought because the redux-persist pattern already supplies a sufficient, well-known shape and this project's actual need (a small, host-owned versioned blob) is simpler than a full Redux store |

## Proposal

### Stable IDs

No change to `createWidgetId` — the existing convention (host-supplied, non-empty, non-blank string,
stable across sessions) is sufficient and already enforced. **This report does not propose the library
generate or track IDs.** A "rename" is, by construction, indistinguishable from a
remove-and-add-a-different-widget unless the host itself decides to reuse the same `id` for the
conceptually-renamed widget — which is the correct behavior for this project's boundary (decision 2:
presentational only; identity policy is a host concern). This report's add/remove logic (below) treats
any ID not in the current render set as "removed" and any ID in the current render set not in the
snapshot as "added" — there is no third "renamed" case for the library to detect, only for the host to
avoid triggering by reusing IDs deliberately.

### Schema version and migration

Add `LAYOUT_SCHEMA_VERSION` handling directly analogous to the redux-persist shape, adapted to this
project's simpler, single-blob (not whole-Redux-store) need:

```ts
type LayoutMigration = (raw: Record<string, unknown>) => Record<string, unknown>
const LAYOUT_MIGRATIONS: Readonly<Record<number, LayoutMigration>> = Object.freeze({
  // 1: (v0) => ({ ...v0, version: 1 /* ... */ }),
})
```

- **Sequential application (proposal, not sourced)**: if a stored `version` is below current, apply
  each migration in order from `storedVersion` to `LAYOUT_SCHEMA_VERSION - 1` before the final
  `createLayoutSnapshot()` validation. This is proposed rather than "jump directly to newest" because
  each migration step stays small and independently testable — matching this project's own stated
  test philosophy (`AGENTS.md`: "Inspect actual source/dependency APIs before implementation" and the
  granular, per-step provenance style already used throughout `research/`).
- **Stored version newer than current (proposal)**: fail loudly with a new, distinct
  `LayoutValidationError` code (e.g., `future-version`), never silently attempt to load — a host
  running an older library build must not guess at a newer schema's meaning. This is the same
  fail-loud philosophy `LAYOUT_SCHEMA_VERSION`'s own doc comment already states (*"Unsupported versions
  fail loudly at the boundary"*), extended to the specific newer-than-current case the current code
  does not yet distinguish from any-other-mismatch.
- **Missing/unset version (proposal)**: treat as version `0` (pre-versioning) if and only if the
  coordinator decides to support migrating pre-existing unversioned layouts; otherwise treat exactly
  like any other unsupported version and reject. This report does not decide this for the coordinator
  — no pre-`LAYOUT_SCHEMA_VERSION` payload is known to exist in any shipped release yet (the field has
  existed since `C0.1`, which is `done`, and no earlier public release has occurred), so the simpler
  answer (reject a missing version like any other mismatch) is likely sufficient and is this report's
  **recommendation**, with the `0`-treatment noted only as a fallback if evidence of real unversioned
  saved data ever surfaces.
- No migration function exists yet because `LAYOUT_SCHEMA_VERSION` has never been bumped — this report
  specifies the mechanism `C3.2` should build, not a concrete migration (there is nothing to migrate
  from yet).

### Add/remove/rename reconciliation

A new pure function, e.g. `reconcileLayoutSnapshot(snapshot, currentWidgetIds, defaultPlacement)`:

- **Widget ID present in the snapshot but not in `currentWidgetIds`** ("removed"): drop it from the
  reconciled result. The host's currently-rendered widget set is authoritative — the library must not
  keep phantom placements for widgets that no longer exist in this render, since `renderItem` (per
  `WidgetGrid.tsx`) has no content to show for an ID that never gets passed in.
- **Widget ID present in `currentWidgetIds` but not in the snapshot** ("added"): assign a default
  placement. Two candidate policies, presented as alternatives (see below) rather than resolved
  unilaterally, since this is a product-taste decision, not a correctness one: (a) append below all
  existing items at `x: 0, y: <max existing y+h>`, relying on the existing vertical compactor
  (`adapter.ts`'s `getCompactor('vertical')`) to settle it; or (b) require the host to supply an
  explicit default placement per new widget via `defaultPlacement`, with (a) as the fallback only when
  the host does not. **Recommendation: (b) with (a) as fallback** — a host almost always knows a
  sensible default size for its own new widget type, and forcing that choice to be explicit prevents a
  surprising auto-placed size for, say, a KPI tile that should default to `1×1`, not the library's
  generic guess.
- **Duplicate IDs within the incoming current-widget-id list**: this is a host bug, not a library
  concern to silently repair — `reconcileLayoutSnapshot` should throw the same `duplicate-id`-shaped
  error `validateWidgetLayouts` already raises for duplicate IDs within a snapshot, for consistency.
- The reconciled result is re-validated through the existing `createLayoutSnapshot()` (unconditionally
  called at the end), so every existing invariant (bounds, constraints, no negative coordinates)
  applies to the reconciled output for free — no new validation logic is needed beyond ID
  cross-referencing.

### Constraint changes since save

If a widget's `minW`/`minH`/`maxW`/`maxH`/`draggable`/`resizable` constraints have changed in code
since the layout was last saved (e.g., a chart family's minimum footprint policy changed), a saved
`w`/`h` may now violate the *current* constraints even though it was valid when saved. **Proposal**:
`reconcileLayoutSnapshot` should accept the *current* constraint values as part of `currentWidgetIds`'s
shape (i.e., the host passes current `WidgetLayoutConstraints` per ID, not just a bare ID list), apply
them to the reconciled item, and let the existing `createWidgetLayout()` validation
(`widget-layout.ts:97-151`) reject or clamp as appropriate. This report recommends **clamp, not
reject**: silently failing to load a whole dashboard because one widget's minimum size grew by one
cell is a worse failure mode than growing that one widget to its new minimum and letting the compactor
resettle the rest — consistent with the existing compaction-based recovery philosophy already used
throughout `adapter.ts`/`constraints.ts`.

### Failed saves and conflicts

Both remain **entirely host-owned**, per decision 2 and `C3.2`'s own write-set restriction (no
localStorage/URL/DB/network in the library). The library's only responsibility is to make failure
*legible* to a host that chooses to detect it: `serializeLayoutSnapshot()`/`parseLayoutSnapshot()`
already throw typed, addressable errors (`LayoutValidationError` with a `code`), which a host's own
save/load wrapper can catch and react to (retry, show a stale-data banner, prompt for reconciliation).
**This report does not propose any new library-owned conflict-resolution logic** — e.g., last-write-wins
or a merge strategy for two tabs saving concurrently is a host application concern, not something a
presentational library can correctly decide without knowing the host's storage semantics (decision 2's
whole rationale). What the library *should* guarantee, and does not fully yet: every failure mode
(parse failure, migration failure, reconciliation failure) throws a distinctly-coded error a host can
distinguish in a `catch`, rather than a generic `Error`. `LayoutValidationError`'s existing `code`
union should gain `future-version` (see above) and whatever code `reconcileLayoutSnapshot` needs for a
duplicate-ID host bug.

### Reconciliation fixtures (for `C3.2`'s test suite)

Concrete cases `C3.2` should cover, derived directly from the above (not exhaustive of every
possible input, but covering every branch this report identifies):

1. Round-trip with no changes (already covered by existing tests — confirm it still passes after
   `C3.2`'s additions, as a regression guard).
2. Save at version 1, load at version 1 (no migration invoked) — the common case.
3. Save at version 1, load with `LAYOUT_SCHEMA_VERSION` hypothetically bumped to 2 in a test-only
   migration map — migration applied, result validates.
4. Load with a stored version higher than current — rejected with the distinct `future-version` code,
   not the generic `unsupported-version` used for a lower/unknown version today.
5. Snapshot contains a widget ID the host is not currently rendering — dropped from the reconciled
   result.
6. Host is currently rendering a widget ID absent from the snapshot — placed via the explicit
   `defaultPlacement` when supplied, or the append-below fallback when not.
7. Both 5 and 6 in the same reconciliation (simultaneous add and remove) — order of operations should
   not matter to the final result (a determinism test, matching this project's existing "stability"
   test philosophy from the responsive ladder work).
8. A widget's current `minW` (host-supplied) exceeds its saved `w` — clamped up, not rejected, and the
   compactor resettles any resulting collision.
9. Duplicate IDs in the host's current-widget-id input — rejected with a `duplicate-id`-shaped error,
   not silently deduplicated.
10. Malformed/corrupted stored JSON, non-object, non-array `items` — already covered by existing tests;
    confirm coverage survives the migration/reconciliation additions.

## Alternatives

- **Have the library own actual storage (e.g., ship a `localStorage` adapter as an opt-in convenience).**
  Rejected: directly forbidden by `C3.2`'s own write-set ("Do not add localStorage, URL, database, or
  network persistence") and by decision 2's presentational-only boundary.
- **Auto-detect renames via heuristic matching (e.g., same size/position, different ID → assume
  rename).** Rejected: unreliable and surprising — two genuinely different widgets can share a size and
  position coincidentally, and a real rename-with-different-size would not match. The explicit
  "host reuses the ID" convention is simpler, correct, and consistent with treating the host as the
  identity authority (matching `CR-I01`'s existing rule: identity is `Series.id`, host-supplied, never
  inferred).
- **Reject-only on constraint violation after reconciliation, instead of clamping.** Considered and not
  recommended (see above) but not unreasonable — recorded as the alternative to the recommended clamp
  behavior for the coordinator to weigh.

## Recommendation and confidence

Add a `LAYOUT_MIGRATIONS`-style sequential migration map (redux-persist-precedented shape, adapted) and
a new `reconcileLayoutSnapshot()` pure function alongside the existing `parseLayoutSnapshot()`, both
living in `packages/core/src/widget-layout.ts` (the same module that already owns every other layout
invariant) rather than in `@gx/grid`, keeping migration/reconciliation DOM-free and framework-agnostic
like the rest of that module. **Confidence: high** on the mechanism shape (directly extends existing,
already-tested code with the same validation pipeline) and on the add/remove reconciliation logic
(a direct, low-ambiguity consequence of "the host's current render set is authoritative"). **Confidence:
medium** on the specific policy choices flagged as recommendations rather than derived facts — clamp-not-reject
on constraint violation, and explicit-default-with-fallback for new-widget placement — both are
reasonable but are this report's judgment, not something the existing code or an external source
dictates.

## Conflicts with locked/current decisions

None. This keeps storage entirely host-owned (decision 2) and treats the grid as placement-only,
never chart-content-aware (`AGENTS.md` build rules, already-established `@gx/grid` boundary).

## Unknowns

- Whether the coordinator wants the `0`-as-unversioned fallback for missing `version` fields, or a
  strict reject — this report recommends strict reject as the simpler default, given no pre-versioned
  saved data is known to exist yet, but does not treat this as settled.
- Real-world conflict scenarios (multi-tab, multi-user) are explicitly out of the library's scope by
  decision 2, but this report has not surveyed how *other* comparable libraries document guidance for
  their hosts on this exact problem (e.g., a recommended "read-modify-write with an ETag-like guard"
  pattern) — a possible follow-up if the coordinator wants host-facing documentation on this, not a
  library-code gap.

## Affected APIs, files, tests and docs

- `packages/core/src/widget-layout.ts` — add `LAYOUT_MIGRATIONS` map, extend `parseLayoutSnapshot()` to
  consult it, add the `future-version` error code, add `reconcileLayoutSnapshot()`.
- `packages/core/src/widget-layout.test.ts` — add the ten fixture cases enumerated above.
- `research/handoffs/C3.2.md` — the gate this report exists to clear; `C3.2` should cite this report's
  proposal section directly as its design basis rather than re-deriving migration/reconciliation policy.
- No `packages/grid/**` change is required by this report — reconciliation and migration are core-layer
  concerns, not RGL-adapter concerns, consistent with keeping `@gx/core` the single owner of the layout
  invariant surface.

## Implementation acceptance checklist

- [ ] `LAYOUT_MIGRATIONS` is a frozen, integer-keyed map; migrations apply sequentially from the stored
      version to current, never jumping directly, per this report's proposal.
- [ ] A stored version higher than `LAYOUT_SCHEMA_VERSION` fails with a distinct `future-version` code,
      not the generic `unsupported-version`.
- [ ] `reconcileLayoutSnapshot()` drops IDs absent from the current render set and places IDs absent
      from the snapshot via an explicit host-supplied default, falling back to append-below-compact
      only when no default is supplied.
- [ ] Constraint changes since save are clamped (not rejected) and re-settled by the existing
      compactor, per this report's recommendation — or, if the coordinator prefers reject-on-violation,
      that deviation is recorded in `C3.2`'s own handoff as a deliberate departure from this proposal.
- [ ] All ten reconciliation fixtures in this report are represented in `C3.2`'s test suite (existing
      round-trip/rejection tests already cover fixtures 1 and 10; the other eight are new).
- [ ] No storage backend (localStorage/URL/DB/network) is added anywhere in `packages/`.
- [ ] `git diff --check` and the existing `widget-layout.test.ts` suite both stay green after the
      additions.

## Proposed promotion

**New research finding**, ready for `C3.2` to consume directly — this report is the explicit
prerequisite `research/handoffs/C3.2.md` names, and `C3.2`'s gate should clear once the coordinator
reviews this proposal (accepting it as-is or recording specific deviations, per the acceptance
checklist above).
