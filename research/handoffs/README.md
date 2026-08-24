# Agent handoffs

Every active task owns one file in this directory: `research/handoffs/<task-id>.md`. Copy the template
below before work begins. The handoff is both the task card and the restart checkpoint.

Only the task owner edits its handoff while active. The coordinator may update assignment, state,
integration evidence, and final disposition.

## Template

```md
---
id: <task-id>
title: <short title>
type: implementation | research | verification | release | closeout
state: ready | claimed | in progress | handoff | verifying | done | blocked | rework | deferred
owner: <agent/provider or coordinator>
branch: <branch>
worktree: <absolute path>
base_commit: <sha>
depends_on: [<task ids>]
started_at: <ISO timestamp or not-started>
last_checkpoint: <ISO timestamp>
---

# <task-id> — <title>

## Objective

One outcome, written so it can be verified.

## Read first

- <authoritative file>

## Allowed write set

- <path or explicit glob>

## Do not edit

- research/90-final-delivery-and-agent-plan.md
- central shared integration files not named above
- files owned by another active task

## Acceptance criteria

- [ ] <observable condition>
- [ ] <test/evidence condition>
- [ ] Documentation describes only shipped behavior

## Baseline

- Branch:
- Base commit:
- Initial `git status --short`:
- Last known green command/commit:

## Current checkpoint

### Completed

- Nothing yet.

### In progress

- Nothing yet.

### Remaining

- <next unfinished item>

### Exact next action

```bash
<one command or precise edit target>
```

## Decisions and assumptions

| Item | Class | Evidence | Effect |
|---|---|---|---|

## Files changed

| Path | Why | Complete? |
|---|---|---:|

## Verification evidence

| Commit | Command | Exit | Exact result |
|---|---|---:|---|

## Known failures and blockers

| Failure/blocker | Reproduction | Owner/unblock condition |
|---|---|---|

## Integrator changes requested

- None.

## Final handoff

- Worker commit:
- Branch pushed or locally available:
- Working tree clean:
- Narrow restart check:
- Remaining risk/limitations:
```

## Checkpoint rules

- Checkpoint after each acceptance criterion or about every 45 minutes of meaningful work.
- Commit the handoff with the implementation/research checkpoint.
- A stale timestamp never authorizes deletion or reassignment without inspecting the branch/worktree.
- If a task is blocked, record the exact reproduction and the person, evidence, credential, or
  upstream task required to unblock it.
- If the working tree cannot be clean, list every dirty and untracked path and why it is safe.

