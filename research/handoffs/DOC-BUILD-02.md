# DOC-BUILD-02 — Refresh explainer status after D7.1/E1.4

## State

`handoff`

## Owner and workspace

- Owner: `coordinator-codex`
- Branch: `Anti-gravity-and-other-Agent-changes`
- Worktree: `/Users/SameeraD/Defence-Charts`
- Base commit: `6d17c1141567ec49946c126344324985c2fd2740`

## Objective

Update the explainer pages so they reflect the current repository checkpoint: the real grid and
widget shell, interaction matrix, ten integrated chart types, built CSS/package artefacts, packed
consumer fixtures, and package reliability gates are complete. The pages must clearly separate
those completed milestones from the remaining C3.2 serialization/migration work, final package
naming, Preview publication, and the Free-v1 release audit.

## Read-first sources

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/handoffs/D7.1.md`
- `research/handoffs/E1.1.md`
- `research/handoffs/E1.2.md`
- `research/handoffs/E1.3.md`
- `research/handoffs/E1.4.md`
- `research/handoffs/I1.5.md`
- `research/handoffs/C3.2.md`
- `research/html-explained/index.html`
- `research/html-explained/07-chart-catalog.html`
- `research/html-explained/10-roadmap.html`

## Allowed write set

- `research/html-explained/index.html`
- `research/html-explained/07-chart-catalog.html`
- `research/html-explained/10-roadmap.html`
- `research/handoffs/DOC-BUILD-02.md`

Do not modify runtime packages, the master ledger, locked decisions, release metadata, or other
explainer pages in this task.

## Acceptance criteria

- The home map and build page no longer describe the completed grid, interactions, chart families,
  or package gates as planned/not built.
- The chart catalogue reports ten integrated chart types: line, area, bar, timebar, scatter, donut,
  KPI, progress, heatmap, and funnel.
- The build page reports current evidence without claiming that Preview or Free v1 has been
  publicly published.
- Remaining work is explicit: C3.2 layout serialization/migration, P0.3 public name/npm scope,
  E2.1 Changesets/trusted Preview publication, E3.1 Free-v1 release audit, and CR-X04 empirical
  assistive-technology evidence where applicable.
- Browser verification shows the updated pages load with no console errors.
- `git diff --check` passes and this handoff records exact verification, changed paths, and commit.

## Checkpoint

- Current checkpoint: status refresh implemented and verified; documentation commit remains to be created.
- Browser evidence: `http://localhost:8123/index.html#status`, `http://localhost:8123/07-chart-catalog.html#catalogue`, and `http://localhost:8123/10-roadmap.html#remaining` loaded with the expected titles, required current-status text, and no console errors. The desktop build release ladder computed to three columns; the home status block computed to four columns after reload.
- CLI evidence: `git diff --check` passed; the Python HTML parser parsed all three pages; HTTP 200 responses were returned for all three pages (`index.html` 35,589 bytes, `07-chart-catalog.html` 10,692 bytes, `10-roadmap.html` 34,565 bytes at the time of the check).
- Resume command: `cd /Users/SameeraD/Defence-Charts && git diff --check && curl -fsS http://127.0.0.1:8123/10-roadmap.html >/dev/null`

## Changed paths

- `research/html-explained/index.html`
- `research/html-explained/07-chart-catalog.html`
- `research/html-explained/10-roadmap.html`
- `research/handoffs/DOC-BUILD-02.md`
