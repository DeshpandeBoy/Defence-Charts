---
id: CR-TY01
title: Typography validation — Segoe UI Variable, GRAD at 11px, U+2212, line-height
type: research
state: handoff
owner: claude-research
branch: Anti-gravity-and-other-Agent-changes
worktree: /Users/SameeraD/Defence-Charts
base_commit: 9443cfb
depends_on: [P0.1]
started_at: 2026-08-26
last_checkpoint: 2026-08-26
---

# CR-TY01 — Typography validation

## Objective

Close as much of `92-claude-research-workstream.md`'s `CR-TY01` brief (Segoe UI Variable/Windows
drift, GRAD:150 legibility at 11px, screenshot baseline, line-height, U+2212 metrics) as this
session's environment genuinely permits, and label precisely what remains unavailable rather than
guessing at it or silently repeating the existing UNVERIFIED label without new investigation.

## Read first

- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/92-claude-research-workstream.md`
- `research/41-text-metrics.md` (§3, §4.2, §9)
- `research/42-typography.md` (§3)
- `packages/core/src/font-metrics.generated.ts`
- `packages/tokens/src/themes/theme.css`
- `packages/core/src/format.ts`

## Allowed write set

- `research/agent-work/claude/CR-TY01-typography-validation.md`
- `research/handoffs/CR-TY01.md`

## Do not edit

- `research/00-decisions.md`, `research/41-text-metrics.md`, `research/42-typography.md` — read-only;
  this task's findings are clarifications, not corrections, so no edit to these is proposed.
- `packages/core/src/font-metrics.generated.ts` — generated file; not hand-edited, and this task did
  not run its generator (no new Segoe measurement was produced to regenerate it with).
- Runtime source, other task handoffs.

## Acceptance criteria

- [x] Verify whether a legitimate, obtainable path to Segoe UI Variable (or a licensed proxy) exists,
      rather than repeating "unavailable" unchecked.
- [x] Determine Segoe UI Variable's actual variable-font axis list from an official source.
- [x] Determine whether the GRAD:150 screenshot baseline is currently producible at all (checked
      whether any shipped element consumes the landmark-grade token).
- [x] Re-verify the U+2212 and line-height findings are still accurate against current shipped source,
      not just against the research document.
- [x] Every claim labelled by evidence class; every retrieval attempt and its limitation recorded.
- [x] Two concrete, ordered next steps recorded for the coordinator, not a bare "still blocked."

## Baseline

- Branch: `Anti-gravity-and-other-Agent-changes` (direct, user-authorized session work — no isolated
  worktree; matches this session's established pattern for `VT-003` and the `R1`–`R4` ledger review).
- Base commit: `9443cfb`.
- Initial `git status --short`: clean.
- Last known green command: `pnpm verify` (full chain), green as of this session's prior checkpoint.

## Current checkpoint

### Completed

- Confirmed the existing `UNVERIFIED` label on Segoe UI Variable's contribution to `safetyFactor` is
  still accurate — not stale, not silently assumed resolved.
- **New finding**: fetched Microsoft's own Windows typography documentation (2026-08-26) — Segoe UI
  Variable's axis list is weight + optical size only, **no grade (`GRAD`) axis**. Combined with this
  project's own already-decided GRAD-less-face fallback rule (`42-typography.md:149`), this means the
  landmark-emphasis token will render with zero visual effect on Windows once implemented — a concrete,
  actionable finding usable today without any Windows access.
- **New finding**: Microsoft publishes **Selawik**, an OFL-1.1-licensed, freely obtainable font stated
  to be metrically compatible with (classic) Segoe UI — a legitimate future proxy for a bounded
  calibration pass, explicitly not treated as Segoe UI Variable data itself in this report.
- **New finding**: grepped all shipped CSS/TSX for the landmark-grade token's consumption — found none.
  No element currently applies `GRAD` emphasis, so the screenshot-baseline sub-question has no current
  subject on any platform, which changes its sequencing (blocked on implementation, not on Windows
  access).
- Re-verified `U+2212` and line-height findings against current `packages/core/src/format.ts` — both
  still accurate and unchanged since `41-text-metrics.md` was written.
- Wrote `research/agent-work/claude/CR-TY01-typography-validation.md` with full evidence table,
  alternatives (including why a same-session Selawik measurement was deliberately not attempted),
  recommendation, and an implementation acceptance checklist.

### In progress

- None — task-scoped work is complete for what this session's environment permits.

### Remaining

- The actual Segoe UI Variable `safetyFactor` measurement itself remains open. Two concrete unblocks
  are recorded in the report's Recommendation section (a real Windows machine running the existing
  generator against `C:\Windows\Fonts\SegUIVar.ttf`, or a separately-scoped, explicitly-labelled
  Selawik proxy pass) — coordinator to choose.
- The GRAD:150 screenshot baseline is deferred to whichever task first wires landmark emphasis to a
  real element.

### Exact next action

```bash
sed -n '/## Recommendation and confidence/,/## Conflicts/p' research/agent-work/claude/CR-TY01-typography-validation.md
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|
| Segoe UI Variable is unobtainable in this session | Repository/session fact | No Windows access in this environment | Confirmed still true, not re-guessed |
| Selawik is a legitimate but imperfect proxy | Official implementation, with caveats | Microsoft's own docs + Selawik's own README (kerning gaps, static not variable) | Recorded as a future option, not used to produce a number this pass |
| GRAD axis absence is real, actionable evidence | Official implementation | Microsoft Learn, fetched 2026-08-26 | Coordinator can act on this now, independent of the deeper metric-drift question |

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `research/agent-work/claude/CR-TY01-typography-validation.md` | Full evidence report | yes |
| `research/handoffs/CR-TY01.md` | Durable checkpoint | yes |

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|
| working tree | `grep -rn "landmark-grade\|font-variation-settings" packages/*/src/*.css packages/*/src/*.tsx` | 0 | no output — confirms zero shipped consumers of the GRAD landmark token |
| working tree | `grep -n "u2212\|MINUS SIGN" packages/core/src/format.ts` | 0 | confirms the U+2212 finding is present and current in shipped source |
| n/a | WebFetch `learn.microsoft.com/.../typography` | — | confirmed axis list (weight, optical size only) |
| n/a | WebFetch `github.com/microsoft/Selawik` | — | confirmed OFL-1.1 license, static font, known kerning gaps vs. Segoe UI |

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|
| No real Windows/Segoe UI Variable measurement | This session has no Windows access | Coordinator picks one of the two paths in the report's Recommendation item 4 |
| No GRAD screenshot baseline | No shipped element consumes the token yet | Falls out naturally once a `D`-family or `I1` task wires landmark emphasis to a real label |

## Integrator changes requested

- Decide Windows/Segoe's GRAD fallback behavior ("no emphasis" vs. an explicit alternative) as part of
  whichever task first implements landmark emphasis, using this report's GRAD-axis-absence finding.
- Choose and schedule one of the two Segoe `safetyFactor` unblock paths, or explicitly accept the
  current bound as sufficient for launch and record that as a decision rather than an oversight.

## Final handoff

- Worker commit: pending — commit this handoff together with the evidence report.
- Branch pushed or locally available: local current checkout `Anti-gravity-and-other-Agent-changes`.
- Working tree clean: no — the two files above are new, pending commit.
- Narrow restart check: `git log -1 --oneline -- research/agent-work/claude/CR-TY01-typography-validation.md research/handoffs/CR-TY01.md`
- Remaining risk/limitations: this report's new findings (GRAD-axis absence, Selawik's licensing/gaps)
  rest on two web fetches, each dated and sourced; not independently cross-checked against a second
  source this pass. The core Segoe UI Variable metric-drift question remains genuinely open, not
  resolved by this report — it narrows the gap and gives two concrete next steps rather than closing it.
