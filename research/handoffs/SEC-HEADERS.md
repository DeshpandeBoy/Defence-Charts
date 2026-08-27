---
id: SEC-HEADERS
title: Baseline application security headers
type: implementation
state: handoff
owner: Codex
branch: codex/SEC-HEADERS-security-headers
worktree: /Users/SameeraD/.codex/worktrees/2176/Defence-Charts
base_commit: 014b58163d99d88ff4f763998d891368cc4b8eeb
depends_on: []
started_at: 2026-08-27T08:39:20+05:30
last_checkpoint: 2026-08-27T08:43:49+05:30
---

# SEC-HEADERS — Baseline application security headers

## Objective

Add safe baseline response security headers to the repository's Next.js docs app, Next.js RSC
fixture, and Vite playground configurations, with configuration-level proof and explicit ownership
boundaries for framework versus deployment/platform headers.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `docs/AGENTS.md`
- installed Next.js 16.3.3 guidance under `/Users/SameeraD/Defence-Charts/node_modules/`
- `docs/next.config.mjs`
- `apps/rsc-fixture/next.config.ts`
- `apps/playground/vite.config.ts`

## Allowed write set

- `docs/next.config.mjs`
- `apps/rsc-fixture/next.config.ts`
- `apps/playground/vite.config.ts`
- directly related security-header tests, if needed
- `research/handoffs/SEC-HEADERS.md`

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- central shared integration files not named above
- files owned by another active task
- generated results

## Acceptance criteria

- [x] Each framework configuration that serves this repository has a safe baseline header policy
  appropriate to its runtime and existing Next/Fumadocs/RSC/Vite behavior.
- [x] Policies avoid unnecessary wildcard sources and do not change chart behavior or introduce a
  second framework.
- [x] Configuration-level assertions or the smallest relevant checks prove the shipped rules.
- [x] Framework-controlled headers are distinguished from deployment/platform headers in this
  handoff and final evidence.
- [x] Targeted tests/checks, `git diff --check`, and relevant typecheck/lint pass.
- [x] Code and handoff are committed together.

## Baseline

- Branch: `codex/SEC-HEADERS-security-headers`
- Base commit: `014b58163d99d88ff4f763998d891368cc4b8eeb`
- Initial `git status --short`: clean before this handoff
- Last known green command/commit: base commit `014b581`; broader project verification was reported
  green by prior work, but this task will run scoped checks from this worktree.

## Current checkpoint

### Completed

- Startup checks recorded in the task execution: clean base, exact commit, recent log, worktree list.
- Read governing repository/build documents and `docs/AGENTS.md`.
- Confirmed the three configs currently have no security-header rules.
- Created the missing task handoff required by the repository contract.

### In progress

- None; implementation and targeted verification are complete pending the final commit.

### Remaining

- None; commit the staged implementation and handoff as the final task changeset.

### Exact next action

```bash
git diff --check && git status --short --branch
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Task scope | user-provided assignment | Delegated SEC-HEADERS brief | Only the three serving configs, directly related tests, and this handoff may change. |
| Branch | repository workflow | `AGENTS.md` and current worktree state | Work on `codex/SEC-HEADERS-security-headers` from the supplied base commit. |
| Next.js version | current repository fact | `docs/package.json`, `apps/rsc-fixture/package.json` | Use Next.js 16.3.3 guidance/API; do not assume older config semantics. |
| Installed Next.js docs location | current environment fact | Main checkout dependency store; this worktree has no linked `node_modules` | Read the exact 16.3.3 package docs from the sibling checkout's pnpm store and record the limitation. |
| Baseline policy | implementation choice | Next.js 16.3.3 headers guide and existing app behavior | Use `nosniff`, `DENY`, strict cross-origin referrer reduction, and deny-by-default browser capabilities. Do not add a static CSP that would require nonce-aware dynamic rendering. |
| Header scope | implementation choice | Next `headers()` and Vite 7 `server.headers`/`preview.headers` APIs | Apply the policy to every Next route and to Vite dev/preview responses; do not pretend Vite's static build contains response headers. |

## Header ownership boundary

### Framework-controlled in this task

- Next.js `headers()` rules in `docs/next.config.mjs` and `apps/rsc-fixture/next.config.ts`.
- Next.js `poweredByHeader: false` in both Next configs.
- Vite `server.headers` and `preview.headers` in `apps/playground/vite.config.ts`.

### Deployment/platform-controlled, intentionally not set here

- `Strict-Transport-Security` (HSTS): add it only at the TLS-terminating deployment/platform layer,
  after confirming HTTPS is universal for the host and its subdomains. Setting it in local HTTP
  development configuration would create a browser-enforced transport policy outside this repo's
  control.
- `Content-Security-Policy`: a strict Next policy needs a per-request nonce and dynamic rendering;
  the installed Next.js guide explicitly describes that contract. The existing static Fumadocs and
  RSC builds have not been audited for a nonce-compatible policy, so this task leaves CSP to a
  separate, evidence-backed hardening task rather than shipping an unsafe wildcard or inline policy.
- Vite production response headers: `vite build` writes static files only. The production static
  host/CDN must emit the same baseline headers (and any HSTS/CSP policy) in its response configuration.

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `docs/next.config.mjs` | Global Next response security headers and powered-by suppression | Yes |
| `apps/rsc-fixture/next.config.ts` | Global Next response security headers and powered-by suppression | Yes |
| `apps/playground/vite.config.ts` | Dev and preview response security headers | Yes |
| `scripts/check-security-headers.test.mjs` | Configuration-level assertions for all three serving configs | Yes |
| `research/handoffs/SEC-HEADERS.md` | Durable task card, ownership boundary, and verification evidence | Yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| — | Startup checks | 0 | Clean at `014b58163d99d88ff4f763998d891368cc4b8eeb`; branch was detached before creating the task branch. |
| — | `pnpm vitest run scripts/check-security-headers.test.mjs` | 0 | 1 file passed; 2 tests passed. |
| — | `pnpm --filter @shiftcharts/docs typecheck` | 0 | Next route types generated; TypeScript passed. |
| — | `pnpm --filter @shiftcharts/rsc-fixture typecheck` | 0 | TypeScript passed. |
| — | `pnpm --filter @shiftcharts/playground typecheck` | 0 | TypeScript passed. |
| — | `pnpm exec eslint --no-ignore docs/next.config.mjs apps/rsc-fixture/next.config.ts apps/playground/vite.config.ts scripts/check-security-headers.test.mjs` | 0 | No lint errors. |
| — | `pnpm --filter @shiftcharts/docs build` | 0 | Next.js 16.3.3 webpack build passed; 51 static pages generated. Fumadocs emitted existing dynamic-import cache warnings. |
| — | `pnpm --filter @shiftcharts/rsc-fixture build` | 0 | Next.js 16.3.3 Turbopack build passed; static `/` and `/_not-found` generated. |
| — | `pnpm --filter @shiftcharts/playground build` | 0 | Vite 7.3.6 build passed; 347 modules transformed. |
| — | Generated Next route manifest inspection | 0 | Both `.next/routes-manifest.json` files contain `/:path*` and all four configured header keys. |
| — | `git diff --check` | 0 | No whitespace errors. |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| Task handoff was absent at start | `test -e research/handoffs/SEC-HEADERS.md` initially failed | Resolved by creating this handoff before implementation. |

## Integrator changes requested

- None yet.

## Final handoff

- Worker commit: final task changeset containing implementation, test, and handoff (see `git log -1`)
- Branch pushed or locally available: locally available on `codex/SEC-HEADERS-security-headers`
- Working tree clean: expected after the final task changeset
- Narrow restart check: `pnpm vitest run scripts/check-security-headers.test.mjs`
- Remaining risk/limitations: HSTS and production Vite headers remain deployment/platform work; CSP
  requires a separate nonce/dynamic-rendering audit. The task worktree initially lacked dependency
  symlinks, so `pnpm install --offline --frozen-lockfile` was run; it changed no tracked files.
