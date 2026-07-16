---
name: claudify
description: Esta skill debe usarse cuando el usuario pide "documenta el modulo", "claudify", "generate module docs", "actualiza el CLAUDE.md de este modulo", "onboarding del modulo", "necesito un CLAUDE.md para X", o quiere crear/actualizar un CLAUDE.md a nivel de modulo. Corre como fork en background — no roba contexto a la sesion principal y devuelve solo un resumen de una linea. Genera documentacion token-efficient con referencias LSP-optimizadas (`file::Symbol`) enfocada en informacion no-obvia que ahorra al agente tener que inferirla del codigo.
argument-hint: <module-relative-path>
context: fork
agent: claude-management:module-documenter
---

# Claudify

You are documenting the module at `$1`. You run in a forked context with no conversation history — everything you need is in this prompt, in the reference files it points to, and on disk. Generate or update the module-level memory file yourself, end to end, and return a one-line summary.

## North Star

A module CLAUDE.md exists for one reason: **document what the agent cannot cheaply infer from the code itself.** Filenames, function signatures, type definitions, and call sites are already in the code — the agent will read them when needed. The CLAUDE.md should not narrate them.

What belongs in a module CLAUDE.md:

- The module's role in the larger system (not visible from inside the module)
- Business logic and decision rules that live in scattered conditionals
- Invariants the code assumes but does not assert
- Why a non-obvious architectural choice was made
- Side effects, ordering constraints, hidden coupling
- Failure modes and recovery patterns the agent would otherwise discover by breaking things

What does not belong:

- Restating function names with their signatures
- Listing every file with "this file does X" when the filename already says X
- Generic advice ("write good tests", "handle errors")
- Speculative "modification guides" with no concrete learning to share
- Boilerplate sections filled to satisfy the template

If a section would only contain inferable or generic content, **omit it**.

## Reference files (read on demand)

- `references/template.md` — the exact CLAUDE.md structure to produce, with section-by-section guidance on what counts as non-obvious. Read at Step 3.
- `references/style-rules.md` — token-efficiency rules, the `file::Symbol` LSP format, and the 150-line budget. Read at Step 3.

These paths are relative to this skill's own directory (the base directory announced when the skill loads), not to the project. If that resolution fails, glob for them under `~/.claude/plugins/**/claude-management/skills/claudify/references/` (installed plugin) or `**/claude-management/skills/claudify/references/` (repo checkout).

## Workflow

### Step 0: Validate the argument

Fail fast at the boundary: if `$1` is empty, or `$1/` does not exist as a directory (resolve it relative to the working directory — the project root), do not explore anything. Return a single line asking to be re-invoked with the module's relative path, e.g. `error: claudify needs an existing module path — re-invoke as /claudify <module-relative-path>`. With no conversation history there is nothing to recover the target from; guessing a module would be worse than stopping.

### Step 1: Resolve paths and convention

First, detect which memory-file convention the repo uses by inspecting the project root:

- **CLAUDE.md only** (no `AGENTS.md` at root): generate `$1/CLAUDE.md`. Single file, standard path.
- **AGENTS.md convention** (root has `AGENTS.md`, and root `CLAUDE.md` is essentially `@AGENTS.md`): generate **two** files at the module level.
  - `$1/AGENTS.md` — the actual content, written from the template.
  - `$1/CLAUDE.md` — a one-line file containing exactly `@AGENTS.md`.
  - Why both: Claude Code only auto-discovers `CLAUDE.md` in subdirectories, not `AGENTS.md`. The stub `CLAUDE.md` is what makes lazy loading work; the import pulls in the AGENTS.md content. Other agents read `AGENTS.md` directly.

Then check whether the target file (CLAUDE.md, or AGENTS.md under the AGENTS convention) already exists at `$1/`:

- If yes: keep its content as baseline (verify, update, fill gaps — do not start from scratch).
- If no: proceed with fresh exploration.

For the rest of the workflow, "memory file" refers to whichever target file the convention selected.

### Step 2: Explore the module yourself

Explore `$1` and its subdirectories directly with Glob, Read, Grep, and read-only Bash — never launch subagents. Include source, config, env vars, and tests (tests reveal patterns and invariants); exclude node_modules, vendor, dist, and build artifacts.

Operational guide: Glob the tree first to grasp the shape, identify the entry points, trace imports pointing OUT of the module (they reveal its role and dependencies), and read the tests for the invariants they pin down. Read files with intent — you are hunting the deliverables below, not building a full inventory.

Surface, focusing on what the code does NOT make obvious:

1. The module's role in the larger system (where does it sit, who calls it, what does it produce)
2. Entry points by symbol (`file::Symbol` format) — only the ones that matter, not every export
3. Key files whose role is non-obvious from the filename
4. Business logic, decision rules, and invariants that live across multiple files
5. Internal/external dependencies and WHY each is needed (not just "uses lodash")
6. Architectural choices that would surprise a new reader, with the reason
7. Side effects, ordering constraints, hidden coupling
8. Failure modes, recovery patterns, common pitfalls observed in the code or tests

For each finding, ask: "Could a fresh agent infer this in 30 seconds by reading the relevant file?" If yes, drop it. If no, it belongs in the memory file.

If a baseline exists (Step 1), verify each of its claims against the current code as you explore — carry forward what is still true, correct what drifted, and fill the gaps.

### Step 3: Read references and write

Read `references/template.md` for the structure and `references/style-rules.md` for formatting rules. Write the content to the target memory file determined in Step 1 (`$1/CLAUDE.md` under the CLAUDE.md convention; `$1/AGENTS.md` plus a one-line `$1/CLAUDE.md` containing `@AGENTS.md` under the AGENTS convention).

Critical rules from those references:

- 150-line budget. Past that, the file stops being read carefully.
- Omit any section that has no non-obvious content. Empty sections are noise.
- Use `file::Symbol` for LSP-resolvable references.
- Keep descriptions under 20 words. "Why" beats "what".

When updating an existing file, rebuild it from scratch using the template — do not patch in place. Patching tends to leave stale fragments. Carry forward only what is still true.

If the module is genuinely large and the most aggressive trimming still leaves the file over 200 lines, do NOT chain into other skills from this fork — recommend `rulify` (same plugin) in your summary instead. A 400-line CLAUDE.md does not document better than a 150-line one plus a handful of focused rules — it documents worse.

### Step 4: Report

Your final message is the deliverable the main session relays. One line:

```
created|updated <path> (<N> lines)
```

Append a rulify recommendation only if Step 3 triggered it. Nothing else — no findings dump, no exploration narrative.

## Final check before finishing

Before returning, ask yourself:

- Could each line in this file be replaced by reading the corresponding code in under 30 seconds? If yes, the line is bloat.
- Is there an invariant, side effect, or constraint that I noticed but did not write down? Add it.
- Is the file under 150 lines? If not, cut the most inferable content first.
