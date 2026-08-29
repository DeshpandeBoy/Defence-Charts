---
id: PKG-CLAUDE-TEST-01
title: Extractable Claude test package
type: release
state: handoff
owner: codex
branch: Fine-Tuning-V1
worktree: /Users/dhanyarao/Documents/Defence
base_commit: 5711ab4aab0a8afb16cf28f3cc41d76a46d1e413
depends_on: [E1.4]
started_at: 2026-08-29T23:59:01+05:30
last_checkpoint: 2026-08-30T00:01:13+05:30
---

# PKG-CLAUDE-TEST-01 — Extractable Claude test package

## Objective

Produce one ZIP containing a static ShiftCharts demo, a minimal editable source workspace, and
the six locally packed package archives so the requester can test the charts after extraction.

## Read first

- `AGENTS.md`
- `research/00-decisions.md`
- `research/90-final-delivery-and-agent-plan.md`
- `research/91-codex-build-workstream.md`
- `research/handoffs/E1.4.md`

## Allowed write set

- `research/handoffs/PKG-CLAUDE-TEST-01.md`
- Untracked delivery artifact under `deliverables/`

## Acceptance criteria

- [ ] ZIP contains a static browser demo and editable source.
- [ ] ZIP contains all six locally packed package archives.
- [ ] The existing package verification gate passes before delivery.
- [ ] Extraction contents and checksum are recorded.

## Baseline

- Branch: `Fine-Tuning-V1`
- Base commit: `5711ab4aab0a8afb16cf28f3cc41d76a46d1e413`
- Initial `git status --short`: clean

## Current checkpoint

### Completed

- Confirmed E1.4 already provides a six-package packed-artifact consumer gate.
- Built the six package archives from the current checked-out source.
- Assembled a static interactive Vite demo, minimal editable workspace, local package archives,
  setup guide, and Claude prompt into one archive.
- Tested every ZIP member with `unzip -t`.

### In progress

- No implementation remains.

### Remaining

- Requester can extract and test the package. This delivery is deliberately not an npm publication.

### Exact next action

```bash
unzip -t deliverables/ShiftCharts-Claude-Test.zip
```

## Files changed

| Path | Why | Complete? |
|---|---|---:|
| `deliverables/ShiftCharts-Claude-Test.zip` | Single extractable delivery artifact | yes |
| `deliverables/ShiftCharts-Claude-Test/` | Inspectable uncompressed copy of the delivery | yes |
| `research/handoffs/PKG-CLAUDE-TEST-01.md` | Durable packaging checkpoint | yes |

## Verification evidence

| Command | Exit | Exact result |
|---|---:|---|
| `pnpm verify:packages` | 0 | Built all workspace artifacts; package reliability gate passed for 6 packages, including packed consumer and no-network checks. |
| `unzip -t deliverables/ShiftCharts-Claude-Test.zip` | 0 | Every archive member passed its compressed-data integrity test. |
| Required-content archive query | 0 | The static demo, editable workspace, setup prompt, and all 6 local `.tgz` archives are present. |
| `git diff --check` | 0 | No whitespace errors in tracked changes. |

## Delivery details

- Archive: `deliverables/ShiftCharts-Claude-Test.zip`
- Size: `1,332,990` bytes
- SHA-256: `bda84afedd7d27fdfac0e59ec6b73e2f78f3fd7fb64a48f2cd135484dd0fc32c`
- Contents: static demo; editable `source/` workspace; six local package archives; MIT licence;
  setup guide and Claude prompt.

## Final handoff

- Worker commit: not committed — the ZIP is a user-requested local delivery artifact and remains
  untracked with its handoff pending coordinator disposition.
- Working tree: intentional untracked delivery directory and this handoff only.
- Narrow restart check: `unzip -t deliverables/ShiftCharts-Claude-Test.zip`
- Remaining limitation: package names remain prerelease `0.0.0`; no npm publication occurred.
