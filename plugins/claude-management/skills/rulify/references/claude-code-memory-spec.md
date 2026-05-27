# Claude Code Memory Spec (Reference)

Source: https://code.claude.com/docs/en/memory

This file captures the parts of the official spec that rulify depends on. Read it when you need exact frontmatter syntax, loading order, or edge cases.

## Loading order

Claude Code walks up the directory tree from the working directory, reading every `CLAUDE.md` and `CLAUDE.local.md` along the way. All discovered files are **concatenated** into context (not overridden). Within each directory, `CLAUDE.local.md` is appended after `CLAUDE.md`.

Subdirectory `CLAUDE.md` files are **not loaded at launch**. They load lazily when Claude reads a file in that subdirectory. This is one of the reasons rulify works — extracted scope-specific content can also live in nested CLAUDE.md or in path-scoped rules.

Block-level HTML comments (`<!-- ... -->`) in CLAUDE.md are stripped before injection. Comments inside fenced code blocks are preserved.

## Size guidance (official)

> **Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence.

This 200-line target is the official ceiling. Rulify treats 150 as the practical sweet spot for both CLAUDE.md and individual rule files (see `rules-best-practices.md`).

## Imports (`@path/to/file`)

CLAUDE.md can pull in other files with `@` syntax:

```text
See @README for project overview and @package.json for available npm commands.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

Behavior:

- Both relative and absolute paths allowed.
- Relative paths resolve relative to the file containing the import (not the working directory).
- Recursive imports allowed, max depth 5 hops.
- Imports expand **eagerly** at launch — they cost context every session, just like inline content. Imports do not give you on-demand loading. For that, use `.claude/rules/` with `paths`.

## `.claude/rules/` directory

Drop markdown files in `.claude/rules/`. All `.md` files are discovered recursively, including subdirectories like `frontend/` or `backend/`. Symlinks are supported.

```text
your-project/
├── .claude/
│   ├── CLAUDE.md
│   └── rules/
│       ├── code-style.md
│       ├── testing.md
│       └── security.md
```

Two loading modes based on frontmatter:

- **No `paths` field** → loaded at launch, same priority as `.claude/CLAUDE.md`.
- **With `paths` field** → loaded only when Claude reads a file matching one of the globs.

User-level rules in `~/.claude/rules/` apply to every project. They load before project rules, so project rules win on conflict.

## Path-scoped rule frontmatter

Exact format:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
```

Triggering: path-scoped rules load when Claude reads a matching file, not on every tool use.

Glob patterns:

| Pattern | Matches |
|---|---|
| `**/*.ts` | All TypeScript files in any directory |
| `src/**/*` | All files under `src/` |
| `*.md` | Markdown files in project root only |
| `src/components/*.tsx` | React components in a specific directory |

Multiple patterns and brace expansion are both supported:

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "lib/**/*.ts"
  - "tests/**/*.test.ts"
---
```

## Compaction behavior

After `/compact`:

- Project-root CLAUDE.md is re-read from disk and re-injected.
- Nested CLAUDE.md files in subdirectories are **not** re-injected automatically; they reload the next time Claude reads a file there.
- Conversation-only instructions are lost — that is why moving them to rules or CLAUDE.md matters.

## CLAUDE.md vs auto memory vs skills (when to use which)

| Mechanism | Loads when | Best for |
|---|---|---|
| CLAUDE.md (root) | Every session, in full | Project-wide context, conventions, build/test commands |
| `.claude/rules/*.md` (no `paths`) | Every session, in full | Cross-cutting standards extracted from CLAUDE.md to keep it focused |
| `.claude/rules/*.md` (with `paths`) | When a matching file is read | Language/framework/tool-specific conventions |
| Subdirectory CLAUDE.md | When Claude reads a file in that subdir | Module-specific orientation |
| Skill | When invoked or when Claude judges relevant | Multi-step workflows, repeatable procedures |
| Auto memory (`MEMORY.md`) | Every session, first 200 lines / 25KB | Learnings Claude accumulates from corrections |

Rulify operates on the first three rows.

## Useful debugging hook

The `InstructionsLoaded` hook logs exactly which instruction files were loaded, when, and why. Use it after a rulify pass to verify path-scoped rules are triggering as expected.
