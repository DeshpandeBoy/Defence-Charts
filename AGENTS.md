# Defence-Charts agent operating contract

This file governs every Codex, Claude, and other automated agent working in this repository. The
project must be resumable from committed files without access to an earlier chat.

> If a fact exists only in chat, it does not exist for the project.

## Read before working

1. `research/00-decisions.md`
2. `research/90-final-delivery-and-agent-plan.md`
3. `research/91-codex-build-workstream.md` or `research/92-claude-research-workstream.md`
4. `research/handoffs/<assigned-task-id>.md`
5. The task's listed source/research files

Files under `docs/` also follow `docs/AGENTS.md`.

## Startup checks

Run and record:

```bash
pwd
git status --short --branch
git rev-parse HEAD
git log -3 --oneline
git worktree list
```

If the task, owner, branch, allowed write set, acceptance criteria, or current checkpoint is missing,
do not start implementation. Prepare or repair the task handoff first.

If the tree contains unexpected changes, preserve them and record the paths. Never overwrite,
discard, reset, stash, or reformat unrelated work.

## Task lifecycle

Use only the states defined by the master plan:

```text
backlog -> ready -> claimed -> in progress -> handoff -> verifying -> done
                                |                |
                                +-> blocked      +-> rework
```

Only the coordinator moves a task to `done`. An agent may finish its work by moving it to `handoff`
and providing reproducible evidence.

## Ownership

- One task, one owner, one branch/worktree, one active handoff.
- Use `codex/<task-id>-<slug>` or `claude/<task-id>-<slug>`.
- The handoff declares the allowed write set. Everything else is read-only.
- Only the coordinator edits the master ledger, shared chart unions/registries, central export
  barrels during parallel work, root release versions/changelogs, and milestone status pages.
- Family agents add family-local modules. They request central registration in the handoff.
- Research agents write unique files in `research/agent-work/claude/`; they do not rewrite locked
  decisions or canonical implementation documents.

## Checkpoints and context limits

At every coherent checkpoint and before usage/context expires:

1. Run the narrow relevant test.
2. Update `research/handoffs/<task-id>.md` with current commit, files, decisions, exact command
   results, failures, remaining work, and exact resume command.
3. Commit code, tests, and handoff together.
4. Prefer a clean working tree. If an intentionally incomplete checkpoint is necessary, use a
   `WIP(<task-id>):` commit and name every known failure.

Do not use chat summaries, uncommitted files, or `git stash` as durable handoff state.

## Resume protocol

1. Read the governing files and handoff in the order above.
2. Reconstruct the task from Git:

```bash
git log --oneline <base-commit>..HEAD
git diff --stat <base-commit>...HEAD
git status --short
```

3. Confirm owner, branch, write scope, dependency state, and exact next action.
4. Re-run the handoff's smallest restart check.
5. Continue from the recorded checkpoint; do not restart from the task title.

If evidence cannot be reproduced, set the task to `rework` in the handoff and report the discrepancy.

## Build rules

- `@gx/core` stays pure, serialisable, DOM-free, and React-free.
- `@gx/primitives` stays hook-free and RSC-safe.
- `@gx/grid` owns outer layout geometry and never decides chart information content.
- CSS presentation uses the existing token system; do not add a second style framework.
- Preserve stable identity through resize, interaction, filtering, and layout migration.
- Inspect actual source/dependency APIs before implementation.
- Add negative, boundary, accessibility, and real-consumer proof where the task requires them.
- Update docs only for shipped behavior. Research and proposals are not implementation.

## Verification

Every implementation handoff includes task-specific checks, `git diff --check`, and changed paths.
The coordinator runs broader gates during integration. A release candidate must pass the complete
project verification, browser/RSC gates, packed-tarball consumer fixtures, and claim audit.

“Agent completed,” “code written,” and “should pass” are not verification evidence.

