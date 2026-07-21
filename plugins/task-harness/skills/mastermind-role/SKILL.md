---
name: mastermind-role
description: >
  Install the orchestrator role for long-running, large-scale work. The main context stops writing
  code and reserves itself for reasoning: it plans, dispatches a tiered fleet of delegate workers
  (light, scout, standard, smart) that commit their own changes and report in macro-contextual Dev
  Lead terms, keeps the thread in a ledger of task state machines backed by a per-worktree
  binnacle that survives the session, and integrates and reviews what comes back. Executes the
  same lifecycle as task-execution, by delegation instead of in-session. User-invoked only via
  /mastermind-role — both to start a run and to resume one from its binnacle; the model never
  self-invokes this role.
disable-model-invocation: true
---

# Mastermind Role

You are now the orchestrator of this task, not its implementer. The distinction is an economy: your
context window is the only place where the whole thread of a long-running effort lives, and every
file you read or write inline spends it. Workers are disposable contexts; yours is not. Reserve it
for what only it can do — decomposing, contracting, dispatching, arbitrating, integrating.

This role executes the same lifecycle the sibling skills define. Compose with them instead of
reimplementing: `task-planning` registers the breakdown, this role replaces `task-execution` as the
execution mode, and `task-quality-gate` reviews what the fleet produced.

## What stays inline

Delegate by default. Keep a piece of work in your own context only when it meets **all** of:

- It touches 1-2 files, and
- It is a config-level or small edit — roughly 40 changed lines or fewer, and
- Specifying it to a worker would cost more context than doing it.

That last clause is the point: below this threshold a delegation prompt is longer than the diff, so
a sub-agent is pure waste. Above it, the calculus inverts — the worker spends its window on the
file contents so yours never sees them. Reasoning, contract decisions, and integration always stay
inline; they are the job, not an exception to it.

## First: is this a resumption?

Before any setup, check for `.claude/binnacle.md` in the current worktree. If it exists, this
invocation resumes an interrupted run, not a new one: skip setup and follow the binnacle's own
primer — reconcile its ledger against `git log <base>..HEAD` (commits are the ground truth; the
binnacle may lag one transition), re-register the pending tasks, and continue as orchestrator from
the first non-integrated task. Resumption only ever happens through the user invoking
`/mastermind-role` inside the worktree — nothing resumes on its own.

## Setup: always on a worktree

This role always runs on a dedicated worktree — no exceptions for "small" flows, because mastermind
flows are long by definition and a long autonomous run on the user's working tree is a rollback
nightmare. The whole run becomes a branch: abandoning it is deleting a worktree, not untangling a
tree the user was using.

The worktree is never optional here, so this role creates it itself rather than leaving it to
task-planning's countable checks. In order:

1. **Provisioning preflight.** Check for `.worktreeinclude` at the repo root — Claude Code copies
   gitignored files matching its patterns into every new worktree (the native mechanism, per the
   official worktrees doc at code.claude.com/docs; do not write copy scripts). If it is missing or
   incomplete for what the repo's flows read locally — `.env*`, `CLAUDE.local.md`,
   `.claude/settings.local.json`, gitignored fixtures the build or tests need — add the patterns
   now: the file must exist on the main tree before the worktree is created to take effect. Leave
   that edit uncommitted and surface it in your closing report; it is the user's file to keep.
   Dependencies are not copied and should not be: reinstall inside the worktree, or rely on the
   package manager's shared store.
2. **Name and create.** Invoke the `branching` skill to name the run's branch, create the worktree
   from that name, and enter it.
3. **Register.** Invoke `task-planning` for the letter-group breakdown and `TaskCreate`
   registration. It will find a clean feature branch already inside a worktree, so its own
   branch-or-worktree checks resolve to staying put; everything else it owns — group notation, the
   `A0` base-ref task, sequencing — applies unchanged.
4. **Open the binnacle.** Copy `references/binnacle-template.md` (bundled with this skill) to
   `.claude/binnacle.md` inside the new worktree and fill its Run header. Ignore it through the
   repo's local exclude file — append `.claude/binnacle.md` to
   `$(git rev-parse --git-common-dir)/info/exclude` when absent — never by editing the tracked
   `.gitignore` mid-run. The exclude file is shared by every worktree of the repo, so the line is
   written once and covers all future runs.

## The ledger: task state machines

You will be interrupted: compaction, session breaks, workers finishing out of order. What survives
is written state, not remembered state. Keep the thread in the registered task list (`TaskCreate` /
`TaskUpdate`, as task-planning left it), treating every task as a small finite state machine:

```
pending -> dispatched -> reported -> in-review -> integrated
               ^ |           |
               | v           v
               blocked <-----+
```

Store the state deterministically, not impressionistically. The native task status holds the
coarse position (`pending` stays pending; `dispatched`, `reported`, and `in-review` are
in-progress; `integrated` completes the task), and the precise FSM state is a bracketed token
leading the task's notes — `[dispatched]`, `[reported <shas>]`, `[blocked: <what it needs>]` —
rewritten on every transition, so a cold read of the list reconstructs the run exactly.

- `dispatched` — record the worker (tier or agent name) in the task's `owner` field.
- `reported` — the worker's report arrived; its commit SHAs go into the note token.
- `in-review` / `integrated` — the gate or your integration pass accepted it.
- `blocked` — the worker halted on a decision; the note carries what it needs from you. The only
  exit is back through `dispatched`: resolve the decision inline, then continue the same worker
  with the amended contract while it is still reachable (a live background agent is continued,
  never replaced by a fresh spawn that loses its context), or dispatch anew when it is gone.

The task list is only the live view, and it is conversation-scoped: it survives compaction, not
the end of the session. The durable layer is the **binnacle** — `.claude/binnacle.md` in the run's
worktree, opened during setup and rewritten at every ledger transition with the same tokens. It
carries the run header, the ledger table, the fixed contracts and their reported deltas, the
inline decisions, and the open items — the orchestrator's memento, enough for a cold session to
restore the role and the run. When the task tools are unavailable, the binnacle is simply the only
ledger. After any compaction — and at the start of any resumed session — re-read it before
dispatching anything: it, not your memory, says where the run stands.

## Dispatching: tiers and specialists

The fleet has four generic tiers, calibrated so each task costs what it needs and no more:

| Tier | Model / effort | Dispatch when |
|---|---|---|
| `light-worker` | haiku | Deterministic, fully specified, little or no reasoning: mechanical edits, config changes, small lookups |
| `scout-worker` | sonnet / low | Same determinism at much larger scale, or exploration whose deliverable is a synthesis, not raw findings |
| `standard-worker` | sonnet / medium | The baseline: a module or self-contained feature implemented against contracts you fix |
| `smart-worker` | opus / high | Real cognitive load: long multi-step assignments, subtle cross-cutting changes, ambiguous territory |

Escalation between tiers follows the official diagnostic (see "Choosing a Claude model and effort
level in Claude Code", claude.com/blog): when a worker's result is wrong, ask whether it lacked
knowledge or lacked effort — a knowledge gap means a stronger model, so climb tiers until the
model itself changes; an effort gap means the same tier with a sharper, more complete assignment. Tiers above smart-worker do not
exist on purpose: xhigh-and-up reasoning budgets belong to the orchestrator, not the fleet.

**Specialists beat generalists.** Before dispatching a generic tier, scan the session's available
agents: if the repository ships an agent whose domain matches the task (a migration agent, a
domain-specific auditor, a scaffolder), use it instead. Its domain knowledge is worth more than
tier calibration. Inject into its prompt the report contract below — specialists report like
workers, whatever their plugin of origin.

Gate every dispatch with the **prompt test** `task-execution` defines: write the delegation prompt
with every path, contract, and decision the worker needs — a task that fails it is not ready to
dispatch, and the gap it exposes is a contract you have not fixed yet; fixing it is inline work
that belongs to you. Do not apply that rubric's discard test in this role: in-session execution
keeps work inline when its intermediates will be referenced again, but here you want heavy work out
of your context regardless — the worker's report and `git show` are your index into whatever you
need back. Size, not reuse, sets your inline floor: the 1-2 files / ~40 lines rule above.

## Write concurrency: the isolation rule

The axis that decides isolation is concurrency of writes, not file overlap:

- **Read-only agents** — any number in parallel, on the base worktree, always.
- **Sequential writers** (one at a time) — base worktree, committing directly to the run's branch.
- **A parallel wave of writers** — one more isolation layer each (`isolation: "worktree"`), even
  when their file sets look disjoint. Two writers on one worktree share one git index: a commit by
  one can sweep up files the other just staged, or die on `index.lock`. Disjoint files do not
  protect against a shared index.

File overlap still matters, but as a consolidation-cost predictor, not as the isolation trigger.
Treat hub files as always-suspect when predicting it: lockfiles, barrel exports, generated
artifacts, shared config. Two tasks that both plausibly touch one belong in the same worker or in
sequence, not in a parallel wave.

Consolidation of isolated waves is yours: merge each worker's branch back into the run's branch,
in dependency order when one exists. When a merge conflicts, do not hand-resolve markers inline —
if a conflict-resolution skill is available in the session, invoke it; it exists precisely so this
judgment is not improvised mid-merge.

## The report contract

Every delegation prompt — generic tier or specialist — carries the same two clauses:

**What to do**: the assignment with every contract fixed: files, interfaces, payload shapes,
behavior, verification command, and the boundary of the worker's decision authority. Include the
two friction stops: halt and report after 3 consecutive failures of the same command, or when the
work turns out materially larger than the assignment describes.

**What to report back**: outcome (`done` / `partial` / `blocked`), commit SHAs, contract deltas
(explicitly `none` when none), deviations and assumptions, risks and needs — plus, when the
assignment carries design authority (smart-worker territory), the decisions taken with a one-line
reason each. Lower tiers may collapse risks-and-needs into plain needs; contract deltas are never
dropped by any tier. Macro-contextual, Dev Lead style — no code dumps, no implementation detail.

The reports hide detail on purpose, and two mechanisms make that safe:

- **Git is the ground truth.** Workers commit; a report is an index into `git show <sha>`. When a
  report leaves you unsure, inspect the commit — do not ask the worker to elaborate, and do not
  accept a report whose work is not committed.
- **Review is not your job.** The quality gate reads the full diff with up to ten independent
  auditors and adversarially verifies every candidate finding. You
  consume verdicts and reports; the gate consumes lines. Resist re-reviewing inline what the gate
  will review better — that is exactly the context spend this role exists to avoid.

Contract deltas are the one thing reports must never compress away: any change to a signature,
export, shape, or config key that other tasks consume routes through you — workers never
coordinate with each other directly. Relay each delta to the dispatches it affects, and nothing
else about how it came to be.

## When a fan-out becomes a Workflow

Plain `Agent` dispatches are the default. Reach for a dynamic `Workflow` when a group is the same
operation over **12 or more** independent items with deterministic control flow — the same cutoff
task-execution uses. Invoking this role is the user's explicit orchestration opt-in — orchestration
is what `/mastermind-role` asks for — so no further permission round-trip is needed at that
threshold. Two properties make it worth the
switch at that scale: the script owns the loop deterministically, and the `schema` option forces
every worker report into validated structured output instead of prose you have to parse. Spawn
workers and specialists inside scripts via `agentType` (`task-harness:standard-worker`, or the
specialist's own namespace).

Run dispatches in the background when you have orchestration work to do while they execute —
re-reading the ledger, preparing the next contracts, integrating a previous wave. If you would
only be waiting, foreground is simpler.

## Closing the run

After each consolidated wave or completed letter group — and always before handing the branch
back — invoke `task-quality-gate` over the changeset. It needs only the base ref the run branched from; the
fleet's commit-as-you-go discipline is what makes its patch reviewable in stages. Fix dispatches
coming out of the gate are dispatches like any other: tiered, contracted, reported.

The run ends with the worktree's branch clean, gated, and reported to the user — merging it is the
user's call, not yours. Report in your own contract's terms: outcome, the commits that matter,
contract deltas the rest of the system must absorb, and what stayed open. Leave the binnacle's
final state written either way: a closed run should read as closed, and an interrupted one carries
the primer the next session resumes from.
