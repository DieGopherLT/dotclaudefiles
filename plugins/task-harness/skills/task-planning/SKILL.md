---
name: task-planning
description: >
  Prepare substantial implementation work before any code is written: check git state, branch or enter
  a worktree, divide the job into letter groups with concrete subtasks, and register the whole breakdown
  with TaskCreate. Invoke this skill immediately when the user gives a substantial request — one that
  touches 2+ files, involves 3+ sequential steps, requires executing an approved plan, or comes right
  after exiting plan mode with ExitPlanMode. Trigger on signals like "let's do it", "go ahead and
  implement", "execute the plan", "make it so", "start working", "implement this", or any multi-part
  request where the user is clearly kicking off real implementation work. When in doubt about whether
  the scope is large enough, invoke it — the overhead is small and the structure it provides prevents
  skipped steps and messy commit history. This is the first of three chained skills: it hands off to
  task-execution, which hands off to task-quality-gate.
---

# Task Planning

You are about to begin substantial implementation work. This skill covers the preparation only. Leave
it with a clean place to work and a task list someone else could pick up cold.

Two skills follow it, and each is invocable on its own:

| Skill | Owns |
|---|---|
| **task-planning** (here) | Git state, branching, the letter-group breakdown, `TaskCreate` |
| `task-execution` | Working the groups, LSP-first navigation, commits per group |
| `task-quality-gate` | The multi-angle review of the finished changeset |

## Check git state before touching anything

Run `git status` and note two things: the current branch, and whether the tree is dirty. They drive two
separate decisions:

- **On a protected or shared branch** (`main`, `master`, `develop`, or whatever the project treats as
  shared) — always create a new branch or worktree for this work, clean tree or not. Never plan
  substantial work directly on a shared branch.
- **Tree already dirty with unrelated changes** — if the uncommitted files include non-trivial business
  logic (not just config, docs, or lockfiles) that does not belong to this task, isolate: branch or
  worktree so this work does not pile onto someone else's.
- **Already on a task-specific feature branch with a clean tree** — stay on it.

### Branch or worktree?

Do not judge "risk" — apply these checks in order; the first one that fires decides worktree, otherwise
a plain branch:

1. Run `${CLAUDE_PLUGIN_ROOT}/skills/task-planning/scripts/detect-concurrent-claudes.sh`. Output `yes` means another
   Claude session is active in this repository right now — a worktree is mandatory so the two do not
   share a working tree.
2. The breakdown you are about to write has **3 or more letter groups**.
3. The breakdown touches **more than 7 files**.

Checks 2 and 3 are evaluated once the breakdown exists: if you started on a plain branch and the
breakdown crosses either threshold, move to a worktree before any code is written.

Decide what the work branches **from**, not just what it is called. The base ref matters later:
`task-quality-gate` diffs against it, so a branch cut from the wrong place produces a review full of
someone else's changes.

Invoke the `branching` skill when a new branch or worktree is about to be created — it owns the naming
convention and proposes the name before any git command runs.

## Divide the work using letter-group notation

Top-level groups: A, B, C, D, ...
Subtasks within a group: A1, A2, A3, B1, B2, ...

A group is a unit that makes sense to commit together. A subtask is a concrete, observable action — not
"investigate X" but "add X to Y file". If you cannot name the file a subtask touches, it is research,
not a task: do the research now, then write the subtask.

Sequence the groups so each one leaves the tree in a state worth committing. When two groups could run
in either order, put first the one that unblocks the most of the rest.

Include the steps that are easy to skip:

- Updating `CLAUDE.md` or documentation that reflects the change
- Version bumps (`package.json`, `plugin.json`, and the like) when applicable
- Registering a new component wherever the project's conventions require it
- Invoking skills the user requested explicitly
- The quality gate itself — register it as its own subtask so it stays visible in the list

## Register the breakdown with TaskCreate

This is not optional for work at this scale. Call `TaskCreate` with every step from the breakdown. The
goal is a list auditable enough that someone could pick it up mid-way and know exactly where things
stand. The grouping is not a private note — it is the tracked artifact:

- **Every entry carries its group code as the first token of the title** (`A1: add X to Y`, `B2: ...`).
  The code is what lets `task-execution` find group boundaries for commits, and what lets a cold
  resumer reconstruct the sequence from a flat `TaskList`.
- **The first entry records the base ref**: register an `A0` task titled
  `A0: base ref = <branch> @ <merge-base SHA>` and mark it completed immediately. `task-quality-gate`
  reads it from `TaskList` to build the review patch; without it the gate has to guess the base.

Register the whole breakdown up front rather than group by group. A partial list hides the shape of the
work, which is the one thing this skill exists to expose.

## Hand off

When the run lives in a worktree, invoke the `binnacle` skill right after registration, recording
`task-execution` as its **Resume with** entry point: the task list is conversation-scoped, and the
binnacle is what a future session restores the breakdown from.

Once the breakdown is registered, invoke `task-execution` to work through it. Planning does not need
separate approval to proceed — the plan itself was the decision point.

Stop here instead when the user asked only for a plan, or when the breakdown surfaced a question worth
answering before any code is written. In that case, present the groups and wait.

## What this skill does NOT do

- Does not create tasks for single-file, single-step changes — just do them
- Does not create tasks for research or exploration; tasks track actions with observable output, not
  thinking
- Does not duplicate task information in memory — tasks are conversation-scoped and disposable
- Does not write code. Everything after the breakdown belongs to `task-execution`
