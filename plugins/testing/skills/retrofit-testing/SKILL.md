---
name: retrofit-testing
description: Esta skill debe usarse cuando el usuario pide "agrega tests a esto", "retrofit tests", "cubre este modulo con tests", "configura testing para X", "este codigo no tiene tests", "escribe tests para el paquete de pagos", "sube la cobertura aqui", "add tests to this", "cover this code with tests", o menciona poner codigo existente y no testeado bajo pruebas. Usala incluso si nunca dice la palabra "retrofit": cualquier peticion de poner codigo de produccion existente bajo tests debe activarla. Corre un pipeline autonomo de 6 fases (medir testabilidad, romper dependencias con seams, scaffolding de utilidades de test compartidas, escribir characterization + behavior tests, auditar calidad, y reconciliar el build completo como gate de mergeabilidad) aislado en un worktree dedicado, y devuelve el worktree para revisar y mergear solo si es realmente mergeable. No la uses para TDD test-first de codigo nuevo, ni para depurar un solo test que falla.
---

# Retrofit Testing Pipeline

This skill puts existing production code under tests. It is a RETROFIT workflow, not test-first TDD: the code already exists, so the goal is to capture and lock in its behavior (characterization tests), assert its intended behavior, and drive coverage up — while keeping the suite honest (tests that actually fail when behavior breaks, not just inflate coverage) and DRY (extracting reusable test utilities — data builders, helpers, custom assertions — instead of duplicating setup, and recording them so future tests reuse them).

The whole pipeline runs **autonomously inside a dedicated worktree**. There is exactly one human gate: the merge. If the worktree merges, the work is done and reviewed. You never stop mid-pipeline to ask the user — decisions like the coverage threshold are yours to make from the code's nature.

## Why a worktree

Phases 2 and 3 mutate production code (introducing seams) and add test files. Doing that on the user's working branch mixes unreviewed automated changes with their work. A dedicated worktree isolates everything; the diff at merge time is the review surface. This is why every sub-agent runs inside the worktree, not the parent checkout.

## The pipeline

Run these steps in order. Steps 1-4 are yours (the orchestrator); step 5 hands off to the Workflow that drives the six specialized sub-agents.

### Step 1 — Detect and scope

1. Determine the language (`go.mod`, `package.json`/`tsconfig.json`, `*.csproj`).
2. Check whether tests already exist. If they do, read a couple to identify the established pattern (framework, file naming, table-driven vs describe/it vs Fact/Theory, where doubles come from) so new tests match it. If none exist, the pipeline will recommend and set up dependencies.
3. Discover the concrete modules/files in scope. If the user named a target ("the payments package"), scope to it; otherwise scope to the directory they're working in. This list is the work-list you pass to the Workflow — do not pass the whole repo blindly.

### Step 2 — Enter the worktree

Create and enter a dedicated worktree under `.claude/worktrees/` (this path is gitignored). Use the `EnterWorktree` tool — do not `cd`. Name it for the target, e.g. `retrofit-testing-<module>`. Everything after this point happens inside it.

### Step 3 — Decide the coverage threshold

There is no universal number. Choose it from the code's risk and nature, and state your reasoning:

- Critical business logic (money, auth, data integrity): aim high (85-90%).
- Standard application logic: ~80%.
- Thin wrappers, glue, generated code, DTOs: lower or excluded entirely.

Read `references/coverage.md` for what to measure and what to exclude. The threshold is a parameter you pass to the Workflow; it is NOT asked of the user.

### Step 4 — Note whether dependencies are needed

If step 1 found no testing infrastructure, flag that the Workflow's first job is to recommend and set up dependencies (via `testing-deps-investigator`). If infrastructure exists, skip that.

### Step 5 — Launch the Workflow

Call the **Workflow** tool with the bundled script. This skill's instruction to call Workflow is the explicit opt-in; the pipeline must run deterministically (fan-out, loops, conditional adaptation), which is exactly what a Workflow gives you over prose orchestration.

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

Do NOT set `isolation: 'worktree'` on anything — you are already inside the dedicated worktree and want every sub-agent to operate in it, not spawn its own. The Workflow's agents inherit this worktree as their working directory.

The Workflow returns a structured summary whose FIRST fields are the merge verdict: `mergeable` (boolean), `buildPasses` and `suitePasses` (from the Build phase), `passedAll`, `modulesShort` (the modules that fell short on coverage/quality in their scoped run), and `residualErrors` (compile errors the Build phase could not fix without changing behavior). Then per-module coverage, test-quality score, rounds taken, any latent bugs the `test-implementer` surfaced, the shared test utilities scaffolded, and the path of the project testing rules it wrote.

### Step 6 — Hand off for merge

**Lead with the merge verdict, not the coverage number.** A green coverage figure is not the same as mergeable work: the result is only mergeable when every module met coverage AND test-quality in its scoped run, AND the whole-project build and full suite are green at the Build barrier. Read `mergeable` from the Workflow result and report it first:

- If `mergeable` is false, say so up front. List the `modulesShort` modules with what fell short (coverage below target, quality below 80), and — if `buildPasses`/`suitePasses` is false — the `residualErrors` from the Build phase. Do NOT present the worktree as "ready to merge"; present it as needing the listed fixes. Never let a buried `passedAll: false` or a broken build read as success.
- If `mergeable` is true, then report what was covered: final coverage and quality per module, the shared utilities created, any bugs found (with the expected-failure tests that document them), and the new testing rule.

The rule lives at `.claude/rules/testing.md` and is a **path-scoped** Claude Code rule — its frontmatter `paths` are scoped to this language's test files, so it loads on-demand whenever someone works on tests later (the convention this repo uses for `.claude/rules/`). Then present the worktree for review and merge. The merge is the user's sign-off — do not merge automatically.

## What the Workflow orchestrates

For reference, the six sub-agents and their phases (full logic in `workflow.js`):

| Phase | Agent | Role |
|-------|-------|------|
| Measure | `testability-auditor` | Score each module 1-10; flag those needing seams (< 7) |
| Prepare | `testing-deps-investigator` | Recommend/set up testing deps (once, if needed) |
| Prepare | `testing-code-adapter` | Introduce seams / break dependencies for flagged modules |
| Scaffold | `testing-scaffolder` | Build shared test utilities once across all modules (DRY cross-file) |
| Test | `test-implementer` | Write characterization + behavior tests per module, validate with a scoped run, report coverage |
| Test | `test-input-auditor` | Score test quality (mutation-thinking + smells + type-validity); request re-gen below threshold |
| Build | `test-implementer` (reconcile) | One pass at the quiescent barrier: whole-project build + full suite, fix cross-module compile errors — authoritative `buildPasses`/`suitePasses` |
| Document | `testing-rules-writer` | Write path-scoped `.claude/rules/testing.md` from the pipeline summary |

Why the phases are barriered: Measure and Prepare complete fully (all modules measured, then all seams introduced) so Scaffold can build shared utilities against the complete set of seam contracts. The Test phase runs implementers **concurrently**, each mutating only its own module — so a whole-project build there would fail on siblings' half-written files. The build gate therefore lives in a single **Build** pass after the Test barrier, the one quiescent point where compiling the whole project is meaningful; that pass also reconciles cross-module type errors and dedupes any stubs that slipped past Scaffold.

## References

- `references/coverage.md` — coverage tooling per language, what to measure/exclude, threshold guidance
- `references/anti-patterns.md` — the test anti-patterns the quality audit enforces
- `references/frontend-component-testing.md` — React component/hook seam model (vi.mock/props/providers/MSW), RTL patterns, and the snapshot trap; the agents switch to this mode automatically when a target is `.tsx`/`.jsx`
- `references/project-rules-template.md` — template for the testing rules written in the Document phase
