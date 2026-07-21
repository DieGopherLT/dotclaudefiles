# Binnacle: <task title>

> Durable session log of a mastermind run — the orchestrator's memento. Lives at
> `.claude/binnacle.md` inside the run's worktree, ignored via `.git/info/exclude`. Rewritten by
> the orchestrator at every ledger transition, so a cold read reconstructs the run exactly.
> To resume this run: open a session in this worktree and invoke `/mastermind-role`.

## Run

- Branch: <type/description>
- Worktree: <absolute path>
- Base ref: <branch> @ <merge-base SHA>
- Started: <ISO timestamp>
- Last updated: <ISO timestamp of the latest rewrite>

## Ledger

One row per task, mirroring the task list's FSM tokens. `Commits` carries the SHAs from the
worker's report; `Notes` carries what a `blocked` task needs.

| Task | State | Owner | Commits | Notes |
|---|---|---|---|---|
| A1: <title> | [integrated] | standard-worker | <sha> | |
| B1: <title> | [dispatched] | task-harness:smart-worker | | |
| B2: <title> | [blocked: <decision needed>] | scout-worker | | <what it needs from the orchestrator> |

## Contracts

The contracts this run dispatches against, and every delta workers reported back:

- <interface / payload shape / config key>: <current agreed state> — delta from <sha>, relayed to <affected tasks>

## Decisions

Inline decisions taken by the orchestrator, one line each, with the reason:

- <decision> — <why>

## Open items

- <blocked tasks, waves not yet consolidated, isolated worker worktrees pending merge, gate runs pending>

## Next session primer

You are resuming as the orchestrator of this run. Before dispatching anything:

1. Reconcile the Ledger above against `git log <base ref>..HEAD --oneline` — commits are the
   ground truth and the binnacle may lag by one transition; trust git where they disagree.
2. Re-register the non-integrated tasks with `TaskCreate`, preserving group codes, states, and
   owners (the task list did not survive the previous session; this file did).
3. Continue from the first non-integrated task, orchestrator posture unchanged: reasoning and
   integration inline, execution delegated.
