---
name: task-execution
description: >
  Work through a registered letter-group breakdown: navigate with LSP before editing, decide per group
  whether the work belongs in the main context, in a sub-agent, or in a fan-out Workflow, commit at
  group boundaries, and mark tasks done as they finish. Invoke immediately after task-planning registers
  a breakdown, and invoke it on its own whenever the user wants to resume or continue work already
  registered with TaskCreate — "continue", "keep going", "resume the plan", "pick up where we left off",
  "work through the tasks", "next group". Also invoke when an approved plan already exists and the
  remaining work is execution rather than planning. This is the second of three chained skills: it
  follows task-planning and hands off to task-quality-gate.
---

# Task Execution

You have a registered breakdown. This skill is about turning it into commits without losing the thread.

If no breakdown exists yet, invoke `task-planning` first — executing an unregistered plan is how steps
get skipped. If one exists but is stale, reconcile it with `TaskList` before starting. And when the
session has no task list at all but the worktree carries a `.claude/binnacle.md`, invoke the
`binnacle` skill first: it restores the breakdown a previous session registered.

## Lead with LSP for code navigation

The moment execution touches existing code, map the relevant symbols before editing anything. When the
target is a code symbol in TypeScript, JavaScript, Go, or Python, reach for `findReferences`,
`workspaceSymbol`, `goToDefinition`, `hover`, or `incomingCalls` — they resolve definitions, usages, and
call hierarchy more accurately than text search and keep the context window lean. Reserve `Read` for
full-file reads you actually need, and `Grep` for prose, comments, or config values.

One caveat: the LSP tool is loaded on demand and may not be available in a given session. Confirm it is
present before committing to an LSP-first plan, and if it is not, fall back to `Read`/`Grep` rather than
stalling. Surface that fallback explicitly so the navigation strategy stays auditable.

## Decide where each group runs

Not every group belongs in the main context. Before starting one, place it — not by judging
whether it "needs your context" (a vague call two agents will make differently), but by running
two mechanical tests over each subtask in the group:

1. **The discard test.** Will anything this subtask produces along the way — files read, search
   results, logs — be referenced again by a later subtask or group? If no, its intermediate work
   is pure context cost inline, and it is a delegation candidate. (Official criterion: delegate
   "a side task [that] would flood your main conversation with search results, logs, or file
   contents you won't reference again".)
2. **The prompt test.** Try to write the delegation prompt right now, including every file path,
   contract, and decision the agent would need — a sub-agent receives only that prompt string,
   never your conversation. If you can write it with no gaps the agent would have to ask you
   about, the subtask is cold-specifiable. If writing it surfaces decisions that will only be
   made during execution, that is real context dependency — and an early warning of the same
   open decisions that later trip the friction stops below.

A subtask delegates only if it passes **both** tests. The group's mode then falls out mechanically:

| Subtask results | Mode |
|---|---|
| None pass | **Main context** — the decisions build on each other; delegating loses the reasoning and produces code that does not fit what came before |
| All pass | **Full delegation** — hand the whole group to one sub-agent, or split it across several per the splitting rules below; you verify the result and commit |
| Mixed | **Partial delegation** — delegate the subtasks that pass (exploration, self-contained leaf edits), keep the integration and decision subtasks inline |
| All pass, and the group is the same operation repeated over **12 or more** independent items with deterministic control flow | **Fan-out `Workflow`** — evaluate this before settling for plain sub-agents: it is the most specific match. Below 12 items, dispatch parallel sub-agents per the splitting rules instead — no orchestration opt-in needed at that scale |

A well-planned group tends to pass the prompt test — `task-planning` already fixed its files and
contracts. A group that fails it is telling you the plan left decisions open.

Three rules govern splitting into multiple agents, and they are the same rules as any concurrent system:

- **Read-only agents**: launch as many in parallel as the problem has distinct angles. No coordination
  needed.
- **Write agents**: never let two agents modify the same file. If the overlap is unavoidable, isolate
  each in its own worktree with `isolation: "worktree"` and consolidate afterwards.
- **Sequential dependency**: if agent B needs agent A's output, do not split. Run them in sequence or
  keep them as one agent.

These rules refine *how* a full or partial delegation dispatches — they do not add a mode. Full
delegation defaults to a single agent; split into parallel agents only when the subtasks target
non-overlapping files and carry no sequential dependency.

Default to foreground. Use background only when you have something else to do while waiting; if you
would just be waiting, foreground is simpler and the result arrives in the same place.

A `Workflow` needs the user to have opted into multi-agent orchestration. If they have not, and a group
genuinely calls for that scale, say so and offer it rather than reaching for it silently.

## Commit as you go — not all at the end

When all subtasks in a letter group are done, invoke the `commit` skill. If atomicity favors it,
committing per subtask (A1, A2, ...) is valid instead of waiting for the whole group.

This matters beyond tidiness: the patch the quality gate reviews is built commit by commit throughout
the session. A changeset dumped in one shot right before the review is one nobody — including you — has
seen in stages.

You are executing an already-approved plan, so the `commit` skill's orchestrated-context path applies:
commit directly and report the message and hash, without pausing for per-commit approval.

## Mark tasks done immediately

Call `TaskUpdate` as soon as a subtask finishes — not in batches at the end of a group. An accurate task
list mid-execution lets you or the user see real progress without asking, and it is what makes the work
resumable if the session ends here. When the run carries a binnacle (worktree runs do), mirror these
transitions into it at group boundaries per the `binnacle` skill's update rule — the task list dies with
the conversation; the binnacle is what outlives it.

Delegation shows up in the task list too, through the `owner` field:

- **Full delegation**: when dispatching a group, instruct the agent to claim its tasks
  (`TaskUpdate` with `owner`) and mark them completed itself. Progress then surfaces live
  without you transcribing it.
- **Partial delegation**: delegated subtasks carry the sub-agent's owner; integration subtasks
  stay unowned — yours. The list becomes the visible record of which mode each group ran in.

One caveat: an agent can only self-report if its tool list includes the task tools. When you
delegate to a restricted agent (say, read-only), keep marking its tasks yourself.

## When the plan turns out to be wrong

Plans meet the code and lose. When a group turns out bigger, differently shaped, or unnecessary:

- Update the task list to match reality — add, re-scope, or delete subtasks with `TaskUpdate`. A list
  that describes a plan nobody is following is worse than no list.
- Say what changed and why, once, when it happens. Do not silently do something other than what was
  registered.
- Unplanned friction is a planning failure, not something to improvise through. **Stop the turn and
  report to the user** when either countable condition fires within a single group:
  1. The same command or gate fails 3 consecutive times without progress.
  2. The unplanned subtasks added to the group (via `TaskUpdate`) outnumber the subtasks it was
     registered with.
  Stopping means ending the turn with a summary of what fired and what the options are — not silently
  re-planning, not pushing through. Smaller drift stays inside the `TaskUpdate` adjustments above.

Delegation does not exempt a group from these stops. When a group runs under full or partial
delegation, carry both countable conditions verbatim into the delegation prompt and instruct the
agent to halt and return a structured report the moment either fires, instead of pushing through.
On return, treat that report as if the condition had fired inline: end the turn and surface it.

## Hand off

When every group is committed and the task list is clean, invoke `task-quality-gate` to review the
changeset.

Skip the gate only for genuinely trivial work — a single-file edit, a documentation-only change, a
config tweak, a mechanical rename. The gate's own first step is that judgment, so when in doubt, invoke
it and let it decide.
