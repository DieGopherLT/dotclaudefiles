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
get skipped. If one exists but is stale, reconcile it with `TaskList` before starting.

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

Not every group belongs in the main context. Before starting one, place it:

| Run it | When | Cost of getting it wrong |
|---|---|---|
| **In the main context** | The work needs the context you have accumulated; decisions inside the group build on each other; the group touches few files and you will keep editing them afterwards | Delegating this loses the reasoning and produces code that does not fit what came before |
| **In a sub-agent** | The group is self-contained and specifiable in a prompt; or it is exploration whose intermediate reading would bloat your context and whose only valuable output is the conclusion | Doing it inline burns context on work you will never need again |
| **In a fan-out `Workflow`** | The group is the same operation repeated over many independent items — per file, per module, per endpoint — and the control flow is deterministic | Doing this serially wastes wall-clock; doing it with ad-hoc parallel agents loses the verification stage |

Three rules govern splitting into multiple agents, and they are the same rules as any concurrent system:

- **Read-only agents**: launch as many in parallel as the problem has distinct angles. No coordination
  needed.
- **Write agents**: never let two agents modify the same file. If the overlap is unavoidable, isolate
  each in its own worktree with `isolation: "worktree"` and consolidate afterwards.
- **Sequential dependency**: if agent B needs agent A's output, do not split. Run them in sequence or
  keep them as one agent.

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
resumable if the session ends here.

## When the plan turns out to be wrong

Plans meet the code and lose. When a group turns out bigger, differently shaped, or unnecessary:

- Update the task list to match reality — add, re-scope, or delete subtasks with `TaskUpdate`. A list
  that describes a plan nobody is following is worse than no list.
- Say what changed and why, once, when it happens. Do not silently do something other than what was
  registered.
- If the remaining scope has grown well past what was planned, stop and re-plan rather than improvising
  through it.

## Hand off

When every group is committed and the task list is clean, invoke `task-quality-gate` to review the
changeset.

Skip the gate only for genuinely trivial work — a single-file edit, a documentation-only change, a
config tweak, a mechanical rename. The gate's own first step is that judgment, so when in doubt, invoke
it and let it decide.
