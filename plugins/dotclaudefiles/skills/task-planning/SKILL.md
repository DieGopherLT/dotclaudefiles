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
- Quality-review skill invocations (`/code-review`, `/security-review`, domain auditors) — register each as its own subtask so Phase 3 is visible in the task list

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

**Commit as you go — not all at the end.**
When all subtasks in a letter group are done, invoke the `commit` skill. If atomicity favors it,
committing per subtask (A1, A2…) is valid instead of waiting for the whole group. The patch Phase 3
reviews must be built commit by commit throughout the session, not dumped in one shot right before
the review.

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

**If the changeset warrants a pass, run the full quality suite:**
1. Generate `git diff main..HEAD` as a patch file — this is the shared scope for every review in
   this phase. `main` here is the base branch the work diverged from; if the branch was cut from
   another ref, use that ref instead. The rest of this phase calls it the **base branch**.
2. Scan the available agents list for any with an auditing or review role — look for names or
   descriptions containing terms like `audit`, `review`, `check`, `inspector`, `validator`. Examples:
   `testability-auditor`, `concurrency-checker`, `test-input-auditor`. Identify every one that
   applies to the changeset's domain.
3. Run the reviews in this order:
   a. If any domain-specific auditors were identified in step 2, invoke them all in parallel first.
      Skip this step if none apply.

   b. Invoke `/code-review <effort>` — **without `--fix`** — and wait for it to finish. `code-review`
      spawns multiple internal agents depending on the effort level; running it alone avoids noise
      in the findings. The review only produces verified findings; applying them is delegated to
      sub-agents (see "Dispatching the findings" below). By this point the main agent has spent its
      context on the feature — applying fixes already specified by the verifiers is low-density work
      that contaminates it.

      Choose the effort with a two-step scheme, auditable and reproducible. The guiding question:
      *what does a false negative cost, and how much noise do I tolerate to avoid it?* `low`/`medium`
      optimize precision (few findings, all actionable); `high` through `max` widen coverage and
      accept uncertain findings — desirable when a miss is expensive.

      **Step 1 — the dominant criterion sets the base band (cost of a miss):**

      | What does a false negative cost? | Base band |
      |---|---|
      | Expensive: critical domain — payments, auth, persistence, concurrency, contracts others consume | `xhigh` |
      | Moderate: normal business logic, visible but contained error | `high` |
      | Cheap: internal, mechanical, reversible change with no new logic | `medium` |

      **Step 2 — yes/no modifiers of ±1 level** (bounded to the full ladder `low → max`):

      | Modifier | Effect |
      |---|---|
      | New logic with real decision density? | +1 |
      | No tests — the review is the only defense? | +1 |
      | Real coupling (many call sites of what changed)? | +1 |
      | Pure mechanical transformation (rename, move, config)? | −1 |
      | Domain auditors already covered this same patch? | −1 |

      `low` is reachable only from base `medium` plus a mitigator — rare by construction, and
      legitimate (a mechanical diff already covered by auditors). `max` only from base `xhigh` plus
      an aggravator. Declare the decision in the report: "base high, +1 no tests, −1 auditors → high".

      Anchors: a 30-file mass rename → base medium, −1 mechanical → `low`; one file in the
      payments flow with no tests → base xhigh, +1 → `max`. File count is explicitly a weak proxy —
      it never sets the band by itself. `ultra` is out of scope: it is user-triggered and billed,
      not automatable from this skill.

   c. Invoke `/security-review` only if the changeset touches an entry or exit barrier — user input
      handling, authentication, authorization, API boundaries, or external service calls. Skip it for
      purely internal changes where no trust boundary is crossed.

Domain auditors are additive; skipping them when none apply is correct. `/code-review` is always
present. `/security-review` is conditional on barrier exposure — omitting it for internal-only
changes is intentional, not an oversight.

**Dispatching the findings.**
After the review returns, the main agent only **arbitrates** — this is where its accumulated context
adds value:
1. Discard false positives using its knowledge of the changeset.
2. Split the remaining findings into **in-scope** (introduced by this changeset) and **pre-existing
   out-of-scope** (surfaced by the review but present before the branch).
3. Dispatch both groups as described below, then commit the applied in-scope fixes at the end via
   the `commit` skill, as in Phase 2.

**In-scope findings — parallel appliers on the current branch.**
Group findings so that no two write agents ever touch the same file, and prefer fewer agents with
more fixes each: the more fixes a single sub-agent can apply, the better. Dispatch the groups in
parallel with the Agent tool. Calibrate model + effort per finding — when one agent carries several,
calibrate to the heaviest finding in its group:

| Finding level | Model + effort |
|---|---|
| CONFIRMED with an explicit fix (missing guard, off-by-one, rename, existing helper) | `haiku` (no effort) |
| Bounded local fix requiring tactical judgment (restructure one function, call sites of one module) | `sonnet` + `low`/`medium` |
| Cross-cutting fix, PLAUSIBLE that requires investigating the trigger, or an altitude finding (design-level, above the line-by-line diff) | `opus` + `medium`/`high` — never `sonnet` + `max` as a substitute (cost crossover) |

Transversal escalator: a fix in a critical domain moves up one row even if it looks mechanical.

**Pre-existing out-of-scope findings — fire-and-forget dispatch.**
Never touch them on the current branch. Instead, dispatch them as background agents:
1. Collect the out-of-scope findings when the review step ends.
2. Group them by file/module so no two agents ever write the same files.
3. For each group, launch an implementer agent with the Agent tool using `isolation: "worktree"`
   and `run_in_background: true`. The fix must be based on the base branch, not on the current
   branch — the worktree is created from the current state, so the agent's first instruction is to
   switch to a fresh branch cut from the base branch (`git switch -c fix/<slug> <base-branch>`)
   before touching anything.
4. Each agent's prompt includes: the concrete finding(s) with location, the branch-from-base
   instruction above, the instruction to fix only that, verify (build/tests), and commit in its
   worktree with a `fix:` message; never push.
5. At the close of Phase 3, report the list of dispatched agents with their worktree/branch for later
   review and merge. Do not block the task's closure waiting for these agents.

**If trivial, skip Phase 3 entirely.**
The multi-agent overhead exceeds the benefit for small changes. The point of this phase is catching
real issues in real code, not checking boxes.

## What this skill does NOT do

- Does not create tasks for single-file, single-step changes
- Does not create tasks for research or exploration — tasks track actions with observable output,
  not thinking
- Does not duplicate task information in memory — tasks are conversation-scoped and disposable
