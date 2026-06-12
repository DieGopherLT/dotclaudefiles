---
name: domain-restructure
description: Use this skill when the user asks to "restructure by domain", "group by feature", "apply screaming architecture", "reorganize the architecture", "move everything into modules per domain", "domain-driven folder structure", "my project is organized by layers and I want it by features", or mentions that their code is layer-first (controllers/, services/, models/ at the top) and wants the structure to scream the business. Also use it with the ultracode trigger for architectural restructuring. It runs a PURE STRUCTURAL refactor (zero functional change): it discovers domains via strategic DDD, classifies them core/supporting/generic, moves files into modules/<domain>/<layer>, and rewrites imports — all inside a dedicated worktree, closing with a single green commit. It is NOT for tactical modeling (entities, aggregates, events) — it only reorganizes where files live.
---

# Domain Restructure Skill

This skill restructures an existing project from a **layer-first** layout (top-level `controllers/`,
`services/`, `models/`, `routes/`, with files named by entity) into a **feature-first /
screaming-architecture** layout (`<targetConvention>/<domain>/<layer>`, where each domain is a
bounded context). After it runs, listing the module root reads like the business — `credits/`,
`mining/`, `newsletter/` — instead of an Express scaffold.

It is a **pure structural refactor**: it only moves files and rewrites import paths. It never changes
runtime behavior, and it never introduces or rewrites tactical-DDD constructs (entities, value
objects, aggregates, domain events, repositories). Those live inside file contents and would be a
functional change — strictly out of scope. The strategic half of DDD (bounded contexts, ubiquitous
language, subdomain distillation) is used only to decide **where files belong**.

The whole pipeline runs **autonomously inside a dedicated worktree**. There is exactly one human
gate: the merge. If the worktree merges, the work is done and reviewed. You never stop mid-pipeline to
ask the user — the decisions the pipeline makes (which cluster is a domain, whether a subdomain is
core/supporting/generic, where a shared file lands) are the agents' to make from the code itself, not
questions to bounce back. The only thing you hand back is a finished worktree and an honest merge
verdict.

## Why a worktree

The pipeline relocates files across the entire project and rewrites imports project-wide. Running
that on the user's working branch mixes unreviewed automated moves with their work, and a half-moved
tree does not compile. A dedicated worktree isolates everything; the final diff is the review
surface. Every sub-agent runs inside the worktree, not the parent checkout.

## Why a single commit

The project does not compile between the moment the movers start and the moment the consolidator
finishes — that window is unavoidable in a whole-tree restructure. So per-domain commits cannot be
bisectable. The atomic unit that compiles is "all moves + all import fixes", which is exactly one
green commit. That is what the pipeline produces and hands off.

## The pipeline

Run these steps in order. Steps 1–4 are yours (the orchestrator); step 5 hands off to the Workflow
that drives the six specialized sub-agents.

### Step 1 — Scope and validate

1. Identify the target: the user may name a project directory, pass a subdirectory to restrict the
   restructure, or assume the current working directory.
2. Confirm it is a code project with a recognizable layer structure (a `src/` or project root with
   technical-role directories like `controllers/`, `services/`, `models/`, `routes/`).
3. Confirm the project is under git with a clean-enough working tree — the pipeline relies on git's
   rename detection to preserve history, so uncommitted churn muddies the final diff.

### Step 2 — Enter the worktree

Create and enter a dedicated worktree under `.claude/worktrees/` (this path is gitignored). Use the
`EnterWorktree` tool — never `cd`. Name it for the project, e.g. `domain-restructure-<project-name>`.

Everything after this point happens inside the worktree.

### Step 3 — Confirm scope with the user (optional)

If the project is large (many top-level layer directories or hundreds of files), briefly summarize
what the auditor will discover and confirm the scope (whole code root vs a passed subdirectory)
before launching. For smaller projects, proceed directly.

### Step 4 — Capture the scope path

Note the optional subdirectory the user wants to restrict the restructure to (e.g. `src/api`). Pass
it to the Workflow as `scopePath`; pass `null` to restructure the whole detected code root.

### Step 5 — Launch the Workflow

Call the Workflow tool with the bundled script. This skill's instruction to call Workflow is the
explicit opt-in; the pipeline must run deterministically (sequential analysis phases, parallel
per-domain fan-outs with justified barriers, a single consolidation gate), which is exactly what a
Workflow gives you over prose orchestration.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/domain-restructure/workflow.js",
  args: {
    projectRoot: "<absolute path to the project inside the worktree>",
    scopePath: "<subdirectory to restrict the restructure, or null>"
  }
})
```

Do NOT set `isolation: 'worktree'` on anything — you are already inside the dedicated worktree and
want every sub-agent to operate in it, not spawn its own.

If the Workflow returns early with `currentAxis: 'feature-first'`, the project is already organized by
domain. Tell the user there is nothing to restructure and stop — do not force a move.

### Step 6 — Hand off for merge

Lead with the merge verdict, not the file count.

- If `mergeable` is false, say so up front. Report whether the build gate passed
  (`buildPasses`), whether the diff stayed a pure refactor (`diffIsPureRefactor`), the
  `residualErrors` that blocked a clean build, and any `behaviorChangeViolations` detected. Do not
  present the worktree as ready to merge.
- If `mergeable` is true, report: domains created (with their core/supporting/generic
  classification), files moved, cross-cutting imports fixed, and that the diff is a verified pure
  refactor. Then present the worktree for review and merge.

The merge is the user's sign-off — do not merge automatically. The user reviews the final diff, which
should show only file relocations and import-path edits.

## What the Workflow orchestrates

| Phase | Agent | Role |
|-------|-------|------|
| Contract | `contract-auditor` | Detect stack, layer taxonomy, current axis, target convention, import strategy, build gate |
| Scan | `domain-scanner` | Identify bounded contexts via ubiquitous language; flag low-confidence names |
| Group | `domain-grouper` (N parallel) | Bucket each domain's files by layer |
| Reconcile | `reconciler` | Classify subdomains, resolve shared/orphan/collision, emit path map + membership map |
| Move | `domain-mover` (N parallel) | `mv` files + fix intra-domain imports only |
| Consolidate | `consolidator` | `git add -A`, fix cross-cutting imports + barrels + config, build gate loop, assert pure refactor |

Why the phases are shaped this way: Contract must complete before Scan (the layer taxonomy frames the
grouping). Scan must complete before Group (the domains are what groupers fan out over). Group
barriers into Reconcile because reconciliation needs every domain's grouping at once to detect files
claimed by multiple domains, orphans, and collisions. Move barriers into Consolidate because the
consolidator needs the full set of moves and a quiescent tree before it fixes cross-cutting imports
and runs the whole-project build gate.
