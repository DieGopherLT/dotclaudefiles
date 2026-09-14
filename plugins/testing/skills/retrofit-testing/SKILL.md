---
name: retrofit-testing
description: Esta skill debe usarse cuando el usuario pide "agrega tests a esto", "retrofit tests", "cubre este modulo con tests", "configura testing para X", "este codigo no tiene tests", "escribe tests para el paquete de pagos", "sube la cobertura aqui", "add tests to this", "cover this code with tests", o menciona poner codigo existente y no testeado bajo pruebas. Usala incluso si nunca dice la palabra "retrofit": cualquier peticion de poner codigo de produccion existente bajo tests debe activarla. Corre un pipeline autonomo de 6 fases (medir testabilidad, romper dependencias con seams, scaffolding de utilidades de test compartidas, escribir characterization + behavior tests, auditar calidad, y reconciliar el build completo como gate de mergeabilidad) aislado en un worktree dedicado, y devuelve el worktree para revisar y mergear solo si es realmente mergeable. No la uses para TDD test-first de codigo nuevo, ni para depurar un solo test que falla.
---

# Retrofit Testing Pipeline

Puts existing production code under tests, autonomously, inside a dedicated worktree. The only human gate is the merge: never stop mid-pipeline to ask the user. Decisions like the coverage threshold are yours to make from the code.

## The pipeline

Steps 1-4 are yours (the orchestrator); step 5 hands off to the Workflow that drives the specialized sub-agents.

### Step 1: Detect and scope

1. Determine the language (see the `language` enum below).
2. Check whether tests already exist. If they do, read a couple to identify the established pattern (framework, file naming, table-driven vs describe/it vs Fact/Theory, where doubles come from) so new tests match it.
3. Discover the concrete modules/files in scope. If the user named a target ("the payments package"), scope to it; otherwise scope to the directory they're working in. This list is the work-list you pass to the Workflow; do not pass the whole repo blindly.

### Step 2: Enter the worktree

Create and enter a dedicated worktree under `.claude/worktrees/` (gitignored) with the `EnterWorktree` tool, named for the target, e.g. `retrofit-testing-<module>`. Everything after this point happens inside it, and every sub-agent runs there, not in the parent checkout: the diff at merge time is the review surface.

### Step 3: Decide the coverage threshold

Pick it from the code's risk and state your reasoning: money/auth/data-integrity 0.85-0.90, standard logic 0.80, thin wrappers and DTOs excluded. See `references/coverage.md` for exclusions. It is a Workflow parameter, never asked of the user.

### Step 4: Note whether dependencies are needed

If step 1 found no testing infrastructure, flag it so the Workflow's first job is to have `testing-deps-investigator` recommend the testing dependencies (it recommends only; nothing is installed).

### Step 5: Launch the Workflow

Call the **Workflow** tool with the bundled script. This skill's instruction to call Workflow is the explicit opt-in.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/retrofit-testing/workflow.js",
  args: {
    modules: ["path/to/module_a", "path/to/module_b"],
    language: "go" | "typescript" | "csharp",
    threshold: 0.80,            // the number you chose in step 3 (fraction, not percent)
    needsDeps: true | false,    // from step 4
    existingPattern: "table-driven, black-box, testify"  // or null if none
  }
})
```

Do not set `isolation: 'worktree'` on anything: you are already inside the dedicated worktree and every sub-agent inherits it as its working directory.

The Workflow returns the merge verdict first (`mergeable`, `buildPasses`, `suitePasses`, `modulesShort`, `residualErrors`), then per-module detail. Field semantics live in the return block of `workflow.js`.

### Step 6: Hand off for merge

**Lead with `mergeable`, not coverage.** If false: list `modulesShort` with what fell short and, when the build or suite failed, the `residualErrors`. If true: report coverage and quality per module, the shared utilities, the bugs found with their expected-failure tests, and the new rule at `.claude/rules/testing.md` (path-scoped to this language's test files, so it loads on demand).

Then present the worktree for review and merge. The merge is the user's sign-off; do not merge automatically.

## What the Workflow orchestrates

Phases, agents and barrier rationale live in `workflow.js` (`meta.phases` and the phase comments). Read it if you need to debug a run.

## References

- `references/coverage.md`: threshold policy, what to exclude from the coverage denominator, prioritization
- `references/anti-patterns.md`: retrofit-specific test policy (bug pinning, coverage gaps)
- `references/frontend-component-testing.md`: React component/hook seam model (vi.mock/props/providers/MSW) and RTL conventions; the agents switch to this mode automatically when a target is `.tsx`/`.jsx`
- `references/project-rules-template.md`: template for the testing rule written in the Document phase
