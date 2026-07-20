---
name: implement-spec
description: >
  Implement a closed spec file end-to-end, dispatching to the execution strategy that fits the work.
  Designed to run alongside the /goal command, which drives it non-stop until the spec is implemented,
  quality-reviewed, and verified to actually work. Acts as a pure dispatcher: it separates strategy
  selection from execution, choosing write-directly, agent-waves, or workflow based on scale and
  orchestration closure. Use after a spec's design is closed (via close-design) and the user wants it
  built. Trigger on "implement the spec", "build this spec", "execute the spec", or a /goal aimed at a
  spec file.
---

You are going to implement the requirements, constraints, guidelines, and acceptance criteria of the spec file: $ARGUMENTS. If no argument is present, ask the user for the spec file path or its content.

This skill usually runs alongside `/goal`, which is non-stop until the spec is implemented AND verified to work — so assume it will use a lot of tokens, and choose an execution strategy that respects that.

## Arguments

- `-w`: if received, create a dedicated worktree first via the `branching` skill, and do all work inside it.

## The shape of this skill: Template Method + Strategy

This skill is a **Template Method**: a fixed algorithm skeleton where only one step varies. The skeleton runs in the same order every time; only step 3 (Execute) is pluggable, swapped for one of three **Strategy** implementations. Steps 1, 2, 4, 5, and 6 are invariant — they run identically regardless of which strategy executes. This separation is the whole point: selecting a strategy and executing it are different concerns, and the quality gate and verification must not be duplicated inside each strategy.

| Step | Name | Role | Varies? |
|------|------|------|---------|
| 1 | Preconditions | Load spec, enable LSP, decompose into letter-group blocks + dependency graph | No |
| 2 | Select | Run the two-axis dispatch and log the chosen strategy + rationale | No |
| 3 | Execute | Run the chosen strategy | YES (Strategy) |
| 4 | Quality gate | Post-implementation quality suite | Location varies (see step 4) |
| 5 | Verify | Confirm the change actually works | No |
| 6 | Cleanup | Clean tree, changes on a dedicated branch | No |

## Step 1 — Preconditions

1. If `-w` was passed, create the worktree via `branching` and enter it before anything else. Otherwise ensure you are on a dedicated branch (never `main`/trunk); create one via `branching` if needed.
2. Read the full spec. Treat it as the single source of truth — it should be closed and self-contained by construction.
3. **Verify closure.** Check the spec's `## Design Gaps` section. If it still contains entries (any `DG-NNN`), the design is NOT closed — implementing now risks exactly the wrong-guess failure this plugin exists to prevent. Stop and tell the user to run `spec-kit:close-design` first, rather than proceeding on an open spec.
4. Load `LSP` if available; it makes navigating an existing codebase faster and more accurate than text search for code symbols.
5. Decompose the spec into letter-group task blocks (A, B, C... with numbered subtasks) and register every one of them with `TaskCreate`. Then derive the **dependency graph** between blocks — do not trust the letter ordering, which groups by topic, not execution order.

## Step 2 — Select the strategy (the dispatch)

Selection turns on two **orthogonal** axes. Do not use a single metric like block count — it conflates them.

### Axis 1 — Scale: does the work fit the context budget?

The target is to finish with the main agent's context under **~300k tokens** (a prior run that reached ~450k is the failure this guards against). Estimate scale from several signals together — projected token cost, fraction of repo files touched, and number of task blocks — never from one alone.

- **Fits the budget** → `write-directly`. No need to delegate.
- **Exceeds the budget** → you must delegate; go to Axis 2.

### Axis 2 — Orchestration closure: can the coordination be scripted up front?

This decides `agent-waves` vs `workflow`. The operational test:

> **"Can I write the entire orchestration script right now, without executing anything?"**

- **Yes** — every item is handled the same way and no routing decision depends on a prior item's output → **decision-closed** → `workflow`.
- **No** — deciding the next step requires reading what the previous step produced (a finding reorients the plan, a conflict needs reconciliation, a block's output reshapes the next) → **decision-open** → `agent-waves`.

The mechanicity that matters is at the level of **orchestration**, not the unit of work. A workflow can run intelligent per-item workers (typing one file is non-trivial) as long as the *coordination between them* is mechanical. The main agent's degree of control is a consequence: decision-closed coordination means nothing to judge mid-flight, so full delegation is safe.

Log the chosen strategy and a one-line rationale before executing.

## Step 3 — Execute (the pluggable strategy)

All three strategies share one contract: *given the decomposed spec and dependency graph, produce a verified implementation on a dedicated branch.* Commits follow the `commit` skill conventions, committed at task-group boundaries so each is bisectable.

### Strategy: write-directly

You, the main agent, write the code directly with little to no delegation (except the quality gate). Work the blocks in dependency order, marking tasks done via TaskUpdate as you go, and commit at group boundaries.

### Strategy: agent-waves

Heavy delegation; you stay in the loop, supervising, merging, and reconciling between waves. Prerequisites:

1. Order blocks by their **dependency graph**, not letter order — blocks with no upstream dependency run first.
2. Survey which specialized sub-agents exist in the session, so you can route each block to the most appropriate type.

Agent assignment is dynamic — not "one agent per task" nor "one per block". Split by cohesion and dependency: an agent may own one task while another covers the rest of a block, or a single agent may own a whole block if its tasks are tightly coupled. Prefer a project's specialized sub-agent over a general-purpose one.

Model selection per agent:
- **Opus** when the agent runs more than 3 tasks, or the work is inherently complex (cross-cutting wiring, multi-file integration, reconciliation).
- **Sonnet** otherwise.

Agents create their own commits following the `commit` skill conventions.

**When multiple agents must modify the same file** — pick one:
- Isolate each agent in its own worktree (`isolation: "worktree"`); when all finish, merge and resolve conflicts.
- Reorder tasks so the shared file is modified sequentially — one agent at a time, each building on the last.

### Strategy: workflow

Full delegation. Author the orchestration with the `workflow-creator` skill (use it as the framework — do not hand-roll the script), then launch it with the Workflow tool and supervise the aggregate result.

Two rules that make this work under `/goal`:

- **goal-uses-workflow-as-tool.** `/goal` is a main-loop construct; the Workflow tool runs its own background orchestration. They cannot nest. You do NOT apply `/goal` to the flow — the goal-driven agent (you) INVOKES Workflow as a tool and supervises it. Auto-launching the workflow under `/goal` is expected behavior; no separate authorization is required.
- **Bake the gate into the script.** Because a workflow runs detached in the background, you cannot run a coherent post-hoc quality gate over work you did not directly supervise. Encode the quality suite (step 4) as **terminal phases of the workflow script** so quality is enforced inside the run. Behavior verification (step 5) still happens with you, after the workflow returns.

## Step 4 — Quality gate

A post-implementation quality gate runs in every strategy; only its **location** differs:

- `write-directly` and `agent-waves`: run it as a post-execution step, here, yourself, over `git diff main..HEAD` — a multi-angle review of the changeset, `/security-review` (focused on entry/exit points of every flow touched), plus any domain auditors that apply. Resolve all findings.
- `workflow`: the gate already ran as the script's terminal phases (per step 3). Confirm those phases passed and their findings were resolved inside the run.

## Step 5 — Verify the change actually works

Do not rely on tests alone — they can be incomplete, wrong, or absent. When the project gives you a way to exercise the behavior, manually check what the changeset affects, in a way that fits the project:

- REST API: send requests to the affected endpoints with `curl` and check the responses. Inspect local databases directly if you need to confirm the data-layer effect (local environments only; check credentials if needed).
- Browser/client-side change: try the `chrome-devtools` MCP. If blocked by an authentication wall, you may stop, as long as the prior steps succeeded.

**Verification is not always possible.** Some projects offer no runnable entry point, no local environment, or simply no mechanism to exercise the change. Attempt verification whenever the project facilitates it — that is always preferable. But when it genuinely does not, do not force it or block on it: a complete, closed spec plus a passing quality gate is a sufficient bar to consider the work done. Prefer real verification when available; accept its absence when the project makes it infeasible, and say so plainly rather than claiming a check you could not run.

This step is yours whenever it is feasible, regardless of strategy — including after a workflow returns.

## Step 6 — Cleanup

- Leave the working tree clean of your changes' loose ends. If pre-existing files were already in the working tree before you started, do not touch them.
- If you worked in a worktree, its tree must be clean.
- Leave the changes on their dedicated branch for the user to review — do NOT merge into `main` or any trunk branch.

## Invariants (do not violate)

- **Dispatcher purity.** Selecting the strategy (step 2) and executing it (step 3) are separate. Never inline selection logic into a strategy.
- **Skeleton is fixed.** Steps 1, 2, 4, 5, 6 run identically across strategies. Only step 3 varies.
- **The gate always runs.** Its location moves (post-execution vs baked into the workflow), but it is never skipped.
- **Verification is always yours.** Step 5 is performed by you on the real system, never delegated and never skipped.
