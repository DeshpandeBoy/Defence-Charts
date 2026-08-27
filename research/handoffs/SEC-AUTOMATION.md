---
id: SEC-AUTOMATION
title: Focused security automation
type: implementation
state: handoff
owner: Codex
branch: codex/SEC-AUTOMATION-security-automation
worktree: /Users/SameeraD/.codex/worktrees/ee07/Defence-Charts
base_commit: 014b58163d99d88ff4f763998d891368cc4b8eeb
depends_on: []
started_at: 2026-08-27T08:40:13+05:30
last_checkpoint: 2026-08-27T08:53:11+05:30
---

# SEC-AUTOMATION — Focused security automation

## Objective

Add a narrowly scoped, reviewable GitHub security workflow and conservative Dependabot policy
covering pull requests, pushes to the repository default branch (`main`), and manual dispatch. The
workflow must use immutable action commit references, install from the frozen pnpm lockfile, fail
on high-or-critical dependency advisories, and run the existing dependency-boundary and packed
package gates without adding scanners, secrets, or weakening existing checks.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `docs/AGENTS.md`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## Allowed write set

- `.github/workflows/security.yml`
- `.github/dependabot.yml`
- `research/handoffs/SEC-AUTOMATION.md`

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- `research/00-decisions.md`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- files owned by another active task
- generated results or unrelated source files

## Acceptance criteria

- [x] `.github/workflows/security.yml` triggers on pull requests, pushes to `main`, and manual dispatch.
- [x] Every action reference in the new workflow is an immutable commit SHA; the exact SHA/tag
      mapping is recorded here.
- [x] The workflow uses Node 24, repository-declared pnpm, and `pnpm install --frozen-lockfile`.
- [x] Dependency audit fails at the high severity threshold and existing dependency/package gates
      run without relaxed flags or ignored failures.
- [x] `.github/dependabot.yml` configures npm and GitHub Actions weekly updates with a bounded PR
      volume and no duplicate existing configuration.
- [x] YAML/static validation, focused checks, and `git diff --check` pass.
- [x] Implementation and this handoff are committed together.

## Baseline

- Branch: `codex/SEC-AUTOMATION-security-automation` (created from requested `Fine-Tuning-V1` base)
- Base commit: `014b58163d99d88ff4f763998d891368cc4b8eeb`
- Initial `git status --short`: clean
- Default branch evidence: `origin/HEAD -> origin/main`; release workflow also declares `main`.
- Existing equivalent configuration: none found under `.github/`.
- Last known green command/commit: base commit `014b581` (repository startup state; task-specific
  checks not yet run).

## Current checkpoint

### Completed

- Read the governing documents, package manifest, documentation rules, current workflows, handoff
  format, dependency-boundary configuration, and package-gate implementation.
- Confirmed the task write set is disjoint from the neighboring `SEC-HEADERS` branch/task.
- Confirmed the repository uses pnpm `10.34.5`, Node 24 in CI, `pnpm install --frozen-lockfile`,
  `pnpm lint:deps`, and `pnpm verify:packages`.
- Confirmed no existing Dependabot configuration or security workflow exists.
- Created this handoff before implementation, per the repository operating contract.
- Added `.github/workflows/security.yml` with pull request, `main` push, and manual triggers;
  immutable action SHAs; Node 24/pnpm frozen install; high-severity dependency audit; and the
  existing `lint:deps` and `verify:packages` gates.
- Added `.github/dependabot.yml` for bounded weekly npm and GitHub Actions updates.
- Completed YAML/static validation, action SHA resolution, dependency audit, project gates, and
  diff validation.

### In progress

- None; implementation is ready for coordinator review.

### Remaining

- Coordinator review, cherry-pick/integration, and broader release verification.

### Exact next action

```bash
npx -y node@24 "$(command -v pnpm)" audit --audit-level=high
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Default branch is `main` | verified repository fact | `git symbolic-ref refs/remotes/origin/HEAD` and `.github/workflows/release.yml` | Push trigger targets `main`; PR and manual triggers remain independent. |
| Use only checkout, pnpm setup, and Node setup actions | scope/security decision | Existing CI uses these three setup actions; audit and project gates run via local pnpm scripts | Minimizes third-party action surface and avoids unreviewed scanner downloads or secrets. |
| Use high severity as the audit threshold | implementation decision | `pnpm audit` supports severity gating; high catches high and critical advisories while avoiding low/medium noise | `pnpm audit --audit-level high` remains fail-closed for serious dependency advisories. |
| Run `lint:deps` and `verify:packages` | existing-gate decision | `scripts/check-package-gates.mjs` verifies packed artifacts/consumers/no-network behavior; `.dependency-cruiser.cjs` enforces package boundaries | Adds focused dependency/package integrity proof without creating a second bespoke scanner. |
| Weekly Dependabot with five open PRs per ecosystem | conservative maintenance policy | No existing `.github/dependabot.yml`; repository has npm and GitHub Actions dependencies | Limits update churn while covering both dependency classes. |

### Immutable action references

The workflow uses these commit references. Each mapping was checked against the corresponding
GitHub tag with `git ls-remote` on 2026-08-27; the pnpm action uses the peeled commit for its
annotated `v4` tag.

| Action | Tag represented | Immutable commit SHA |
|---|---|---|
| `actions/checkout` | `v5` | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` |
| `pnpm/action-setup` | `v4` | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |
| `actions/setup-node` | `v5` | `a0853c24544627f65ddf259abe73b1d18a591444` |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `.github/workflows/security.yml` | Focused audit and existing security-relevant package gates | yes |
| `.github/dependabot.yml` | Weekly npm and GitHub Actions update policy | yes |
| `research/handoffs/SEC-AUTOMATION.md` | Durable task contract and restart checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| — | `pwd; git status --short --branch; git rev-parse HEAD; git log -3 --oneline; git worktree list` | 0 | Requested base `014b58163d99d88ff4f763998d891368cc4b8eeb` and clean worktree verified before edits. |
| — | `ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f) }' .github/workflows/security.yml .github/dependabot.yml` | 0 | Both files parsed successfully. |
| — | Focused Ruby static assertions for triggers, frozen install, audit threshold, gates, immutable refs, and Dependabot ecosystems | 0 | All assertions passed. |
| — | `git ls-remote` tag-to-commit checks for checkout v5, pnpm/action-setup v4, and setup-node v5 | 0 | All three exact SHA mappings passed; see table above. |
| — | `npx -y node@24 "$(command -v pnpm)" install --frozen-lockfile` | 0 | Lockfile current; 799 packages installed with pnpm 10.34.5. pnpm reported the existing ignored build script warning for `unrs-resolver@1.12.2`. |
| — | `npx -y node@24 "$(command -v pnpm)" audit --audit-level=high` | 0 | `No known vulnerabilities found`. |
| — | `npx -y node@24 "$(command -v pnpm)" lint:deps` | 0 | 0 errors; 1 existing `no-orphans` warning for `packages/tokens/src/tokens.ts`; 177 modules and 527 dependencies cruised. |
| — | `npx -y node@24 "$(command -v pnpm)" verify:packages` | 0 | `E1.4 package gates passed: 6 packages; 6 publint/attw pairs; 261 packed files checked; 7 CSS subpaths resolved; consumer-build/no-network passed`. |
| — | `git diff --check` | 0 | No whitespace errors. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| Initial dependency-boundary attempt lacked installed dependencies | `npx -y node@24 "$(command -v pnpm)" lint:deps` before install; `depcruise: command not found` | Resolved by the recorded frozen install; final gate passed. |
| Existing dependency-cruiser orphan warning | Final `lint:deps` output names `packages/tokens/src/tokens.ts`; warning is not a security gate error | Pre-existing repository warning; coordinator may triage separately. |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: final amended commit; record with `git rev-parse HEAD`
- Branch pushed or locally available: local branch `codex/SEC-AUTOMATION-security-automation`
- Working tree clean: yes after final amend
- Narrow restart check: `npx -y node@24 "$(command -v pnpm)" audit --audit-level=high`
- Remaining risk/limitations: GitHub-hosted execution and the live advisory database response are
  not reproducible by local YAML validation alone; workflow is intentionally fail-closed. The
  existing `lint:deps` orphan warning remains outside this task's write set.
