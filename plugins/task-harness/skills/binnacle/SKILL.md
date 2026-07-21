---
name: binnacle
description: >
  Open, maintain, and resume the durable log of a run that lives in a dedicated worktree: a
  .claude/binnacle.md file created from a bundled template, ignored through the repo's local
  exclude file, and rewritten at every task transition so a future session can restore the run
  after the conversation-scoped task list is gone. Invoke whenever a task-harness run enters a
  worktree — from task-planning, task-execution, or mastermind-role — whenever task transitions
  need mirroring into the durable log, and whenever a fresh session finds a binnacle in its
  worktree and must resume the run it describes.
---

# Binnacle

Task lists survive compaction but not the end of a session. For a run short enough to finish in
one sitting that is fine; for a run that lives in its own worktree it is not — the worktree is the
signal that the work is long or isolated enough to outlive a conversation. The binnacle is the
missing durable layer: one markdown file per worktree that a cold session reads to restore the
run. In pattern terms it is the run's memento — the externalized state snapshot that lets a later
holder restore what it never lived.

Both execution modes write it: an in-session task-planning + task-execution run and an
orchestrated mastermind-role run keep the same file, with the same structure. Only the entry point
a future session resumes through differs.

## Where it lives, and why it is never committed

- Path: `.claude/binnacle.md` at the root of the run's worktree. One worktree, one run, one file.
- Ignore it through the repo's local exclude file: append `.claude/binnacle.md` to
  `$(git rev-parse --git-common-dir)/info/exclude` when the line is absent. Never edit the tracked
  `.gitignore` for this — the exclude file is unversioned, applies to every worktree of the repo,
  and the line is written once for all future runs.
- Plain-branch runs (no dedicated worktree) do not get a binnacle: the path convention is
  per-worktree, and a run cheap enough to skip the worktree is cheap enough to rebuild from git.

## Opening

Copy `references/binnacle-template.md` (bundled with this skill) to `.claude/binnacle.md` and fill
the Run header — including **Resume with**, the entry point a future session uses to pick the run
up: `/mastermind-role` for orchestrated runs, `task-execution` for in-session runs. Seed the
Ledger table with the registered breakdown as it stands.

## Updating

Rewrite the affected rows on every task transition — at minimum at every group-boundary commit,
and on every dispatch, report, and block transition in orchestrated runs. Keep Contracts,
Decisions, and Open items current as they change, and stamp Last updated on every rewrite. The
rule is absolute because the file only works if it can be trusted cold: a binnacle that lags more
than one transition is a binnacle no future session can restore from.

## Resuming

When a session starts in a worktree that carries a binnacle:

1. Read it whole; trust its structure over any memory of the run.
2. Reconcile the Ledger against `git log <base ref>..HEAD --oneline` — commits are the ground
   truth, and the binnacle may lag one transition behind them.
3. Re-register the non-integrated tasks with `TaskCreate`, preserving group codes, states, and
   owners.
4. Continue through the entry point the Run header names in **Resume with**.

## Closing

A finished run leaves the binnacle in its final state: ledger fully integrated, open items empty
or explicitly handed back to the user. A closed run should read as closed; an interrupted one
carries the primer the next session resumes from.
