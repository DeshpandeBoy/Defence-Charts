# ShiftCharts Free-v1 release audit

Date: 2026-08-26  
Candidate lineage: `c53efe4` through `9a8ccf0`
Prospective public version: `0.1.0` for all six packages

## Outcome

The repository implementation is release-candidate complete. A clean isolated worktree generated
the Changesets `0.1.0` state, built from no pre-existing `dist/` directories, passed the full source
and package gate, and completed a six-package `pnpm publish --dry-run`.

The verified candidate is integrated into `main`. Hosted CI run `32989961984` passed both the
source-verification and browser jobs, and Release run `32991174680` passed its full verification and
created GitHub PR #1 (`Version Packages`) for the six version bumps.

Live npm publication is not complete. The local npm CLI is unauthenticated, and account-level
ownership/trusted-publisher entries for `@shiftcharts/*` have not been demonstrated. This audit does
not turn that external prerequisite into a claim that the packages are public.

## Candidate packages

| Package | Version | SHA-256 of audited tarball |
| --- | ---: | --- |
| `@shiftcharts/core` | `0.1.0` | `bcb6a90e617fa8c93a27afc91fa3997f64ecb4776cc74ee0890fccd9333ca4c4` |
| `@shiftcharts/grid` | `0.1.0` | `f4cdcc8cc270f6c2b6e665f592f767fb820a7293d04c67d8acac230699da9f1c` |
| `@shiftcharts/primitives` | `0.1.0` | `7f096d38e8a1d514c91d9093fa6a169e424849aa777a8b18e98eaac038f12a61` |
| `@shiftcharts/react` | `0.1.0` | `2d15cf5a346ae6402b7fb13976c3e8d9cc80d57472c8ee6d6e374725afc14447` |
| `@shiftcharts/testing` | `0.1.0` | `bf0ef355cb5fd79fbc21402ee9bc2f6e0fc8122a9caad546e6586ed4134f5820` |
| `@shiftcharts/tokens` | `0.1.0` | `08ce26f7d1e584e33ad528410331e834ea738b47879fd931d367003d2be4bc6b` |

The tarballs were generated in an isolated worktree after `changeset version`. The package gate also
packed fresh copies and installed them in clean React, Vite, and Next.js/RSC consumers with network
access disabled after install.

## Verification evidence

| Command | Result |
| --- | --- |
| `npx -y node@24 "$(which pnpm)" verify` in the source checkout | pass; 74 files/972 tests, six publint/attw pairs, 246 packed files, seven CSS subpaths, consumer-build/no-network, RSC, boundary, typography, and token drift |
| `SHIFTCHARTS_REQUIRE_BROWSER=1 ... lint:containment` | pass; 178 sizes, 13 rung changes, zero loop errors and zero unattributed overflow |
| `SHIFTCHARTS_REQUIRE_BROWSER=1 ... lint:grid` | pass; pointer, keyboard, hidden/zero-size parents, grid/flex/overflow/transform/zoom ancestors, RTL, reduced motion, forced colors, and touch |
| `... scripts/check-family-matrix.mjs` | pass; ten families/rungs, both themes, desktop/narrow, states, media, resize identity, and screenshot evidence |
| `... scripts/check-interaction-browser.mjs` | pass; touch lock/close, keyboard datum navigation, legend toggles, resize identity, reduced motion, and forced colors |
| `SHIFTCHARTS_REQUIRE_BROWSER=1 ... lint:rsc` | pass; JavaScript-disabled server render, 77 marks, zero chart markers in client chunks |
| `... scripts/check-grid-stress.mjs` | pass; 1/10/50/100/200 widgets, stable single change/commit callback per sample |
| `SHIFTCHARTS_REQUIRE_BROWSER=1 ... lint:motion` | pass; two-stage interpolation, declared 500 ms stage gap, reduced-motion still baseline |
| clean worktree: `changeset version && pnpm verify` | pass at six-package `0.1.0`; proved the verification gate no longer relies on stale ignored build output |
| clean worktree: `pnpm -r --filter './packages/**' publish --dry-run --no-git-checks` | pass for all six public `0.1.0` packages; npm correctly warned that live publication needs login |
| `git diff --check` | pass |
| GitHub CI run `32989961984` on `main` | pass; `verify` and `browser` jobs green |
| GitHub Release run `32991174680` on `main` | pass; Changesets PR #1 created |

## P0 findings fixed during the audit

1. The real containment gate found latent SVG scroll overflow introduced when the HTML caption was
   positioned over a full-height SVG. The shared chart root now uses `overflow: clip`, and the full
   178-size browser sweep is green.
2. A clean versioned worktree proved `pnpm verify` ran artifact tests before the only guaranteed
   package build. The command now runs `verify:packages` before unit tests, so clean clones cannot
   pass or fail based on ignored `dist/` residue.
3. Public installation docs still called the final npm scope a placeholder. The scope is now stated
   as final while package availability remains accurately gated on the first publish.
4. Fumadocs core/base UI were refreshed from 16.15.1 to current 16.15.2. The current registry release
   of tsdown remains the already-pinned 0.22.14.
5. Hosted CI still ran the artifact tests before the build even after the local `verify` script was
   corrected. The CI job now builds before tests; the hosted `main` run is green.

## Claim boundaries and known limitations

- Real assistive-technology task-study evidence (`CR-X04`, including NVDA) has not been produced.
  ShiftCharts claims tested semantics and interaction equivalents, not verified behavior in every
  screen reader/browser pair.
- Segoe UI Variable remains unmeasured. Decision 019 accepts the conservative measured `1.57`
  fallback bound for Free v1 and keeps the limitation public.
- VT-009, VT-010, and VT-011 remain intentionally deferred design questions, not confirmed defects.
- The grid stress runner records measurements but defines no performance budget; observed timings
  are evidence, not a universal latency guarantee.
- Fumadocs MDX emits non-fatal webpack cache-invalidation warnings around dynamic imports. The docs
  build and all 51 generated routes complete successfully.

## Publication and rollback

Pushing this candidate to `main` is safe only as a fast-forward. The Changesets action should open a
version PR that converts the six packages from workspace `0.0.0` to `0.1.0`; do not merge that PR
until the npm scope and all six trusted-publisher entries exist.

The version PR is currently open as
`https://github.com/DeshpandeBoy/Defence-Charts/pull/1`. It is intentionally not merged: npm scope
ownership and trusted-publisher setup remain the only external publication prerequisites.

Before npm publication, rollback is a normal Git revert of the release-candidate commits followed by
a fast-forward push. After npm publication, versions are immutable release artifacts: correct with a
new patch and deprecate an affected version when necessary; do not rewrite Git history or assume an
npm unpublish is an ordinary rollback.
