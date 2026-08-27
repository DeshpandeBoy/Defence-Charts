---
id: SECURITY-FIX
title: Apply repository security hardening fixes
type: implementation
state: done
owner: Codex coordinator
branch: Fine-Tuning-V1
worktree: /Users/SameeraD/Defence-Charts
base_commit: 014b58163d99d88ff4f763998d891368cc4b8eeb
depends_on: []
started_at: 2026-08-27T00:00:00+05:30
last_checkpoint: 2026-08-27T08:55:00+05:30
---

# SECURITY-FIX — Apply repository security hardening fixes

## Objective

Resolve the actionable security hardening findings from the repository-wide security audit while
preserving the presentational, RSC-safe architecture and existing release contract.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `docs/AGENTS.md`

## Allowed write set

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/security.yml`
- `.github/dependabot.yml`
- `docs/next.config.mjs`
- `apps/playground/vite.config.ts`
- `apps/rsc-fixture/next.config.ts`
- `scripts/check-*.mjs` only where the security audit identified runtime `npx pnpm` fetching
- security-focused tests and package scripts directly required by the fixes
- this handoff

## Do not edit

- `research/90-final-delivery-and-agent-plan.md`
- locked decisions or chart/grid source contracts
- unrelated user changes or generated results

## Acceptance criteria

- [x] Release-capable third-party workflow actions are pinned to full commit SHAs.
- [x] CI checkout steps do not persist credentials into untrusted pull-request worktrees.
- [x] Security gates use the provisioned/pinned package-manager path without ad-hoc network fetches.
- [x] Production-facing Next/Vite configurations emit explicit baseline security headers where the
      framework can control them.
- [x] CI runs reproducible dependency/security checks and dependency update monitoring is configured.
- [x] Targeted tests, full verification, and `git diff --check` pass.
- [x] No user-controlled data is introduced into shell commands or security headers.

## Baseline

- Branch: `Fine-Tuning-V1`
- Base commit: `014b58163d99d88ff4f763998d891368cc4b8eeb`
- Initial `git status --short`: clean
- Last known green command: `PATH=/Users/SameeraD/.nvm/versions/node/v22.22.0/bin:$PATH pnpm verify`

## Current checkpoint

### Completed

- Read-only security audit completed; no confirmed application or dependency vulnerability found.
- Integrated workflow/package-manager hardening commit `a42f908`.
- Integrated framework header hardening commit `85de3b6`.
- Integrated security automation commit `d9db456`.
- Added credential persistence hardening to the release checkout and expanded Dependabot to all
  application/package manifest directories.
- Verified official action refs: checkout `fbc6f399`, pnpm/action-setup peeled v4 commit `b906affc`,
  setup-node `a0853c24`, cache `0057852b`, and changesets/action branch `v1` commit `a45c4d59`.
- Full project and browser verification passed after integration.

### Remaining

- None.

### Exact next action

```bash
git status --short --branch && git diff --check
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| No confirmed runtime/dependency vulnerability | evidence | `pnpm audit`, source scans, package gates | Fix hardening gaps without changing chart behavior |
| GitHub action SHAs must be resolved from their official repositories | security | mutable refs in CI/release workflows | Pin exact immutable commits and document update path |
| App-level headers are defense in depth | assumption | no headers in Next/Vite config; deployment may add some | Add compatible baseline headers without claiming platform coverage |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `.github/workflows/ci.yml` | Immutable actions and isolated CI checkout | yes |
| `.github/workflows/release.yml` | Immutable release actions | yes |
| `.github/workflows/security.yml` | Reproducible audit and package security gates | yes |
| `.github/dependabot.yml` | Automated dependency/action update monitoring | yes |
| `docs/next.config.mjs` | Baseline docs security headers | yes |
| `apps/rsc-fixture/next.config.ts` | Baseline RSC fixture security headers | yes |
| `apps/playground/vite.config.ts` | Baseline Vite dev/preview security headers | yes |
| `scripts/check-*.mjs` | Remove ad-hoc package-manager fetches | yes |
| `scripts/check-security-headers.test.mjs` | Header regression coverage | yes |
| `research/handoffs/SECURITY-FIX.md` | Durable task checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| `014b581` | `pnpm audit --json` | 0 | No advisories |
| `014b581` | `pnpm audit --prod --json` | 0 | No advisories |
| `d9db456` | `pnpm vitest run scripts/check-security-headers.test.mjs scripts/check-package-gates.test.mjs scripts/check-rsc.test.mjs scripts/check-consumers.test.mjs` | 0 | 4 files, 21 tests passed |
| `d9db456` | `pnpm verify` | 0 | 76 test files, 985 tests; typecheck, lint, build, package, boundary, typography, and token gates passed |
| `d9db456` | `pnpm lint:rsc` | 0 | 77 marks; 0 chart markers in client JavaScript |
| `d9db456` | `pnpm lint:containment` | 0 | 178 sizes; 0 loop errors; 0 overflow |
| `d9db456` | `pnpm lint:grid` | 0 | Chromium matrix passed; 0 ResizeObserver loop errors |
| `d9db456` | `pnpm lint:motion` | 0 | Chromium motion/reduced-motion checks passed |
| `d9db456` | `git ls-remote` official action refs | 0 | All pinned refs resolve to the intended official commits |
| working tree | `pnpm vitest run scripts/check-security-headers.test.mjs` | 0 | Header regression tests passed after final workflow/config edits |
| working tree | YAML/static security checks | 0 | All workflow actions remain SHA-pinned; all checkouts disable credential persistence; no gate script uses ad-hoc `npx` pnpm fetching |
| `fa9e467` | `git status --short --branch && git diff --check` | 0 | Integrated tree clean after coordinator commit |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| None | — | — |

## Integrator changes requested

- Keep action pinning and security automation changes scoped to workflow/config files.
- Do not weaken existing OIDC or package verification gates.

## Final handoff

- Worker commits: `a42f908`, `85de3b6`, `d9db456`
- Coordinator commit: `fa9e467`
- Branch pushed or locally available: integrated locally on `Fine-Tuning-V1`
- Working tree clean: yes
- Narrow restart check: `pnpm vitest run scripts/check-security-headers.test.mjs`
- Remaining risk/limitations: external deployment headers and npm trusted-publisher configuration require live-platform verification; CSP/HSTS remain deployment-sensitive.
