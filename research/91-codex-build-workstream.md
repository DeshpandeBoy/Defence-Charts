# Codex agent build workstream

**Audience:** Codex implementation, verification, integration, and release agents  
**Controller:** [`90-final-delivery-and-agent-plan.md`](90-final-delivery-and-agent-plan.md)  
**Handoff format:** [`handoffs/README.md`](handoffs/README.md)

This is the build queue. It is deliberately stricter than a feature list: every task states its
dependencies, allowed write area, output, and proof. A Codex agent takes one task, creates its handoff,
and stops when that task is reviewable.

---

## 1. Rules for every Codex agent

### Start checklist

- [ ] Read `research/00-decisions.md`, the master plan, this file, and the task handoff.
- [ ] Confirm task state and owner in the master ledger.
- [ ] Inspect actual source and installed dependency APIs; do not implement from research prose alone.
- [ ] Record branch, baseline commit, dirty paths, allowed write set, and verification commands.
- [ ] State assumptions in the handoff before they become code.

### Build checklist

- [ ] Keep `@gx/core` pure: no React, DOM, browser globals, or mutable singleton state.
- [ ] Keep static `@gx/primitives` RSC-safe.
- [ ] Keep grid placement separate from chart information decisions.
- [ ] Use project tokens; do not add raw visual literals or parallel styling systems.
- [ ] Add negative and boundary tests, not only the happy path.
- [ ] Preserve stable IDs across resize, filtering, and interaction.
- [ ] Do not edit shared integration files outside the declared write set.

### Handoff checklist

- [ ] Run task-specific checks and capture exact output.
- [ ] Run `git diff --check` and list every changed/untracked path.
- [ ] Update docs and examples only for behavior that now exists.
- [ ] Update `research/handoffs/<task-id>.md` with next command and limitations.
- [ ] Commit a coherent checkpoint containing code, tests, and handoff.

### A Codex agent must stop and hand back when

- a locked decision must change;
- the required edit overlaps another claimed task;
- dependency behavior contradicts the selected architecture;
- user/legal/npm credentials are required;
- a test failure is outside the allowed write set and cannot be isolated safely.

---

## 2. Integration ownership

The coordinator alone edits these during parallel work:

- central chart-type and mark discriminated unions;
- central planner/renderer registries and root `index.ts` export lists;
- root release versions, Changesets state, and changelog;
- the master task ledger and research status index.

Family agents add family-local files and return the required registration diff as a handoff note. This
keeps bar, donut, KPI, scatter, heatmap, and funnel agents from conflicting in the same files.

---

## 3. P0 and C0 — freeze the shared contracts

### P0.4 — record the actual RGL and shell ownership boundary

**Depends on:** P0.2/CR-000  
**Owner:** Codex integration agent with coordinator review  
**Allowed write set:** one decision clarification/amendment; task handoff.

The installed `react-grid-layout@2.2.4` package exposes algorithms and types from `./core`, while
`GridLayout`, `ResponsiveGridLayout`, and React hooks/components come from `./react`. Record whether
`@gx/grid` uses the React subpath behind a project-owned client wrapper while importing pure
algorithms from core, or owns more of the React layer. Keep `@gx/grid` as widget-shell owner and keep
chart measurement owned by the existing React size boundary. Do not reopen the selected engine or
12-column model without reproducible evidence.

### C0.1 — grid, widget, and identity contract

**Depends on:** P0.2 decision reconciliation and P0.4  
**Suggested owner:** Codex integration agent  
**Allowed write set:** new contract modules/tests in `packages/core/src/`; task handoff; a new decision
record only if approved by the coordinator.

Deliver:

- serialisable `WidgetId` and stable datum/series identity rules;
- controlled `WidgetLayout` using the locked 12-column coordinate system;
- explicit min/max and movement/resize constraints;
- versioned serialisation shape and migration boundary;
- separation of layout state, interaction state, filter state, and host-supplied data;
- JSON round-trip, invalid-input, duplicate-ID, bounds, and immutability tests.

Do not deliver React components or persistence storage in this task.

Proof:

```bash
pnpm --filter @gx/core typecheck
pnpm vitest run packages/core/src/<contract-tests>
pnpm lint:boundary
git diff --check
```

### C0.2 — pin and prove the grid dependency boundary

**Depends on:** C0.1 and R1 evidence  
**Allowed write set:** `packages/grid/package.json`, lockfile if required, new grid adapter/tests,
task handoff.

Deliver:

- pin the exact verified `react-grid-layout` version rather than a caret range;
- verify the installed `./core` algorithm/type exports and `./react` UI exports before choosing
  adapter calls;
- isolate third-party types behind project-owned types;
- tests for collision, compaction, bounds, and deterministic output;
- a recorded decision if the installed package cannot satisfy locked decision 6.

Proof:

```bash
pnpm --filter @gx/grid typecheck
pnpm vitest run packages/grid
pnpm lint:deps
git diff --check
```

---

## 4. C1–C4 — real dashboard grid

### C1.1 — controlled grid engine wrapper

**Depends on:** C0.2  
**Allowed write set:** family-local modules/tests/styles under `packages/grid/src/`; task handoff.

Deliver:

- controlled layout input and `onLayoutChange` output;
- drag and resize callbacks with stable IDs;
- explicit edit and read-only modes;
- no chart-type knowledge in the grid package;
- deterministic component tests for initial/controlled updates and stable IDs.

### C1.2 — collision, compaction, and constraints

**Depends on:** C1.1  
**Allowed write set:** grid-local algorithm adapters/tests; task handoff.

Deliver vertical compaction, no-overlap, push-down, bounds, and per-widget min/max constraints.
Cover invalid and impossible proposals explicitly; do not silently mutate caller-owned layouts.

### C1.3 — resize preview and committed callbacks

**Depends on:** C1.2  
**Allowed write set:** grid-local callback/state modules/tests; task handoff.

Specify and test drag/resize start, preview, cancel, and one committed layout callback. Callback
payloads must be serialisable, stable by widget ID, and not emit a save operation for every pointer
frame.

### C2.1 — widget regions and drag handle

**Depends on:** C1.1  
**Allowed write set:** new shell modules/styles/tests in `packages/grid/src/`; narrowly agreed additions
in `packages/react/src/`; playground fixture; task handoff.

Deliver:

- header, title/context/action slots, drag handle, content region, and optional footer;
- plot interaction cannot accidentally start grid drag;
- per-widget theme scope without a runtime style provider.

### C2.2 — measured chart-content seam and containment

**Depends on:** C2.1  
**Allowed write set:** narrowly agreed grid/React measurement modules/tests; fixture; task handoff.

The content box reports real pixels and grid units to `AutoChart` without including outer chrome.
Overlays and data-table disclosure stay inside the measured widget. Proof includes DOM rectangle
assertions that content never changes the grid item's committed outer box.

### C2.3 — stable widget states

**Depends on:** C2.1  
**Allowed write set:** shell state components/styles/tests; task handoff.

Deliver loading, empty, error, and stale states with stable slots, accessible messaging, and no outer
size change. Data fetching and retry behavior remain host-owned.

### C3.1 — keyboard move/resize and focus

**Depends on:** C1.2  
**Allowed write set:** new grid keyboard modules/tests and grid docs; task handoff.

Deliver:

- discoverable keyboard move and resize controls with announced position/size;
- Escape/cancel and focus restoration;
- keyboard actions reuse the same constraint path as pointer operations.

### C3.2 — layout serialisation and migration

**Depends on:** C1.2 and CR-C03  
**Allowed write set:** new grid persistence modules/tests and docs; task handoff.

Deliver:

- controlled serialisation callbacks;
- versioned migration helper for saved layouts;
- duplicate/missing widget reconciliation policy;
- no localStorage, URL, database, or network ownership inside the library.

### C4.1 — grid browser gate

**Depends on:** C2.2 and C3.1  
**Allowed write set:** new browser fixture, tests, scripts, CI wiring, task handoff.

Test:

- footprints `1x1`, `2x1`, `3x1`, `3x3`, `6x5`, `9x6`;
- drag and resize in all supported directions;
- hidden tabs, zero-size parents, flex/grid ancestors, overflow, transforms, and zoom;
- keyboard-only movement and resize;
- no overlap, no lost IDs, no `ResizeObserver` loop errors, no outer-box growth;
- reduced motion, forced colors, RTL, and touch behavior.

Create a named `pnpm lint:grid` gate and a planted failure or equivalent negative assertion so it is
known to detect the defect class.

### C4.2 — grid stress evidence

**Depends on:** C4.1  
**Allowed write set:** benchmark fixture/script/results and task handoff.

Measure 1, 10, 50, 100, and 200 widgets for layout latency, callback stability, identity retention,
observer loops, and memory trend in the supported browser environment.

Record measured timings and memory observations as evidence. Do not invent a performance budget after
seeing the result; propose one separately if no budget is already approved.

---

## 5. I1 — Free-v1 interaction baseline

### I1.1 — stable interaction state and datum identity

**Depends on:** C0.1 and C2.1  
**Allowed write set:** new interaction contracts in `packages/core/src/`, tests, task handoff.

Deliver serialisable, controlled state for active datum/series, tooltip mode, and legend visibility.
Keep host data/filter state outside the chart. Verify resize does not change identity.

### I1.2 — pure tooltip placement

**Depends on:** I1.1 and R3  
**Allowed write set:** new pure placement modules/tests in `packages/core/src/`; task handoff.

Deliver:

- deterministic fixed placement first; optional fluid placement only behind an explicit adapter;
- collision-safe overlay boundaries that never alter normal-flow size;
- corner, overflow-row, unavailable-space, and resize recomputation tests.

### I1.3 — tooltip and crosshair React layer

**Depends on:** I1.2  
**Allowed write set:** new modules/styles/tests in `packages/react/src/`; fixture; task handoff.

Deliver:

- tooltip and crosshair behavior matched to each size class;
- accessible equivalent through table/description/status text;
- no client interaction code in the static/RSC path.

### I1.4 — static and interactive legend

**Depends on:** I1.1  
**Allowed write set:** family-local legend modules/tests in `packages/primitives/src/` and
`packages/react/src/`; task handoff.

Deliver direct/internal/external modes selected by plan and measured fit, stable series order,
controlled visibility state, static/RSC output, and keyboard activation.

### I1.5 — touch and keyboard interaction matrix

**Depends on:** I1.3 and I1.4  
**Allowed write set:** interaction browser fixture/tests/docs; task handoff.

Verify tap-to-lock, Escape dismissal, focus restoration, datum navigation, legend toggles, resize
with an open overlay, and an accessible equivalent without hover.

Brush, zoom, annotations, shared filters, and linked highlighting are not part of I1 unless the master
plan explicitly promotes them.

---

## 6. D0 — create a safe parallel chart-family seam

### D0.1 — modular planner and renderer registration

**Depends on:** C0.1  
**Owner:** coordinator or Codex integration agent  
**Allowed write set:** central core/primitives types, dispatcher, renderer registry, tests, docs,
task handoff.

Deliver:

- family-local planner and mark modules with explicit contracts;
- an immutable, statically analyzable built-in registration path;
- no global mutable plugin registry and no runtime side-effect registration;
- tree-shaking and RSC gates that continue to pass;
- a written add-a-family checklist and fixture convention.

The goal is not a generic mega-renderer. It is a small stable seam that lets family agents work in
disjoint directories while the coordinator owns final registration.

### D0.2 — shared family acceptance and visual fixture

**Depends on:** D0.1  
**Allowed write set:** new testing/playground/browser fixture conventions; task handoff.

Create one reusable family matrix covering Micro → Stage, themes/forced colors, normal/empty/error,
accessibility, resize boundaries, and plan metadata. Prove it on line/area before assigning D agents.

---

## 7. D1–D6 — complete chart families

Every family task must produce all of the following:

- data-shape validation and stable identity;
- Micro → Stage ladder semantics;
- plan fields and policy thresholds with provenance;
- pure geometry/planner tests;
- hook-free SVG marks and accessible static output;
- interaction behavior or an explicit intentional absence by size class;
- empty, missing, negative, extreme, and dense-data cases;
- light/dark/forced-color and reduced-motion fixtures;
- resize boundary and containment tests;
- docs, examples, G20 disposition, API snapshot, and tree-shaking proof;
- the visual-comprehension checks in `apps/playground/src/family-matrix/README.md` (added after
  `CR-VT01`/`VT-003` found nine cross-family instances of these defect classes invisible to the
  structural checks above) — added to `scripts/check-family-matrix.mjs` in the same task that adds
  the family, not deferred to a later audit.

### D1.1 — bar and timebar

Start first. Cover vertical/horizontal transposition, grouped/stacked decisions only if approved,
baseline/negative values, minimum visible geometry, long categories, and time ordering. Consume R2's
bar-geometry evidence without presenting an unavailable source as measured fact.

### D2.1 — donut

Cover aggregation into visible `Other`, category-count limits, total/label/legend behavior across size
classes, tiny-slice semantics, and non-color equivalent. Pie is an alias only if its distinct contract
is explicitly decided.

### D3.1 — KPI

Prove the Micro and Tile end: primary value, unit, delta, direction, status, target, and optional
sparkline. Avoid encoding “good” only through color.

### D3.2 — progress

Reuse the metric semantics only where justified. Cover current, target, remaining, over-target,
indeterminate/missing values, orientation, labels, and non-color status.

### D4.1 — scatter

Define supported SVG point/series budgets, overlap strategy, hit target, tooltip candidate selection,
and the boundary where aggregation/downsampling becomes a host responsibility or later renderer.

### D5.1 — heatmap

Cover row/column label degradation, minimum nominal cell size, scale/legend semantics, missing cells,
non-color access, and keyboard navigation without pretending every cell is readable at Micro.

### D6.1 — funnel

Require an explicit analytical use case, ordering rules, negative/zero rejection, stage labels,
conversion/drop-off semantics, and an accessible table. If research cannot justify a reliable
responsive contract, defer the family rather than shipping decorative geometry.

### D7.1 — central registration and complete family matrix

**Depends on:** all families included in Free v1  
**Owner:** coordinator with independent verification agent.

Integrate central unions, dispatch, exports, tokens, docs indexes, and public API snapshots once. Run
the shared family matrix and ensure deferred families still fail explicitly rather than falling back.

---

## 8. E1–E3 — publication and launch

### E1.1 — built artifact contract

**Can begin after:** C2.1  
**Allowed write set:** package manifests, tsdown configs, CSS copy/emission scripts/tests, task
handoff.

Deliver:

- exports target built JavaScript/declarations in `dist`;
- CSS is emitted/copied into `dist` and every documented subpath resolves;

### E1.2 — package metadata and dependency correctness

**Depends on:** E1.1  
**Allowed write set:** package manifests/READMEs/licence strategy and task handoff.

Deliver:

- package metadata includes licence, repository, homepage, bugs, engines, peers, and side effects;
- `@gx/testing` runtime dependencies and publish decision are correct;
- `@gx/react` description advertises only exported behavior;
- `npm pack --dry-run`/tarball-content assertions;

MIT and copyright holder Dhanya Rao come from the current root `LICENSE`; do not reopen them as an
unknown. Verify that every tarball carries the required notice.

### E1.3 — tarball consumer fixtures

**Depends on:** E1.1  
**Allowed write set:** new clean consumer fixtures/scripts and task handoff.

Deliver:

- clean consumer fixtures using tarballs, never workspace links, for React/Next RSC and Vite;
- import and build every documented JavaScript, declaration, and CSS subpath.

### E1.4 — package reliability gates

**Depends on:** E1.2 and E1.3  
**Allowed write set:** release/package scripts, root dev tooling, CI, task handoff.

Add `publint`, `@arethetypeswrong/cli`, package-content, CSS-resolution, consumer-build, and no-network
gates under a named package verification command.

### E2.1 — rename and Preview release

**Depends on:** P0.3 name/scope and E1.4  
**Owner:** coordinator with release agent  

- rename `@gx/*` and `--gx-*` only through the tested migration path;
- add Changesets/version/changelog workflow;
- configure npm trusted publishing and provenance;
- publish a release candidate/preview;
- install the exact published artifacts in clean fixtures;
- verify public docs and examples against the published version.

Credentials, npm ownership, and irreversible publication require the user's explicit control or
approval at execution time.

### E3.1 — Free-v1 launch audit

- run `pnpm verify` from a clean supported Node environment;
- run all browser, RSC, package, a11y, visual, and consumer gates;
- audit docs/marketing for unsupported claims;
- record package versions, artifact hashes, commands, limitations, and rollback route;
- publish only the tested release candidate contents.

---

## 9. Recommended parallel waves

| Wave | Lead work | Parallel sidecars |
|---|---|---|
| 1 | C0.1/C0.2 | R1, R2, R3, E1 fixture design |
| 2 | C1.1–C1.3 | C2 shell design after contract freeze; E1 package audit |
| 3 | C2.1–C2.3 and C3.1–C3.2 in disjoint files | C4 fixture; I1.1 |
| 4 | C4.1 and I1.2–I1.5 | D0.1–D0.2 |
| 5 | D1, D2, D3 in family-local modules | E1.1 and D4 fixture design |
| 6 | D4, D5, D6 | Preview release and claim audit |
| 7 | Integration and full matrix | Free-v1 docs and release candidate |

No wave starts merely because the previous agents returned. Its dependency gate must be reproduced
by the coordinator.

---

## 10. Codex task prompt template

```text
Task: <ID and title>
Repository: /Users/SameeraD/Defence-Charts
Branch/worktree: codex/<task-id>-<slug>

Read first:
- research/00-decisions.md
- research/90-final-delivery-and-agent-plan.md
- research/91-codex-build-workstream.md
- research/handoffs/<task-id>.md

Implement only the task contract. Your allowed write set is: <paths>.
Do not edit the master ledger or central integration files unless they are explicitly in scope.
Inspect actual dependency/source APIs before coding. Add tests and run: <commands>.

Before stopping, update the handoff with baseline/current commit, files changed, decisions,
commands and exact results, remaining work, blockers, and the exact resume command. Commit a coherent
checkpoint. Do not claim done unless every acceptance item is evidenced.
```
