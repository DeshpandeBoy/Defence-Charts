# CR-E04 (ledger R4) — Publication and competitor refresh

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session; web retrieval via search and page fetch, dated per
source below
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, commit `8214c53`

## Exact question and exclusions

Refresh the publication-readiness evidence `E1`–`E2` depend on — current npm trusted-publishing/
provenance mechanics, package metadata expectations, React/Next/Vite support evidence, and
date-sensitive risks — and spot-check date-sensitive competitor/tooling claims already cited in
`80`–`82` for staleness, per the `CR-E04` brief and the ledger's `R4` ("Publication and competitor
refresh") deliverable. Excluded: re-running the full `80`–`82` evidence audits; this task spot-checks
specific dated claims rather than re-auditing every claim in those documents.

## Current repository evidence

- `docs/package.json:28-30` — `"next": "16.3.2"`, `"react": "^19.2.0"`, `"react-dom": "^19.2.0"`.
- Installed: `next@16.3.2` (confirmed via `node_modules/.pnpm`), resolved against `react@19.2.8`.
- `package.json:18` — `"packageManager": "pnpm@10.34.5"`.
- `package.json` `engines` — `"node": ">=22.18"`.
- `research/00-decisions.md` decision 6 cites a "2.2.0 critical layout bug" for `react-grid-layout` as
  the reason to "stay away from" that version — this fact could not be independently verified from the
  locally installed package in `R1`/`CR-C01` (no local `CHANGELOG.md`); this task closes that gap (see
  below).

## External evidence

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| npm trusted publishing (OIDC) is generally available, requires npm CLI ≥11.5.1 and Node ≥22.14.0, and provenance attestations are generated automatically (no `--provenance` flag) when publishing via GitHub Actions or GitLab CI (cloud-hosted runners only) from a **public repository publishing a public package** | Official implementation | [GitHub Changelog, 2025-07-31](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/); [npm Docs, "Trusted publishing for npm packages"](https://docs.npmjs.com/trusted-publishers/), fetched 2026-08-24 | Confirms `E2.1`'s planned "trusted publishing/provenance" mechanism exists, is stable, and states its exact preconditions | The npm docs page does not address pnpm-based monorepo publishing at all — see the pnpm-specific finding below, which is the actual gap for this repository |
| The required GitHub Actions permission is `id-token: write` on the publishing job | Official implementation | Same npm Docs page, fetched 2026-08-24 | A concrete, one-line acceptance-checklist item for `E2.1`'s workflow | — |
| `pnpm publish` OIDC/trusted-publishing support exists but has an open regression on pnpm 11 (publish fails with a 404 in CI as of a report dated 2026-05-07) | Official implementation (GitHub issue tracker) | [pnpm/pnpm#11513](https://github.com/pnpm/pnpm/issues/11513); feature originally requested in [pnpm/pnpm#9812](https://github.com/pnpm/pnpm/issues/9812) (opened 2025-07-29, now closed) | This repository pins `pnpm@10.34.5` (`package.json:18`), not pnpm 11, so the specific reported regression's exact applicability to this repo's pinned version was **not** independently confirmed — the finding is that OIDC support in `pnpm publish` is recent and has had at least one live regression report, not that this repo is currently broken | Does not establish whether `pnpm@10.34.5` specifically is affected; `E1.4`/`E2.1` should verify the actual pinned-version publish flow directly in a dry run before relying on it, rather than assuming npm's own CLI guarantee transfers to `pnpm publish` |
| Next.js 16.3.x and 15.5.x are receiving a scheduled security release on 2026-08-26 for one critical-severity vulnerability, announced 2026-08-20; CVE and technical detail were not published at announcement time (disclosed alongside the fix) | Official implementation | [nextjs.org/blog, "Upcoming Next.js August Security Release"](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026), fetched 2026-08-24 | **Directly actionable for this repository**: `docs/package.json` pins `next@16.3.2` exactly inside the affected `16.3` line. The fix (reported as `16.3.3`) lands two days after this report's date | Does not establish the vulnerability's exploitability in this project's specific usage (a docs site, not the published library itself) — that assessment needs the disclosure due 2026-08-26 |
| `react-grid-layout` 2.2.0 shipped a critical layout bug; 2.2.1 fixed an infinite-loop-on-drag-from-outside issue and two other defects | Official implementation (GitHub Releases) | [react-grid-layout 2.1.0 release notes and surrounding release history](https://github.com/react-grid-layout/react-grid-layout/releases), retrieved via search 2026-08-24 | **Closes `R1`/`CR-C01`'s recorded unknown**: `00-decisions.md` decision 6's "2.2.0 critical layout bug, stay away from it" fact is independently confirmed from the project's own release history, and the currently installed `2.2.4` (verified in `CR-C01`) postdates the fix by three patch releases | The exact GitHub Releases page content for 2.2.1 itself was reached via a search summary, not a direct page fetch of that specific release note — a coordinator wanting the literal release-note text should fetch `github.com/react-grid-layout/react-grid-layout/releases/tag/2.2.1` directly |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| `docs.npmjs.com/trusted-publishers/` | Fetched successfully, 2026-08-24 | Single-page summary via the fetch tool's own model; treated as reliable for the specific facts quoted (CLI/Node version, `id-token: write`, public-repo/public-package requirement) since they are stated plainly and match the independently-found GitHub changelog post |
| `github.blog` changelog post on trusted publishing GA | Found via search, not directly fetched | Search-result summary only; the specific facts it reports (GA date, CLI version) match the directly-fetched npm docs page, so are corroborated by two independent official sources |
| `nextjs.org/blog` (security release announcement) | Fetched successfully, 2026-08-24 | The announcement itself states the CVE/technical detail is not yet public as of the announcement; this report cannot supply what upstream has not published yet |
| `pnpm/pnpm` GitHub issues #9812 and #11513 | #11513 found via search (not directly fetched); #9812 fetched directly but returned a page-load error that prevented reading the full thread | The exact resolution version for OIDC support in pnpm, and whether `pnpm@10.34.5` specifically carries the #11513 regression, could not be confirmed from these two retrievals alone — recorded as an unknown, not guessed |
| `react-grid-layout` 2.2.1 changelog | Reached via search summary, not a direct page fetch | Sufficient to confirm the 2.2.0-bug/2.2.1-fix fact `00-decisions.md` already asserts; not sufficient to quote the release note verbatim |
| Fumadocs release cadence (the "91 releases in 2026" claim in `30-implementation-plan.md:590`), tsdown maintenance status | **Not attempted this pass** | Time-bounded this session to the highest-value, most directly actionable findings (publication mechanics and the two version-pinned security/compatibility items above); a follow-up pass should still check these two before `E1` claims are finalized, since they were named in this task's own brief but not reached |

## Alternatives

- **Treat the Next.js finding as out of scope since `E1`/`E2` concern the published library packages, not the docs site.** Rejected: `docs/package.json` is part of this repository's release surface (it is what ships the public-facing site), and a critical security release landing two days after this report is exactly the kind of "date-sensitive risk" `CR-E04`'s brief asks for. Whether it is exploitable in this project's specific docs-site usage is a separate, smaller follow-up, not a reason to omit the finding.
- **Wait for the 2026-08-26 disclosure before reporting anything about the Next.js release.** Rejected: the advance-notice itself is actionable now (upgrade planning, watching for the patch) even though the technical detail is not yet public; reporting "watch this date" is more useful than silence.

## Recommendation and confidence

`E2.1`'s trusted-publishing plan is sound in principle — **confidence: high**, corroborated by two
independent official sources — but should not assume `pnpm publish` transfers npm's OIDC guarantee
without a direct dry-run against the pinned `pnpm@10.34.5`, given the live regression report against
pnpm 11. **Confidence: medium** on the pnpm-specific risk, since this repo's exact pinned version was
not confirmed either affected or unaffected. The Next.js pinned-version security-release finding is
**confidence: high** as a fact (directly fetched from the official blog) and **actionable now**:
recommend the coordinator plan to bump `docs/package.json`'s `next` pin to the patched version once it
ships on 2026-08-26, and note the date so it is not missed. The `react-grid-layout` 2.2.0 bug fact in
`00-decisions.md` decision 6 is now independently corroborated — **confidence: high**, closing `R1`'s
recorded unknown.

## Conflicts with locked/current decisions

None. This task corroborates decision 6's existing RGL fact rather than challenging it, and surfaces
one new, time-sensitive risk (the Next.js security release) that has no existing decision to conflict
with.

## Unknowns

- Whether `pnpm@10.34.5` specifically (this repo's pinned version) is affected by the OIDC 404
  regression reported against pnpm 11 — not confirmed either way.
- The Next.js 2026-08-26 vulnerability's CVE, technical detail, and exploitability in a docs-site
  context — not yet published upstream as of this report.
- Fumadocs release-cadence and tsdown-maintenance claims in `80`–`82` were not rechecked in this pass
  (see Retrieval log) — flagged for a follow-up, not silently assumed still current.

## Affected APIs, files, tests and docs

- `docs/package.json:28` — `next` pin should be bumped to the patched `16.3.3` (or later) once released
  2026-08-26; track this explicitly rather than letting it lapse past the disclosure date.
- `E1.4`/`E2.1` (Codex release tasks) — should add a dry-run verification of `pnpm publish`'s OIDC/
  trusted-publishing behavior against the actual pinned `pnpm@10.34.5` before relying on it in the
  real release workflow, given the pnpm-11 regression report.
- `00-decisions.md` decision 6 — the "2.2.0 critical layout bug" fact now has independent corroboration
  on record (this file); no change to the decision text is needed, only a citation available if wanted.

## Implementation acceptance checklist

- [ ] `E2.1`'s GitHub Actions release workflow declares `permissions: id-token: write` on the publish
      job, per the confirmed requirement.
- [ ] `E2.1` publishes from a **public** repository with **public** packages (both are required for
      automatic provenance) — confirm this matches the actual publish plan before relying on
      provenance attestation.
- [ ] `E1.4`/`E2.1` run an actual dry-run publish (e.g., to a scoped test package or a registry proxy)
      using the pinned `pnpm@10.34.5` and OIDC before the real Free-v1 release, given the open pnpm-11
      regression report — do not assume `pnpm publish` behaves identically to `npm publish` here.
- [ ] Someone tracks the 2026-08-26 Next.js security disclosure and bumps `docs/package.json`'s `next`
      pin once the patched version ships.
- [ ] A follow-up pass rechecks the Fumadocs release-cadence and tsdown-maintenance claims in
      `80`–`82` that this task's time budget did not reach.

## Proposed promotion

**Clarification** for `00-decisions.md` decision 6 (independent corroboration now available, no text
change required). **New, time-sensitive finding** for `E1`/`E2`: the Next.js pinned-version security
release and the pnpm OIDC dry-run requirement should both be added to `E1.4`/`E2.1`'s acceptance
criteria as concrete checklist items, not left implicit.
