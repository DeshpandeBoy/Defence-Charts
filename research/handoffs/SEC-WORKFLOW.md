---
id: SEC-WORKFLOW
title: Security-hardened GitHub workflows and browser gates
type: implementation
state: handoff
owner: Codex
branch: detached checkout of Fine-Tuning-V1
worktree: /Users/SameeraD/.codex/worktrees/fffd/Defence-Charts
base_commit: 014b58163d99d88ff4f763998d891368cc4b8eeb
depends_on: []
started_at: 2026-08-27T08:40:10+05:30
last_checkpoint: 2026-08-27T08:45:38+05:30
---

# SEC-WORKFLOW — Security-hardened GitHub workflows and browser gates

## Objective

Pin every third-party GitHub Action in the CI and release workflows to the exact commit
resolved from its official repository, disable checkout credential persistence for CI jobs
that execute untrusted pull-request code, and make browser/security gate scripts invoke the
repository-provisioned package manager instead of downloading pnpm through npx.

## Read first

- AGENTS.md
- research/00-decisions.md
- research/90-final-delivery-and-agent-plan.md
- research/91-codex-build-workstream.md
- docs/AGENTS.md
- .github/workflows/ci.yml
- .github/workflows/release.yml
- scripts/check-containment.mjs
- scripts/check-family-matrix.mjs
- scripts/check-grid-browser.mjs
- scripts/check-grid-stress.mjs
- scripts/check-interaction-browser.mjs
- scripts/check-rsc.mjs

## Allowed write set

- .github/workflows/ci.yml
- .github/workflows/release.yml
- scripts/check-containment.mjs
- scripts/check-family-matrix.mjs
- scripts/check-grid-browser.mjs
- scripts/check-grid-stress.mjs
- scripts/check-interaction-browser.mjs
- scripts/check-rsc.mjs
- research/handoffs/SEC-WORKFLOW.md

## Do not edit

- research/90-final-delivery-and-agent-plan.md
- central shared integration files not named above
- files owned by another active task
- generated browser/security results
- package.json or its `packageManager` pin

## Acceptance criteria

- [x] Every `uses:` entry in both workflows uses a 40-character full commit SHA from the official action repository.
- [x] CI checkout steps that can run untrusted pull-request code set `persist-credentials: false`.
- [x] Every direct `npx --yes pnpm@10.34.5` invocation in the affected browser/security gates uses the repository-provisioned `pnpm` path, with behavior preserved and `packageManager` unchanged.
- [x] Targeted static checks, relevant tests, `git diff --check`, and changed-path review pass.
- [x] Implementation and this handoff are committed together.

## Baseline

- Branch: detached checkout corresponding to `Fine-Tuning-V1`
- Base commit: `014b58163d99d88ff4f763998d891368cc4b8eeb`
- Initial `git status --short`: clean
- Last known green command/commit: base commit; full verification evidence is recorded by prior release work, but this task will run focused checks after edits.

## Current checkpoint

### Completed

- Read the governing files, handoff template, workflows, package manager declaration, and affected gate scripts.
- Confirmed six affected scripts contain the direct ad-hoc pnpm invocations.
- Resolved action refs from official repositories on 2026-08-27:
  - `actions/checkout@v5` → `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` (`refs/tags/v5`)
  - `pnpm/action-setup@v4` → `b906affcce14559ad1aafd4ab0e942779e9f58b1` (peeled `refs/tags/v4`)
  - `actions/setup-node@v5` → `a0853c24544627f65ddf259abe73b1d18a591444` (`refs/tags/v5`)
  - `actions/cache@v4` → `0057852bfaa89a56745cba8c7296529d2fc39830` (`refs/tags/v4`)
  - `changesets/action@v1` → `a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d` (official `refs/heads/v1`)
- Pinned all 11 workflow action uses entries to those full SHAs across `ci.yml` and `release.yml`.
- Added `persist-credentials: false` to both CI checkout steps. The release checkout remains
  full-history only because it is limited to `main` pushes/manual dispatch and does not run
  untrusted pull-request code.
- Replaced every direct ad-hoc pnpm launcher in the six affected browser/security scripts with
  the provisioned `pnpm` executable, preserving filters, commands, detached process groups, and
  the root `packageManager: pnpm@10.34.5` declaration.

### In progress

- Nothing; implementation is ready for coordinator verification.

### Remaining

- Nothing; the implementation and handoff are committed.

### Exact next action

```bash
git commit -am 'fix(security): pin workflow actions and localise gate package manager'
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Action commit resolution | verified | `git ls-remote` against each official action repository on 2026-08-27 | Pin tags/branch refs to the listed full SHAs; use the peeled commit for annotated `pnpm/action-setup@v4`. |
| Checkout credentials | security hardening | CI has pull-request trigger and runs repository code; release checkout only runs on `main` | Add `persist-credentials: false` to both CI job checkout steps; leave release checkout's full-history behavior intact unless its checkout is also required by acceptance review. |
| Package manager invocation | verified repository convention | root `package.json` has `packageManager: pnpm@10.34.5`; CI provisions pnpm with `pnpm/action-setup` | Replace `npx --yes pnpm@10.34.5` with the `pnpm` executable directly and preserve argument order, process-group lifecycle, and packageManager pin. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| .github/workflows/ci.yml | Full-SHA action pins and untrusted-checkout credential hardening | yes |
| .github/workflows/release.yml | Full-SHA action pins | yes |
| scripts/check-containment.mjs | Provisioned pnpm for the shared browser server | yes |
| scripts/check-family-matrix.mjs | Provisioned pnpm for the family fixture server | yes |
| scripts/check-grid-browser.mjs | Provisioned pnpm for the grid fixture server | yes |
| scripts/check-grid-stress.mjs | Provisioned pnpm for the stress fixture server | yes |
| scripts/check-interaction-browser.mjs | Provisioned pnpm for the interaction fixture server | yes |
| scripts/check-rsc.mjs | Provisioned pnpm for build and RSC fixture server | yes |
| research/handoffs/SEC-WORKFLOW.md | Durable task card and checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| working tree | `pnpm install --frozen-lockfile` | 0 | Lockfile current; dependencies provisioned with pnpm 10.34.5. Local Node 22.12 emitted the existing `engines.node >=22.18` warning. |
| working tree | `pnpm exec eslint scripts/check-containment.mjs scripts/check-family-matrix.mjs scripts/check-grid-browser.mjs scripts/check-grid-stress.mjs scripts/check-interaction-browser.mjs scripts/check-rsc.mjs` | 0 | No findings. |
| working tree | `for file in scripts/check-containment.mjs scripts/check-family-matrix.mjs scripts/check-grid-browser.mjs scripts/check-grid-stress.mjs scripts/check-interaction-browser.mjs scripts/check-rsc.mjs; do node --check "$file"; done` | 0 | All six affected scripts parsed successfully. |
| working tree | `pnpm exec vitest run scripts/check-rsc.test.mjs scripts/check-family-matrix.test.mjs` | 0 | 2 test files, 21 tests passed. |
| working tree | scoped Node static assertions for workflow refs, CI checkout credentials, script launchers, and packageManager | 0 | CI 7 full-SHA refs; release 4 full-SHA refs; credentials false 2/2; provisioned pnpm only; packageManager `pnpm@10.34.5`. |
| working tree | `pnpm lint:rsc` | 0 | G4 passed: 77 marks; `_S_1_-title`; 0/6 chart markers in 553 KB across 9 chunks. |
| working tree | `pnpm lint:containment` | 0 | G11 passed: 178 sizes; 13 rung changes; 0 loop errors; 0 px unattributed overflow. |
| working tree | `git diff --check` | 0 | No whitespace errors. |
| working tree | changed-path audit | 0 | Only the eight assigned implementation paths plus this handoff are changed/untracked; no generated results changed. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None known | — | — |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: `169b4ba` implementation checkpoint; handoff finalized in the amend
- Branch pushed or locally available: local isolated worktree
- Working tree clean: pending final status check
- Narrow restart check: `pnpm exec vitest run scripts/check-rsc.test.mjs scripts/check-family-matrix.test.mjs`
- Remaining risk/limitations: action refs are time-specific and must be refreshed when intentionally updating the action major/ref; live GitHub execution is not reproduced locally.
