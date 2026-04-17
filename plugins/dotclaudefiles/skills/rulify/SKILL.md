---
name: rulify
description: Esta skill debe usarse cuando el usuario pide "aligerar el CLAUDE.md", "dividir el CLAUDE.md", "extraer reglas a .claude/rules", "rulify", "claudemd splitter", "convertir secciones del CLAUDE.md en rules bajo demanda", o menciona que su CLAUDE.md crecio demasiado, supera las 200 lineas, o quiere migrar a carga contextual con globs. Divide un CLAUDE.md monolitico en archivos `.claude/rules/*.md` cargados bajo demanda via frontmatter `paths`, fusionando con reglas existentes y dejando el CLAUDE.md base con solo informacion que aplica a todo el proyecto.
version: 1.0.0
---

# Rulify

Split a heavy CLAUDE.md into Claude Code's official `.claude/rules/*.md` files, loaded on demand via the `paths` frontmatter.

## Why this matters

This is not just about token cost — it is primarily about **adherence**. A focused memory file is followed; a sprawling one is skimmed. When a CLAUDE.md mixes repository orientation with language style, framework patterns, git workflow, and testing rules, the model treats the whole file as background noise and compliance drops on every rule inside it.

Concentration sweet spots:

- **Rule file**: 100-150 lines. Past that, split by sub-topic.
- **Base CLAUDE.md**: 200 lines maximum (official ceiling). Treat 150 as the real target.

This repository is itself a worked example: the base CLAUDE.md is ~150 lines of project-wide context, while `.claude/rules/plugins/use-plugin-dev.md` is what made you invoke `/skill-creator` just now. The rule loaded because the work touched plugin development — proof that focused, on-demand rules drive behavior precisely because they are not buried.

## Reference files (read on demand)

- `references/claude-code-memory-spec.md` — official Claude Code memory/rules spec: loading order, frontmatter syntax, `@` imports, compaction behavior. Consult when you need exact format or hit an edge case.
- `references/rules-best-practices.md` — sweet-spot sizes, classification buckets (project-wide / scoped / always-on), path glob heuristics, merge strategy, anti-patterns. Consult during planning and merging.
- `references/example-patterns.md` — five archetypes of high-value extractable rules (workflow-enforcing, trigger-table, language guide, always-on standard, high-stakes single-action reminder) with shapes and decision tree. Consult when classifying CLAUDE.md sections.
- `references/memory-currency-rule.md` — the literal payload for the memory-currency rule that Step 0 bootstraps into the target project. Read at Step 0.

Read these when planning extractions or whenever a frontmatter / loading detail is non-obvious. The workflow below covers the common path.

## Workflow

### 0. Bootstrap the memory-currency rule

Before anything else, ensure the target project has a path-scoped rule that keeps every `CLAUDE.md` and `AGENTS.md` honest.

- Check whether `<project>/.claude/rules/memory/keep-current.md` exists.
- If it does, leave it alone — the user owns it.
- If it does not, create the directory and write the file using the exact content in `references/memory-currency-rule.md`.

This is idempotent and runs on every rulify invocation. Mention the bootstrap (created or skipped) in the Step 7 report. Why this is Step 0: the rest of rulify shrinks CLAUDE.md by moving content into rules, which means the agent will be reading and editing memory files more often — the currency rule must already be in place when that starts happening.

### 1. Locate the target

- If `$ARGUMENTS` is a path, use it.
- Otherwise look for `CLAUDE.md` in the current working directory.
- If absent, ask the user where it lives.

Detect the rules directory: `.claude/rules/` relative to the CLAUDE.md's directory. Create it if missing.

If the CLAUDE.md is a symlink (common with stow-managed dotfiles), edit the source file in the dotfiles repo, not the symlink target. Detect with `readlink`.

#### AGENTS.md convention check

Some repos use `AGENTS.md` as the canonical multi-agent instructions file, with `CLAUDE.md` reduced to `@AGENTS.md` (plus optional Claude-specific additions below). Claude Code reads `CLAUDE.md` and follows the import.

If you find:

- A sibling `AGENTS.md`, AND
- The `CLAUDE.md` is essentially just `@AGENTS.md` (with at most a small Claude-specific tail)

Then **treat `AGENTS.md` as the primary rulify target**. Splitting a 5-line CLAUDE.md that just imports does nothing; the bulk lives in AGENTS.md. The Claude-specific tail (if any) stays in CLAUDE.md untouched.

The memory-currency rule from Step 0 already covers `**/AGENTS.md`, so no extra setup needed. Mention in the Step 7 report which file was treated as primary.

### 2. Inventory existing rules

Read every existing file under `.claude/rules/` recursively. Capture:

- File path
- Frontmatter `paths` (if any)
- Section headings and topics covered
- Current line count — flag any rule already over 150 lines as a split candidate

This inventory drives deduplication. Never re-extract content that already lives in a rule.

### 3. Classify CLAUDE.md content

Read the CLAUDE.md, segment by top-level sections, and assign each to one of three buckets:

| Bucket | Stays where? | Examples |
|---|---|---|
| **Project-wide** | Base CLAUDE.md | Repo overview, directory map, build/test commands, module descriptions |
| **Scope-specific** | New/merged rule with `paths` | Language conventions, framework patterns, file-type-tied workflows |
| **Always-on rule** | New/merged rule without `paths` | Cross-cutting standards (naming, error handling, logging, control flow) |

Aggressive default: extract anything that *can* be scoped or that adds bulk without being read every turn. The base CLAUDE.md should orient a reader in 30 seconds.

For full bucket criteria and category structure, see `references/rules-best-practices.md`.

### 4. Plan the extraction

For each section flagged for extraction:

- **Target file**: existing rule to merge into, or new path under `.claude/rules/<category>/<topic>.md`.
- **Paths globs** (if scoped): infer from content using the heuristics table in `references/rules-best-practices.md`. Prefer narrow globs.
- **Size projection**: if the resulting rule would exceed ~150 lines, split it into siblings under a subdirectory before writing.
- **Merge strategy** when target exists: see `references/rules-best-practices.md` ("Merge strategy when target rule already exists").

Produce a plan as a table: `Section → Target file → paths → Action (create / merge / split / skip) → Projected line count`.

### 5. Confirm before writing

Use `AskUserQuestion` when there are non-obvious choices:

- Ambiguous category placement
- Conflicts with existing rules (overlapping headings with different content)
- Sections that could go either way (project-wide vs scope)
- Widening an existing rule's `paths`

For trivial extractions, proceed without asking. Always confirm before deleting content from CLAUDE.md.

### 6. Apply

For each planned action:

- **Create**: write the new rule file. Frontmatter only if scoped (omit `---` entirely for always-on). Promote `##` from CLAUDE.md to `#` as the rule's top heading.
- **Merge**: edit the existing rule. Preserve frontmatter unless `paths` widening was confirmed. Insert in topical order.
- **Split**: when a rule grows past 150 lines, break into siblings under a subdirectory and remove the original.
- **Slim CLAUDE.md**: remove the extracted sections. Do **not** leave "see `.claude/rules/X.md`" pointers — the rules system handles discovery automatically, and pointers re-add the noise rulify is removing.

After all writes, verify CLAUDE.md ≤ 200 lines (target 150). If still over, recurse: re-classify what remains and extract more.

### 7. Report

- CLAUDE.md: before → after line count (and distance from 150-line target)
- Files created: path, `paths` globs, line count
- Files merged: which sections were added, new line count
- Files split: which rule was broken up, into what
- Conflicts surfaced and how resolved
- Sections deliberately kept in CLAUDE.md and why

## Quick frontmatter reference

Scoped rule:

```yaml
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Standards

[content]
```

Always-on rule: omit frontmatter entirely. Do not write empty `---\n---` blocks.

For the full spec (brace expansion, multi-pattern, edge cases), see `references/claude-code-memory-spec.md`.

## Edge cases

- **Symlinked CLAUDE.md**: edit the source, not the symlink target.
- **Multiple CLAUDE.md files**: subdirectory CLAUDE.md files load lazily by directory already. Rulify each independently.
- **`@path` imports**: `@` expands eagerly at launch — imports do not save context the way rules do. Treat each imported file as a candidate for rulification.
- **Existing rule already over 150 lines**: flag during inventory and offer to split it as part of the same pass — adherence on a 300-line rule is no better than on a bloated CLAUDE.md.
