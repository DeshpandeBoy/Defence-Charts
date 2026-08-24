# DOC-BUILD-01 — Building-the-library explainer page

## State

`in progress`

## Owner and workspace

- Owner: `coordinator-codex`
- Branch: `Anti-gravity-and-other-Agent-changes`
- Worktree: `/Users/SameeraD/Defence-Charts`
- Base commit: `5c036cc5fb885f42c806aed36ca900a98e2a4f56`

## Objective

Replace the roadmap explainer with one approachable page that explains how the library is being
built, what is already real, what is in handoff/review, what remains, and what “complete” means
for Preview, Free v1, and the later commercial milestone. The milestone view must read as a clear
release ladder at the narrow in-app browser width as well as a three-column progression on wider
screens.

## Read-first sources

- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/80-product-analysis-shadcn-basedash.md`
- `research/81-product-analysis-gaps-risks-and-experiments.md`
- `research/82-product-analysis-package-strategy-and-open-source-boundary.md`
- `research/83-product-analysis-current-state-and-interaction-contract.md`
- `research/handoffs/C0.1-widget-layout-contract.md`
- `research/handoffs/R1-rgl-api.md`
- `research/handoffs/R2-chart-union.md`
- `research/handoffs/R3-interaction-contract.md`
- `research/html-explained/10-roadmap.html`

## Allowed write set

- `research/html-explained/10-roadmap.html`
- `research/html-explained/index.html`
- `research/handoffs/DOC-BUILD-01.md`

Do not modify runtime packages, the master ledger, locked decisions, or other explainer pages in
this task.

## Acceptance criteria

- The page is a single, skimmable explanation of the build, written in layman-friendly language.
- It distinguishes implemented work, handoff/review work, the immediate next slice, planned Free
  v1 work, and later Pro/commercial work.
- It explains the full path from the current line/area foundation through the real 12-column grid,
  interactions, chart families, packaging, and release proof.
- It incorporates the product-analysis decisions about composable chart shells, Basedash-style
  dashboard context, state ownership, coordinate ownership, and the Free/Pro boundary.
- It calls out known blockers and proof requirements without presenting research as shipped code.
- Browser verification shows the page loads, its important internal links are present, and the
  milestone ladder stacks cleanly at the narrow in-app browser width.
- `git diff --check` passes and the handoff records exact verification evidence and the commit.

## Checkpoint

- Current checkpoint: build page and milestone ladder implemented; verification passed; committed in `196194b` (subject to the handoff metadata amend below).
- Browser evidence: `http://localhost:8123/10-roadmap.html?audit=milestones-v3#milestones` loaded with title `10 / How we build it — GX explained`, three `.release-step` elements, three boundary-rule labels, and no console errors. At the 674px in-app browser width, the ladder computed to one column with step heights 367px, 343px, and 365px.
- CLI evidence: `git diff --check` passed; the Python HTML parser parsed `research/html-explained/10-roadmap.html` (33,347 bytes at the time of the check); `curl` returned HTTP 200.
- Unexpected concurrent change preserved and excluded from this task commit: `research/90-final-delivery-and-agent-plan.md` has ledger status updates from another workstream. It remains in the working tree untouched.
- Resume command: `cd /Users/SameeraD/Defence-Charts && git diff --check && curl -fsS http://127.0.0.1:8123/10-roadmap.html >/dev/null`

## Changed paths

- `research/html-explained/10-roadmap.html`
- `research/html-explained/index.html`
- `research/handoffs/DOC-BUILD-01.md`
