---
name: resume-from-binnacle
description: >
  User-invoked shortcut to resume a multi-session run from its binnacle: locates
  .claude/binnacle.md at the current worktree root, delegates to the binnacle skill's resume
  procedure (status gate, bounded Read, git reconciliation, task re-registration), optionally
  warms context with read-only explorers when the latest entry points at code it does not
  explain, and continues the work. Invoked manually as /resume-from-binnacle at the start of a
  cold session, to avoid retyping the resume prompt every time.
disable-model-invocation: true
---

# Resume from binnacle

You were invoked at the start of a cold session to pick up a multi-session run. This skill adds
nothing to the resume contract — it is the deterministic entry point that saves the user from
retyping the same prompt. The procedure itself belongs to the `binnacle` skill; never reimplement
it here.

## Steps

1. **Locate.** Check for `.claude/binnacle.md` at the root of the current worktree. If it does
   not exist, stop with a clear message: this session is not inside a run's worktree. Do not
   search other worktrees, and do not create a binnacle — opening is task-planning's job.
2. **Delegate.** Invoke the `binnacle` skill and execute its resume procedure exactly as written:
   the status gate decides first (a `ready-for-review` or `done` run registers no tasks and
   writes no code), then the bounded `Read`, the reconciliation against git, the recovery branch
   when the previous session died without closing, and the re-registration of the current
   session's tasks.
3. **Warm context, only if needed.** After the bounded read, check the latest entry's
   **Siguiente** and **Referencias**: if they point at code this session must understand and the
   entry does not explain it, launch read-only Explore agents in parallel — one per distinct
   area — and fold their conclusions into your working context. A well-written entry needs zero
   explorers; the default is none, and launching them for code the entry already explains wastes
   the budget the binnacle exists to protect.
4. **Continue.** Start working the first pending task of the session in the main context, under
   the binnacle's *Convenciones de ejecución*.
