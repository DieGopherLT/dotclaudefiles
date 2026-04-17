---
name: claudify
description: Esta skill debe usarse cuando el usuario pide "documenta el modulo", "claudify", "generate module docs", "actualiza el CLAUDE.md de este modulo", "onboarding del modulo", "necesito un CLAUDE.md para X", o quiere crear/actualizar un CLAUDE.md a nivel de modulo. Genera documentacion token-efficient con referencias LSP-optimizadas (`file::Symbol`) enfocada en informacion no-obvia que ahorra al agente tener que inferirla del codigo.
argument-hint: <module-relative-path>
model: sonnet
version: 1.0.0
---

# Claudify

Generate or update a module-level `CLAUDE.md` for the directory at `$1`.

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

- `references/template.md` — the exact CLAUDE.md structure to produce, with section-by-section guidance on what counts as non-obvious. Read at Step 2.
- `references/style-rules.md` — token-efficiency rules, the `file::Symbol` LSP format, and the 150-line budget. Read at Step 2.

## Workflow

### Step 0: Check for existing documentation

Try to read `$1/CLAUDE.md`.

- If it exists: keep its content as baseline for the explorer (verify, update, fill gaps — do not start from scratch).
- If it does not exist: proceed with fresh exploration.

### Step 1: Explore the module

Use the `Explore` subagent with "very thorough" depth. Pass this prompt (substitute `$1` and the existing content if any):

```
Context: Documenting module at path: $1
Objective: Surface non-obvious information for a token-efficient CLAUDE.md.

[If existing CLAUDE.md was found, include this section:]
Existing Documentation (baseline — verify, update, do not duplicate):
---
[paste the existing CLAUDE.md content here]
---

Scope:
  - Start: $1 and subdirectories
  - Include: source, config, env vars, tests (for understanding patterns)
  - Exclude: node_modules, vendor, dist, build artifacts

Deliverables — focus on what the code does NOT make obvious:
  1. Module's role in the larger system (where does it sit, who calls it, what does it produce)
  2. Entry points by symbol (file::Symbol format) — only the ones that matter, not every export
  3. Key files where the role is non-obvious from the filename
  4. Business logic, decision rules, and invariants that live across multiple files
  5. Internal/external dependencies and WHY each is needed (not just "uses lodash")
  6. Architectural choices that would surprise a new reader, with the reason
  7. Side effects, ordering constraints, hidden coupling
  8. Failure modes, recovery patterns, common pitfalls observed in the code or tests

For each finding, ask: "Could a fresh agent infer this in 30 seconds by reading the relevant file?"
If yes, drop it. If no, it belongs in the CLAUDE.md.

Depth: very thorough
```

### Step 2: Generate or update CLAUDE.md

Read `references/template.md` for the structure and `references/style-rules.md` for formatting rules. Write the file at `$1/CLAUDE.md`.

Critical rules from those references:

- 150-line budget. Past that, the file stops being read carefully.
- Omit any section that has no non-obvious content. Empty sections are noise.
- Use `file::Symbol` for LSP-resolvable references.
- Keep descriptions under 20 words. "Why" beats "what".

When updating an existing file, rebuild it from scratch using the template — do not patch in place. Patching tends to leave stale fragments. Carry forward only what is still true.

If the module is genuinely large and the most aggressive trimming still leaves the file over 200 lines, stop and recommend `rulify` (same plugin) to extract scope-specific or always-on content into `.claude/rules/`. A 400-line CLAUDE.md does not document better than a 150-line one plus a handful of focused rules — it documents worse.

### Step 3: Confirm

Report:

- Action: created / updated
- Path
- Final line count (and how it compares to the 150-line target)
- 2-3 non-obvious findings the new doc captures
- Anything intentionally omitted as inferable from code

## Final check before finishing

Before returning, ask yourself:

- Could each line in this file be replaced by reading the corresponding code in under 30 seconds? If yes, the line is bloat.
- Is there an invariant, side effect, or constraint that I noticed but did not write down? Add it.
- Is the file under 150 lines? If not, cut the most inferable content first.
