# Final delivery and multi-agent execution plan

**Status:** active source of truth from 2026-08-24  
**Baseline branch:** `Anti-gravity-and-other-Agent-changes`  
**Baseline commit before this plan:** `9bd44ba`  
**Scope:** take the verified A/B line-and-area foundation through grid, interaction, chart breadth,
package publication, and a public launch without relying on any agent's chat history.

---

## 1. Outcome and launch definitions

This project has three honest finish lines. They must not be mixed in status reports.

| Release | Included | Excluded | Target with parallel agents |
|---|---|---|---:|
| **Preview** | Current line/area, real 12-column grid, widget shell, basic interaction, packed-package consumer proof | Full chart catalogue, commercial Pro work | 2–3 calendar weeks |
| **Free v1** | Preview plus bar/timebar, donut, KPI/progress, scatter, heatmap, funnel, accessibility/browser matrices, public docs and npm packages | Advanced filters, linked views, Pro packages | 5–8 calendar weeks |
| **v1.1 / commercial validation** | Advanced filters, brush/zoom/annotations where justified, one validated Pro capability, pricing/licensing workflow | Unvalidated enterprise breadth | after Free v1 |

The recommended launch is **Free v1**. A Preview should be published first so packaging and consumer
contracts are tested before every chart family depends on them.

The estimates assume one coordinating Codex session, two to four bounded Codex build agents, and one
or two Claude research/review agents. Research runs beside implementation wherever it is not a
contract dependency. External decisions, unavailable paid papers, user interviews, npm ownership,
and legal review are calendar risks and are not made faster by adding agents.

---

## 2. Confirmed baseline

### Complete

- Milestones A1–A6 and B1–B3 are complete for the line/area path.
- The planner is pure and serialisable; the static renderer is RSC-safe.
- Responsive sizing, containment, motion, typography, policy, token, API, and tree-shaking gates exist.
- The last A/B close reported 675 passing tests and a passing full verification chain.
- The A/B line/area path is closed for its shipped gates; the separate `CR-TY01` review of Segoe/GRAD
  visual calibration remains an evidence task and is not implied closed by this summary.
- The workspace was clean at `9bd44ba` before these planning documents were added.

### Not complete

- `@gx/grid` exports only `GRID_COLUMNS`; it has no real layout component.
- `planChart()` and the renderer now ship line/area, bar/timebar, scatter, donut, KPI, progress,
  heatmap, and funnel; unsupported future marks remain explicit failures.
- Basic interactive tooltip/legend/keyboard contracts are incomplete.
- Packages are `private: true`, version `0.0.0`, use placeholder `@gx/*` names, and export workspace
  source paths rather than a validated packed `dist` contract.
- CSS emission, external tarball consumption, Changesets, trusted publishing, and release smoke tests
  are not complete.

### Research already available

- `80-shadcn-basedash-library-strategy.md`: product and composition direction.
- `81-deep-evidence-audit.md`: evidence strength, gaps, and a reliability sequence.
- `82-package-ecosystem-benchmark.md`: package, Free/Pro, and publication analysis.
- `83-visual-interaction-architecture.md`: interaction, filters, overlays, and acceptance matrices.

These files are research inputs. They do not prove that the described runtime features exist.

---

## 3. Authority order

When files or agent messages disagree, use this order:

1. Current code, tests, generated outputs, and an executed verification command.
2. Locked decisions in `00-decisions.md` and accepted decision records in `decisions/`.
3. This file for current sequence, ownership, and release scope.
4. `30-implementation-plan.md` for milestone definitions.
5. `91-codex-build-workstream.md` and `92-claude-research-workstream.md` for task contracts.
6. Research syntheses and raw research.
7. Agent handoff files.
8. Chat history, which is never a source of truth.

An agent may identify that a higher-authority source is wrong, but it must record the conflict and
evidence. It may not silently replace a locked decision.

### Reconciled contradictions

- The grid engine is **not open**: decision 6 locks `react-grid-layout@2`. The installed 2.2.4
  package exposes algorithms/types under `./core` and React components/hooks under `./react`.
  Decision 6's “core subpath” wording is therefore incomplete for the UI shell: C0 must record the
  exact two-subpath boundary, pin the tested version, and verify SSR/client behavior without
  reopening the engine by default.
- The base grid remains **12 columns**. The 6/18-column ideas in later research are deferred until a
  separate decision and contract test; they do not belong in C1.
- Basic tooltip, legend, keyboard access, and local layout serialisation are Free-v1 requirements.
  Shared filters, linked views, brush/zoom, and hosted persistence are v1.1 candidates.
- MIT and copyright holder Dhanya Rao are current repository facts in `LICENSE`. Final name, npm
  scope, contribution policy, and any later proprietary Pro licence still require explicit review
  before the corresponding public release.

---

## 4. Critical path

```text
P0 control + contract reconciliation
        |
        v
C0 stable grid/widget/identity contracts
        |
        +-----------------------+
        v                       v
C1-C4 grid + shell         R1-R4 research evidence
        |                       |
        +-----------+-----------+
                    v
          I1 basic interaction
                    |
                    v
          D0 parallel-family seam
                    |
          +---------+---------+---------+
          v         v         v         v
       D1 bar    D2 donut   D3 KPI   D4-D6 families
          +---------+---------+---------+
                    v
          E1 packaging preview
                    |
                    v
          E2 hardening + Free v1
```

The grid contract is the first implementation dependency. Research that may change that contract
must finish before C0 is frozen. Other research may continue while C1–C4 are built.

---

## 5. Delivery phases and exit gates

| Phase | Main work | Can run in parallel | Exit gate |
|---|---|---|---|
| **P0 — control** | Resolve stale/open-decision wording, choose Preview/v1 scope, create task handoffs | Release-name research | No contradictory open decision can redirect C0 |
| **C0 — contracts** | Stable widget ID, layout schema, controlled state, grid-to-chart size seam, pinned engine | RGL/API evidence review | JSON round-trip and pure contract tests pass |
| **C1 — grid engine** | Collision, constraints, compaction, drag/resize wrapper | Widget-shell visual research | Deterministic unit tests against pinned dependency |
| **C2 — widget shell** | Header drag handle, content region, states, measured-box containment | Packaging fixture preparation | Content never changes outer grid geometry |
| **C3 — access/state** | Keyboard move/resize, local serialisation/migration, edit/read-only modes | Basic tooltip research | Keyboard and persistence tests pass |
| **C4 — browser proof** | 1/10/50/100/200 widgets, all resize directions, hidden/zero-size parents, no loops | D0 design | Browser stress matrix is recorded and green |
| **I1 — interaction baseline** | Stable datum identity, tooltip/crosshair, legend, touch and keyboard equivalents | First chart-family fixtures | Static/RSC path remains free of client interaction code |
| **D — chart breadth** | One complete family at a time | Separate family modules after D0 | Each family passes its full planner/render/a11y/browser matrix |
| **E1 — Preview** | `dist` exports, CSS, tarballs, consumer apps, docs, scope/name, release automation | Remaining D families | Clean install from packed artifacts succeeds |
| **E2 — Free v1** | Claim audit, full catalogue matrix, release candidate, npm/docs launch | v1.1 research | All required gates run from a clean clone and release artifact |

---

## 6. Work allocation

### Codex owns

- TypeScript/React/CSS implementation and refactors.
- Tests, browser fixtures, CI gates, package manifests, and release automation.
- Central type/union/export integration.
- Reproducing findings against the local repository.
- Final merge, conflict resolution, and verification evidence.

Detailed tasks: [`91-codex-build-workstream.md`](91-codex-build-workstream.md).

### Claude owns

- Current primary-source research and evidence extraction.
- Contradiction and claim audits.
- UX, interaction, accessibility, internationalisation, and chart-family evidence syntheses.
- Documentation drafts that clearly separate fact, inference, decision, and proposal.
- Independent review of completed task handoffs.

Claude does **not** silently edit locked decisions, shared code, package exports, or the live task
ledger. Detailed tasks: [`92-claude-research-workstream.md`](92-claude-research-workstream.md).

### Coordinator owns

- This plan and task-status changes.
- Assigning exactly one owner to a task and one owner to every shared integration file.
- Deciding whether research changes scope.
- Integrating central exports/unions after family agents finish disjoint modules.
- Running release gates and declaring a task done.

---

## 7. Live task ledger

Only the coordinator edits this table. An agent records detailed state in its handoff file.

| ID | Owner lane | State | Depends on | Deliverable |
|---|---|---|---|---|
| P0.1 | Coordinator | **done** | — | Final agent plan and continuity system; committed and verified |
| P0.2 | Claude research | **handoff** | P0.1 | Decision-conflict register |
| P0.3 | User/coordinator | **done** | — | **ShiftCharts**, `@shiftcharts/*`, and “Charts that shift with their space.” integrated across packages, CSS, docs, fixtures, scripts, and release config; full verify green |
| P0.5 | User/coordinator | **in progress** | — | Preserve both disconnected histories through an unrelated-history merge, then fast-forward `main`; tracked in `research/handoffs/P0.5.md` |
| P0.4 | Codex integration | **done** | P0.2 | Record RGL `./core` + `./react` boundary and widget-shell owner |
| C0.1 | Codex integration | **done** | P0.1, P0.2, P0.4 | Grid/widget/identity contract |
| C0.2 | Codex integration | **done** | C0.1 | Pin and prove RGL adapter boundary |
| C1.1 | Codex grid | **done** | C0.2 | Controlled grid wrapper |
| C1.2 | Codex grid | **done** | C1.1 | Constraints, collision and compaction |
| C1.3 | Codex grid | **done** | C1.2 | Preview/commit callback contract |
| C2.1 | Codex shell | **done** | C1.1 | Widget regions and drag handle |
| C2.2 | Codex shell | **done** | C2.1 | Measured chart-content seam and containment |
| C2.3 | Codex shell | done | C2.1 | Stable loading/empty/error/stale states |
| C3.1 | Codex grid | done | C1.2 | Keyboard move/resize and focus |
| C3.2 | Codex grid | backlog | C1.2 | Layout serialisation and migration |
| C4.1 | Codex verification | done | C2.2, C3.1 | Grid browser gate |
| C4.2 | Codex verification | done | C4.1 | 1/10/50/100/200-widget stress evidence |
| I1.1 | Codex interaction | done | C2.2 | Datum identity and interaction state |
| I1.2 | Codex interaction | done | I1.1 | Pure overlay placement |
| I1.3 | Codex interaction | done | I1.2 | Tooltip and crosshair layer |
| I1.4 | Codex interaction | done | I1.1 | Static and interactive legends |
| I1.5 | Codex interaction | done | I1.3, I1.4 | Keyboard/touch interaction matrix |
| D0.1 | Codex integration | done | C0.1 | Parallel chart-family module seam |
| D0.2 | Codex verification | done | D0.1 | Shared family acceptance/visual fixture |
| D1.1 | Codex bar | done | D0.2, R2 | Bar/timebar family |
| D2.1 | Codex radial | done | D0.2, R2 | Donut family |
| D3.1 | Codex metric | done | D0.2 | KPI family |
| D3.2 | Codex metric | done | D3.1 | Progress family |
| D4.1 | Codex scatter | done | D0.2, R2 | Scatter family |
| D5.1 | Codex heatmap | done | D0.2, R2 | Heatmap family |
| D6.1 | Codex funnel | done | D0.2, R2 | Funnel or evidence-backed deferral |
| D7.1 | Codex integration | done | D1–D6 | Central registration and complete family matrix |
| D0.2-visual-defects | Codex verification | **done** | CR-VT01 | Fixed 7 confirmed CR-VT01 defects (VT-001/002/004–008), commit `5264437`; full verify green |
| VT-003 | Coordinator (Claude-implemented) | **done** | CR-VT01, D0.2-visual-defects | Donut/funnel category labels — `DataPoint.category` added, commit `9443cfb`; see `research/handoffs/VT-003.md` |
| E1.1 | Codex release | done | C2.1 | Built exports and emitted CSS |
| E1.2 | Codex release | done | E1.1 | Package metadata/licence/dependency corrections |
| E1.3 | Codex release | done | E1.1 | Tarball Next/RSC and Vite consumers |
| E1.4 | Codex release | done | E1.2, E1.3 | `publint`, `attw`, package-content and no-network gates |
| E2.1 | Codex release | **in progress** | P0.3, P0.5, E1.4 | ShiftCharts rename, Changesets and trusted Preview publish; tracked in `research/handoffs/E2.1.md` |
| E2.1-mechanical | Coordinator (Claude-prepared) | **handoff** | R4 | Changesets config + `release.yml` (trusted-publish OIDC) wired; `pnpm publish --dry-run` validated against pinned `pnpm@10.34.5` for all 6 packages; dormant pending P0.3 and P0.5 |
| E3.1 | Coordinator | backlog | D7.1, E2.1 | Free-v1 claim and release audit |
| R1 | Claude research | **done** | P0.1 | RGL/grid current evidence; findings reflected in shipped C0.2/C1.1/C3.1 |
| R2 | Claude research | **done** | P0.1 | Evidence-bounded launch catalogue; sparkline doc correction verified applied in `roadmap.mdx`/`30-implementation-plan.md` |
| R3 | Claude research | **done** | P0.1 | Interaction and chart-semantics evidence; verified adopted in shipped I1 code (seriesId identity, `aria-pressed`, fixed/fluid tooltip); `CR-X04` remains its own separate, open empirical task for real AT verification |
| R4 | Claude research | **done** | P0.1 | Publication and competitor refresh; Next.js critical-RCE pin bumped (16.3.2→16.3.3, commit `0a47155`), pnpm publish mechanics dry-run validated; Fumadocs/tsdown staleness recheck still an open minor follow-up |
| CR-VT01 | Claude research | **done** | D0.2 | Visual family-matrix audit; 9 confirmed issues — 7 fixed in `D0.2-visual-defects`, VT-003 fixed (commit `9443cfb`), VT-009/010/011 remain deferred lower-confidence proposals |
| CR-TY01 | Claude research | **handoff** | P0.1 | Typography validation; GRAD-axis-absence-on-Windows and Selawik-proxy findings are new and actionable, Segoe UI Variable `safetyFactor` measurement itself remains a genuine evidence gap with two recorded unblock paths |
| R5 | Claude/user research | optional | Preview | User-validation protocol and findings |

Allowed states: `backlog`, `ready`, `claimed`, `in progress`, `handoff`, `verifying`, `done`,
`blocked`, `rework`, `deferred`.

---

## 8. File ownership and conflict prevention

1. Every task uses its own branch/worktree: `codex/<task-id>-<slug>` or
   `claude/<task-id>-<slug>`.
2. One task has one owner. An agent never starts a `claimed` or `in progress` task owned by another
   agent.
3. Each task brief declares an allowed write set. Files outside it are read-only unless the
   coordinator approves an expansion in the handoff.
4. Only the coordinator edits:
   - this file;
   - central public exports and shared discriminated unions during integration;
   - `research/README.md` status;
   - release version and changelog state.
5. Research agents write unique proposals under `research/agent-work/claude/`. They do not rewrite
   the foundation documents directly; accepted evidence may later be promoted into `raw/` or a
   decision record by the coordinator.
6. Chart-family agents add family-local planner, mark, test, fixture, and docs files. The coordinator
   performs the small central registration patch after reviewing all families.
7. Never use `git reset --hard`, delete another worktree, or discard an unknown dirty file. Preserve
   unrelated changes and record them in the handoff.

---

## 9. No-context-loss protocol

Every task creates `research/handoffs/<task-id>.md` from
[`handoffs/README.md`](handoffs/README.md) before implementation begins.

### Before an agent starts

- Read `00-decisions.md`, this plan, the applicable workstream, and the latest task handoff.
- Run `git status --short`, `git branch --show-current`, and `git log -3 --oneline`.
- Confirm the task is `ready` or assigned to that agent.
- Record baseline commit, allowed write set, first command, and expected acceptance gates.
- If the tree is unexpectedly dirty, stop and record the paths; do not overwrite them.

### At every meaningful checkpoint

- Commit a coherent slice with the task ID in the message.
- Update the handoff with decisions, changed files, commands, results, and the exact next action.
- Record failures as evidence; do not convert them into prose such as “mostly passing.”

### Before usage or context ends

- Stop at a compilable checkpoint when possible.
- Run the narrowest relevant test.
- Record `git status --short` and the current commit.
- Update `Current state`, `Remaining`, `Blockers`, and `Exact resume command` in the handoff.
- Commit the handoff together with the code checkpoint. If code is intentionally incomplete, prefix
  the commit `WIP(<task-id>):` and say what is broken.
- Return a summary that points to the handoff; do not rely on the summary itself.

### When a new agent resumes

- Trust the repository and handoff before the previous chat.
- Re-run the recorded narrow verification command.
- Compare actual changed files with the allowed write set.
- Continue from `Exact resume command`; do not restart the task from its title.
- If evidence does not reproduce, move the task to `rework` rather than claiming progress.

---

## 10. Definition of done

A task is done only when all applicable items are true:

- The requested runtime or research artifact exists.
- Public API, docs, and examples describe only shipped behavior.
- Unit/type/lint/build checks for the write set pass.
- Browser, RSC, accessibility, packaging, or visual checks required by the task pass.
- Generated files have been checked for drift.
- The handoff lists changed files, commands, exact results, limitations, and remaining work.
- The coordinator has reviewed the diff and moved the ledger row to `done`.

“Code written,” “agent finished,” and “tests likely pass” are not completion states.

---

## 11. Release gates

### Preview

- Real controlled grid with drag, resize, compaction, containment, keyboard path, and local layout
  round-trip.
- Line/area works inside the grid at the defined footprint matrix.
- Basic tooltip/legend behavior has touch and keyboard equivalents.
- Packed packages install in clean React/Next and Vite consumer fixtures.
- CSS subpaths, ESM exports, declarations, peer dependencies, licence files, and tree-shaking pass.
- Project name/scope is owned and release automation uses trusted publishing/provenance.

### Free v1

- Every promised family passes the same planner, renderer, accessibility, resizing, theme, and
  browser matrix.
- 1, 10, 50, 100, and 200-widget grid cases have recorded budgets and no containment loops.
- RTL, long labels, locale-aware numbers/dates, forced colors, reduced motion, empty/error/stale
  states, and touch are covered at the documented support level.
- Public docs, package READMEs, examples, and marketing claims match the artifact exactly.
- A clean release candidate is installed and exercised from packed tarballs before npm publication.

---

## 12. Immediate next actions

1. Run P0.2 to reconcile all open-decision wording against `00-decisions.md`.
2. Decide the public name and npm scope in parallel; it does not block C code.
3. Start C0.1 and freeze the stable grid/widget/identity contracts.
4. Run R1–R3 in parallel and feed only contract-changing evidence into C0 before freeze.
5. Build C1–C4, then publish the line/area Preview while D families continue.
6. Add D families through the parallel-family seam and finish the Free-v1 release audit.
