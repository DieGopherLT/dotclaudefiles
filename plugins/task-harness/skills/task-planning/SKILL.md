---
name: task-planning
description: >
  Turn an approved plan into a multi-session run: create a dedicated worktree, decompose the work
  into sessions of letter-group blocks sized by friction, open the binnacle that carries the run's
  state between sessions, and register only the current session's tasks with TaskCreate.
  Invoke it when the user, in any language, kicks off substantial implementation work — a request
  that touches 2+ files, involves 3+ sequential steps, executes an approved plan, or comes right
  after ExitPlanMode. When in doubt about whether the scope is large enough, invoke it — the
  overhead is small and the structure prevents skipped steps and messy commit history.
---

# Task Planning

You are about to begin substantial implementation work — usually executing a plan the user just
approved. This skill covers the preparation only: a dedicated worktree, a session plan that survives
context resets, and the current session's task list.

Execution then happens **in the main context** with your normal tools, guided by the binnacle's
execution conventions; only blocks marked `delegable` below fan out to sub-agents, and the
business logic never does. There is no execution skill: a substantial task does not fit one context
window, so the work is split into sessions — each one cut by `/clear` or chained in the same
window, as `log-binnacle` decides when it closes — and the binnacle (a sibling skill in this
plugin) is the durable state between them. Code review is not automatic either — the session plan always ends
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

Then group blocks into **sessions** — the unit of work between two `log-binnacle` closes. Size by
**friction**, an estimate of how much context a block will burn beyond its own diff. Score each
block with this rubric (count call sites before planning, not by feel):

| Block shape | Points |
|---|---|
| New file, nothing imports it yet | 1 |
| Edit confined to existing files, no exported signature change | 2 |
| Exported signature or contract change | 2 + 1 per call site |
| Nested dependency (the change forces a change that forces another) | 8 |

When a language server covers the project, load the `LSP` tool with `ToolSearch` and make it
your default way to navigate code for the rest of the run, not only for this count. It asks the
code for meaning instead of matching text: `findReferences` returns every call site with no false
hits from strings or comments, and `goToDefinition` and `hover` answer what a Grep-then-Read chain
would, faster and for a fraction of the tokens. Every token saved is budget the session keeps for
its blocks. Grep stays for text that is not a symbol: comments, strings, config.
Keep the references, not just their count: they become the block's file set in the next step.

Cap a session at **12 points**; cap Session 1 at **7**, because the planning conversation already
spent part of that window. A single block over 12 points is its own session; over 20, decompose it
further before planning. The reason for the ceiling: a session that ends by running out of context
cannot write its own closing entry. The caps hold even when sessions end up chained: chaining is
decided at close from measured figures, never assumed while planning.

The session plan always ends with **Sesión R — code review**: executed by the user, manually, in a
clean session. The run's last working session leaves `status: ready-for-review` in the binnacle;
it never runs the review itself.

## Mark each block: main context or delegable

Orchestration is a tactic inside a session, not a rival workflow: the binnacle, the plan, and the
business logic stay in the main context, and only mechanical blocks fan out. A delegated block
costs main-context tokens for its report alone, not its exploration or its diff — which is why it
protects the session budget — but it costs more total tokens and a review you cannot skip. Mark a
block `delegable` only when all four gates hold; one failure and it stays `main`:

1. **Exclusive file set.** The block's file set is the files it edits plus every file
   `findReferences` says it drags along. Two blocks in the same session may be delegated together
   only if their sets do not intersect. Record the set in the binnacle next to the block: a cold
   session re-checks this gate with `git diff --name-only <base_sha>..HEAD` against it, without
   running LSP again.
2. **Verifiable without reading the diff.** A command (tests, build, lint) whose output alone
   decides the block passed. If approving means reading the code, write it in the main context.
3. **Brief writable without the live context.** If the sub-agent needs the conversation explained
   to do the work, the block is not mechanical.
4. **Isolation pays for itself.** Delegate only when the work is large next to its brief: the
   same mechanical change over four or more files, a wide read that returns a short answer, or a
   command whose output would flood the window. A block of one or two files whose content is the
   work itself never qualifies — the brief costs what writing it costs, and the report and review
   come on top. Writing a single new file is never delegated.

The friction rubric already predicts most answers: a nested dependency never qualifies, a contract
change rarely does because its file set grows with every call site, and several 1-point files cut
from the same mold are the archetypal candidate. Delegated blocks of one session run in parallel
only when nothing in the session depends on them; the session cap counts their points as usual.

Dispatch and review follow the `subagent-dispatch` skill: a `DONE` verdict counts only when the
report carries the output of the gate-2 command.

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
- Tasks of a delegable block end their title with `[delegable]`, copied from the block's mark in
  *Bloques* — the mark lives in the binnacle, so any session registering from it carries it over.
- The final task of the session is always **`invoke log-binnacle`** — the explicit closing step
  that writes the session's entry and updates the binnacle's cursor.

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
- Does not register future sessions' tasks — each session registers its own from the binnacle,
  on a cold resume or a chained close
- Does not write code; execution starts after registration, in the main context
