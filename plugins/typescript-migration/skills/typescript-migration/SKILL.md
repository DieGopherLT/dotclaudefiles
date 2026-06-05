---
name: typescript-migration
description: Esta skill debe usarse cuando el usuario pide "migra este proyecto a TypeScript", "convierte de JS a TS", "agrega TypeScript a este proyecto", "migrate to TypeScript", "add types to this codebase", "quiero tipado estatico en este proyecto", o menciona querer convertir un proyecto JavaScript existente a TypeScript de forma incremental. Ejecuta un pipeline autonomo de 5 fases (auditar proyecto, instalar tooling y renombrar archivos, extraer tipos compartidos, tipar chunks en paralelo, consolidar con strict progresivo y gate de build final) aislado en un worktree dedicado. No la uses para proyectos nuevos iniciados directamente en TypeScript ni para agregar tipos a un solo archivo.
---

# TypeScript Migration Skill

This skill migrates an existing JavaScript project to TypeScript autonomously. It is a MIGRATION
workflow — the JS code already exists and works; the goal is to add type safety incrementally,
validate each step, and end with a project that compiles under strict mode (or the highest strict
level achievable without behavior changes).

The whole pipeline runs inside a dedicated worktree. There is exactly one human gate: the merge.

## Why a worktree

The pipeline installs packages, writes tsconfig files, renames files with `git mv`, and edits
type annotations across the entire project. Running this on the user's working branch mixes
unreviewed automated changes with their work. A dedicated worktree isolates everything; the diff
at merge time is the review surface. Every sub-agent runs inside the worktree, not the parent
checkout.

## The pipeline

Run these steps in order. Steps 1–4 are yours (the orchestrator); step 5 hands off to the
Workflow that drives the five specialized sub-agents.

### Step 1 — Scope and validate

1. Identify the target: the user may name a project directory or assume the current working directory.
2. Verify it is a JavaScript project: look for `package.json` and at least one `.js` or `.jsx` file
   under `src/` or the project root.
3. Check whether a `tsconfig.json` already exists. If TypeScript is already fully set up, tell the
   user and stop — this skill is for initial migrations, not ongoing type hardening.
4. Confirm the project has a package manager lockfile (`package-lock.json`, `yarn.lock`, or
   `pnpm-lock.yaml`). If not, warn the user before proceeding.

### Step 2 — Enter the worktree

Create and enter a dedicated worktree under `.claude/worktrees/` (this path is gitignored). Use
the `EnterWorktree` tool — never `cd`. Name it for the project, e.g. `ts-migration-<project-name>`.

Everything after this point happens inside the worktree.

### Step 3 — Confirm scope with the user (optional)

If the project has more than 50 JS files, briefly summarize what the auditor will discover and ask
whether to proceed. For smaller projects, proceed directly.

### Step 4 — Note the entry point

Read `package.json` to capture the `main`, `module`, or `scripts.start` entry point. Pass it to
the Workflow as context for the consolidator's final build check.

### Step 5 — Launch the Workflow

Call the Workflow tool with the bundled script. This skill's instruction to call Workflow is the
explicit opt-in; the pipeline must run deterministically (sequential phases, parallel chunks, strict
progression), which is exactly what a Workflow gives you over prose orchestration.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/typescript-migration/workflow.js",
  args: {
    projectRoot: "<absolute path to the project inside the worktree>",
    entryPoint: "<value of main/module from package.json, or null>"
  }
})
```

Do NOT set `isolation: 'worktree'` on anything — you are already inside the dedicated worktree
and want every sub-agent to operate in it, not spawn its own.

### Step 6 — Hand off for merge

Lead with the merge verdict, not the strict level reached.

- If `mergeable` is false, say so up front. Report the `strictLevelReached`, the `residualErrors`
  that blocked further progress, and what the user would need to fix manually to go further.
  Do not present the worktree as ready to merge.
- If `mergeable` is true, report: strict level reached, files migrated, shared types created,
  any cross-chunk errors resolved, and any `@types` packages installed. Then present the worktree
  for review and merge.

The merge is the user's sign-off — do not merge automatically.

## What the Workflow orchestrates

| Phase | Agent | Role |
|-------|-------|------|
| Audit | `migration-auditor` | Detect project type, map dep graph, plan chunks, select fixture |
| Setup | `migration-setup` | Install tooling, apply tsconfig, git mv all JS files, verify base compile |
| Extract | `shared-types-extractor` | Define cross-chunk interfaces in src/types/ before typers start |
| Type | `typer` (N parallel) | Add types to each chunk's files, scoped compile gate per chunk |
| Consolidate | `migration-consolidator` | Fix cross-chunk errors, enable strict progressively, final build gate |

Why phases are barriered: Audit must complete before Setup (fixture selection depends on it).
Setup must complete before Extract and Type (files must exist as .ts before they can be typed).
Extract must complete before Type (shared interfaces must exist before parallel typers import them).
Type must complete before Consolidate (all files must be typed before the whole-project build is meaningful).
