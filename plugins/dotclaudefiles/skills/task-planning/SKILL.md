---
name: task-planning
description: >
  Orchestrates the full planning and execution cycle for large, multi-step tasks.
  Invoke this skill immediately when the user gives a substantial request — one that touches 2+ files,
  involves 3+ sequential steps, requires executing an approved plan, or comes right after exiting plan
  mode with ExitPlanMode. Trigger on signals like "let's do it", "go ahead and implement", "execute the
  plan", "make it so", "start working", "implement this", or any multi-part request where the user is
  clearly kicking off real implementation work. When in doubt about whether the scope is large enough,
  invoke it — the overhead is small and the structure it provides prevents skipped steps and messy
  commit history.
---

# Task Planning

You are about to begin substantial implementation work. This skill keeps that work organized, commits
clean, and quality-reviewed. Run through the three phases below in order — each feeds into the next.

## Phase 1 — Preparation

**Pick a design lens first.**
Before dividing the work, invoke the matching skill to surface non-obvious constraints:

- `software-design-philosophy` — when designing module boundaries or APIs (information hiding,
  deep vs shallow modules)
- `pragmatic-programmer` — when choosing between architectural approaches (reversibility,
  tracer bullets, DRY)
- `domain-driven-design` — when modeling business domain concepts (entities, bounded contexts,
  ubiquitous language)
- `refactoring-patterns` — when the task IS a refactor with no new behavior; if you use this lens,
  never mix refactoring commits with feature commits in the same commit

If none of the lenses clearly fits, skip this step. The lenses exist to surface constraints, not to add
process overhead on straightforward tasks.

**Check git status before touching anything.**
If the working tree shows non-trivial business logic files (not just config, docs, or lockfiles),
create a new branch or enter a worktree before doing anything. Worktrees are preferred when changes
are risky or need to be reviewed in isolation.

**Divide the work using letter-group notation.**
Top-level groups: A, B, C, D, ...
Subtasks within a group: A1, A2, A3, B1, B2, ...

Each subtask must be a concrete, observable action — not "investigate X" but "add X to Y file".
Include steps that are easy to skip:
- Updating CLAUDE.md or documentation that reflects the change
- Version bumps (package.json, plugin.json, etc.) when applicable
- Invoking skills the user requested explicitly

**Register the breakdown with TaskCreate.**
This is not optional for work at this scale — call `TaskCreate` with every step from the letter-group
breakdown. The goal is a list auditable enough that someone could pick it up mid-way and know exactly
where things stand. The letter-group plan lives in your head; TaskCreate is what makes it visible and
trackable.

## Phase 2 — Execution

Work through the task groups in order.

**Lead with LSP for code navigation.**
The moment Phase 2 touches existing code, map the relevant symbols before editing anything. When the
target is a code symbol in TypeScript, JavaScript, Go, or Python, reach for `findReferences`,
`workspaceSymbol`, `goToDefinition`, `hover`, or `incomingCalls` — they resolve definitions, usages,
and call hierarchy more accurately than text search and keep the context window lean. Reserve Read for
full-file reads you actually need, and Grep for prose, comments, or config values.

One caveat: the LSP tool is loaded on demand and may not be available in a given session. Confirm it's
present before committing to an LSP-first plan — and if it isn't, fall back to Read/Grep rather than
stalling. Surface that fallback explicitly so the navigation strategy stays auditable.

**Commit at group boundaries.**
When all subtasks in a letter group are done (all A's, all B's), evaluate whether those changes form a
logical unit that a `git bisect` run could isolate. If yes, commit. Use the project's commit format —
typically `<type>: <description>` in under 96 characters, no body bullets, no emojis. A single commit
per group is the norm; only split if the group contains genuinely independent changes that shouldn't
travel together.

**Mark tasks done immediately.**
Call `TaskUpdate` as soon as a subtask finishes — not in batches at the end of a group. An accurate
task list mid-execution lets you or the user see real progress without asking.

## Phase 3 — Quality Review

This phase runs once, at the very end, after all implementation is committed.

**Before starting, verify all progress is committed.**
Nothing uncommitted should remain. If there are uncommitted changes, commit them or stash them first.

**Assess whether the changeset warrants a quality pass.**
This is a judgment call, not a checkbox:
- Warrants a pass: many files modified, new business logic introduced, cross-cutting changes, code
  where readability or duplication concerns are plausible
- Does not warrant a pass: single-file edit, documentation-only change, config tweak, trivial rename

**If the changeset warrants a pass, run the full quality suite in parallel:**
1. Generate `git diff main..HEAD` as a patch file — this is the shared scope for every review in
   this phase
2. Scan the available agents list for any with an auditing or review role — look for names or
   descriptions containing terms like `audit`, `review`, `check`, `inspector`, `validator`. Examples:
   `testability-auditor`, `security-review`, `concurrency-checker`, `test-input-auditor`. Identify
   every one that applies to the changeset's domain.
3. Invoke `simplify` (effort `xhigh`), `clean-code`, and every domain-specific auditor identified
   in step 2 **all in parallel** — each receives the same patch as context.

`simplify` and `clean-code` are always present; domain auditors are additive. Skipping either of the
two core passes leaves half the review undone. Domain auditors that do not apply to the changeset
(e.g. a concurrency auditor on a purely UI change) should be skipped — use judgment, not a checklist.

**If trivial, skip Phase 3 entirely.**
The multi-agent overhead exceeds the benefit for small changes. The point of this phase is catching
real issues in real code, not checking boxes.

## What this skill does NOT do

- Does not create tasks for single-file, single-step changes
- Does not create tasks for research or exploration — tasks track actions with observable output,
  not thinking
- Does not duplicate task information in memory — tasks are conversation-scoped and disposable
