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

Run `git status`. If the working tree shows non-trivial business logic files — not just config, docs,
or lockfiles — create a new branch or enter a worktree before doing anything else. Worktrees are
preferred when the changes are risky or need to be reviewed in isolation.

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
stand. The letter-group plan lives in your head; `TaskCreate` is what makes it visible and trackable.

Register the whole breakdown up front rather than group by group. A partial list hides the shape of the
work, which is the one thing this skill exists to expose.

## Hand off

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
