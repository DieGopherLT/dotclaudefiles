---
name: task-planning
description: >
  Turn an approved plan into a multi-session run: create a dedicated worktree, decompose the work
  into sessions of letter-group blocks sized by friction, open the binnacle that carries the run's
  state across /clear boundaries, and register only the current session's tasks with TaskCreate.
  Invoke this skill immediately when the user gives a substantial request — one that touches 2+
  files, involves 3+ sequential steps, requires executing an approved plan, or comes right after
  exiting plan mode with ExitPlanMode. Trigger on signals like "let's do it", "go ahead and
  implement", "execute the plan", "make it so", "start working", "implement this", or any
  multi-part request where the user is clearly kicking off real implementation work. When in doubt
  about whether the scope is large enough, invoke it — the overhead is small and the structure it
  provides prevents skipped steps and messy commit history.
---

# Task Planning

You are about to begin substantial implementation work — usually executing a plan the user just
approved. This skill covers the preparation only: a dedicated worktree, a session plan the run can
survive `/clear` with, and the current session's task list.

Execution then happens **in the main context** with your normal tools, guided by the binnacle's
execution conventions. There is no execution skill: a substantial task does not fit one context
window, so the work is split into sessions, and the binnacle (a sibling skill in this plugin) is
the durable state between them. Code review is not automatic either — the session plan always ends
with a review session the user runs manually.

## Before anything: is this a run, or just a plan?

Create nothing until this is settled. If the user asked only for a plan, or the breakdown
surfaces a question worth answering before any code is written, do the decomposition below and
present it — no worktree, no binnacle, no plan file written to disk. Proceed to the worktree only
once the user is executing.

## Always a worktree

Every run gets a dedicated worktree — no branch-vs-worktree decision. The binnacle lives at the
worktree root; in the main working tree it would be inherited by whatever branch checks out there
next, so if there is a binnacle, there is a worktree.

Decide what the work branches **from**, not just what it is called: the `base_sha` recorded in the
binnacle is what the review session diffs against, and a branch cut from the wrong place produces
a review full of someone else's changes. Invoke the `branching` skill to name and create the
worktree, then enter it with `EnterWorktree`.

## Decompose: blocks, then sessions

First divide the job into letter-group blocks, as always:

- Top-level blocks: A, B, C, ... — a block is a unit that makes sense to commit together.
- Subtasks: A1, A2, B1, ... — a concrete, observable action. If you cannot name the file a
  subtask touches, it is research, not a task: do the research now, then write the subtask.
- Include the steps that are easy to skip: documentation that reflects the change, version bumps,
  registering new components where the project's conventions require it, skills the user asked
  for explicitly.

Then group blocks into **sessions** — the unit that fits one context window. Size by **friction**,
an estimate of how much context a block will burn beyond its own diff. Score each block with this
rubric (count call sites with LSP or Grep before planning, not by feel):

| Block shape | Points |
|---|---|
| New file, nothing imports it yet | 1 |
| Edit confined to existing files, no exported signature change | 2 |
| Exported signature or contract change | 2 + 1 per call site |
| Nested dependency (the change forces a change that forces another) | 8 |

Cap a session at **12 points**; cap Session 1 at **7**, because the planning conversation already
spent part of that window. A single block over 12 points is its own session; over 20, decompose it
further before planning. The reason for the ceiling: a session that ends by running out of context
cannot write its own closing entry.

The session plan always ends with **Sesión R — code review**: executed by the user, manually, in a
clean session. The run's last working session leaves `status: ready-for-review` in the binnacle;
it never runs the review itself.

## Open the binnacle

Invoke the `binnacle` skill (opening) with the full decomposition and the approved plan's
location. It records the frontmatter — including `plan_path`, the path of the approved plan —
plus the session plan, the blocks, and the execution conventions every session follows. The
binnacle skill's *Resolving `plan_path`* recipe owns how that path is located, verified, or
materialized to disk — do not fill it from memory or restate that discipline here.

## Register the current session with TaskCreate

Register **only the current session's tasks**, not the whole run — the task list dies with the
conversation, and the binnacle is the durable copy of the full decomposition:

- Every entry carries its block code as the first token of the title (`A1: add X to Y`, `B2: ...`).
- The final task of the session is always **`invoke log-binnacle`** — the explicit closing step
  that writes the session's entry and updates the binnacle's cursor.

There is no `A0` base-ref task: the frozen merge-base SHA lives in the binnacle's frontmatter as
`base_sha`.

## Hand off

Once the binnacle is open and the session's tasks are registered, start executing the first block
in the main context. Planning does not need separate approval to proceed — the plan itself was the
decision point.

If the plan-only gate at the top of this skill applied, none of the side effects above exist —
present the sessions and blocks and wait.

## What this skill does NOT do

- Does not create tasks for single-file, single-step changes — just do them, no worktree, no
  binnacle
- Does not create tasks for research or exploration; tasks track actions with observable output
- Does not register future sessions' tasks — those are re-registered by the session that runs
  them, from the binnacle
- Does not write code; execution starts after registration, in the main context
