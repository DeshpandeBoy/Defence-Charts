---
id: CR-SEC
title: Fix PlanOverrides prototype-chain integrity issue
type: implementation
state: done
owner: Codex
branch: Fine-Tuning-V1
worktree: /Users/SameeraD/Defence-Charts
base_commit: 014b58163d99d88ff4f763998d891368cc4b8eeb
depends_on: []
started_at: 2026-08-27T08:37:16+05:30
last_checkpoint: 2026-08-27T08:42:24+05:30
---

# CR-SEC — Fix PlanOverrides prototype-chain integrity issue

## Objective

Prevent attacker-controlled `PlanOverrides` object keys from changing a plan through the
JavaScript prototype setter, while preserving the pure, serialisable, immutable override contract.

## Read first

- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `packages/core/src/overrides.ts`
- `packages/core/src/overrides.test.ts`

## Allowed write set

- `packages/core/src/overrides.ts`
- `packages/core/src/overrides.test.ts`
- `research/handoffs/CR-SEC.md`

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- central shared integration files
- files owned by another active task

## Acceptance criteria

- [ ] Dangerous own keys (`__proto__`, `constructor`, `prototype`) cannot alter the resulting plan.
- [ ] The hostile JSON regression case is covered, including no global prototype pollution and a
      stable JSON round-trip for accepted plans.
- [ ] Existing override semantics, typecheck, focused tests, full tests, and `git diff --check`
      pass.

## Baseline

- Branch: `Fine-Tuning-V1`
- Base commit: `014b58163d99d88ff4f763998d891368cc4b8eeb`
- Initial `git status --short`: clean
- Last known green command/commit: `pnpm verify` at `014b581`

## Current checkpoint

### Completed

- Confirmed the issue in the built package: a JSON `__proto__` payload creates an inherited
  `marks.primary.kind`, while `JSON.stringify()` drops the inherited field.
- Confirmed `Object.prototype` remains unchanged; this is a plan-integrity issue, not global
  prototype pollution or code execution.
- Rejected `__proto__`, `constructor`, and `prototype` at every recursive override object path,
  including nested objects inside replacement arrays.
- Added regression coverage for all three dangerous keys, global prototype preservation, safe own
  keys, and JSON serialisability.

### In progress

- None.

### Remaining

- None after the checkpoint commit.

### Exact next action

```bash
PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm vitest run packages/core/src/overrides.test.ts
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Reject dangerous keys explicitly | Security fix | Hostile JSON reproduction against `packages/core/dist` | Invalid/untrusted override input fails clearly instead of producing a partially or ambiguously interpreted plan. |
| Keep `@gx/core` pure and serialisable | Locked architecture | `research/00-decisions.md`, decisions 2 and 8 | No DOM, React, network, or mutable singleton added. |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `packages/core/src/overrides.ts` | Reject prototype-sensitive keys during recursive merge/copy | yes |
| `packages/core/src/overrides.test.ts` | Hostile JSON and dangerous-key regression coverage | yes |
| `research/handoffs/CR-SEC.md` | Durable task checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| `014b581` | `pnpm audit --prod --audit-level low` | 0 | No known vulnerabilities found; prior security audit baseline. |
| `014b581` | `pnpm test` | 0 | 75 test files, 978 tests passed; prior security audit baseline. |
| `d4782b3` | `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm vitest run packages/core/src/overrides.test.ts` | 0 | 1 file, 28 tests passed. |
| `d4782b3` | `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm --filter @shiftcharts/core typecheck` | 0 | Core typecheck passed. |
| `d4782b3` | `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm verify` | 0 | 75 test files, 983 tests; all typecheck, lint, build, package, boundary, typography, and token-drift gates passed. |
| `d4782b3` | built-distribution hostile JSON probe | 0 | Payload rejected at `marks.primary.__proto__`; global prototype descriptor unchanged. |
| `d4782b3` | `git diff --check` | 0 | No whitespace errors. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| Concurrent `research/handoffs/SECURITY-FIX.md` appeared in this shared worktree | `git status --short` | — | Owned by the concurrent coordinator security-hardening task; untouched and intentionally excluded from this commit. |

## Integrator changes requested

- None.

## Final handoff

- Worker commit: `d4782b3` (`fix(core): reject prototype-sensitive plan overrides`)
- Branch pushed or locally available: local `Fine-Tuning-V1`
- Working tree clean: no; only the concurrent `research/handoffs/SECURITY-FIX.md` handoff is untracked and was not touched or included.
- Narrow restart check: `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm vitest run packages/core/src/overrides.test.ts`
- Remaining risk/limitations: full external security scanners were unavailable locally; this fix
  addresses the confirmed `PlanOverrides` prototype-chain issue.
