# Claude Code Memory Spec (Reference)

Source: https://code.claude.com/docs/en/memory

This file captures the parts of the official spec that rulify depends on. Read it when you need exact frontmatter syntax, loading order, or edge cases.

## Loading order

Claude Code walks up the directory tree from the working directory, reading every `CLAUDE.md` and `CLAUDE.local.md` along the way. All discovered files are **concatenated** into context (not overridden). Within each directory, `CLAUDE.local.md` is appended after `CLAUDE.md`.

Subdirectory `CLAUDE.md` files are **not loaded at launch**. They load lazily when Claude reads, writes, or edits a file in that subdirectory (a Bash `cat` or `head` of a single file counts as a read). This is one of the reasons rulify works — extracted scope-specific content can also live in nested CLAUDE.md or in path-scoped rules.

Block-level HTML comments (`<!-- ... -->`) in CLAUDE.md are stripped before injection. Comments inside fenced code blocks are preserved.

## Size guidance (official)

> **Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence.

The official figure is a target, not a limit: longer files cost context and reduce adherence. The only hard limit is that Claude Code skips a file over 4 MiB. Rulify treats 150 as the practical sweet spot for both CLAUDE.md and individual rule files (see `rules-best-practices.md`).

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
- Recursive imports allowed, max depth 4 hops.
- Imports expand **eagerly** at launch — they cost context every session, just like inline content. Imports do not give you on-demand loading. For that, use `.claude/rules/` with `paths`.

## `.claude/rules/` directory

Drop markdown files in `.claude/rules/`. All `.md` files are discovered recursively, including subdirectories like `frontend/` or `backend/`. Symlinks are supported, but a symlink whose target is outside the working directory is treated as an external import: it needs the project's approval of external imports, and after that only the rules without `paths` load. A rule shared through such a symlink must therefore be always-on.

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
- **With `paths` field** → loaded only when Claude reads, writes, or edits a file matching one of the globs (a Bash `cat` or `head` of a single file also counts).

User-level rules in `~/.claude/rules/` apply to every project. They load before project rules, but neither set overrides the other: when a user rule and a project rule conflict, Claude may follow either one, so keep the two consistent.

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

Triggering: path-scoped rules load when Claude reads, writes, or edits a matching file, not on every tool use. Loading a rule because a `CLAUDE.md` was auto-loaded does not happen: that file enters context without a Read/Write/Edit, so a rule whose `paths` match `**/CLAUDE.md` loads only when Claude opens or edits that file explicitly.

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
- Rules with `paths` are not re-injected either; they load again on demand, when a matching file is next touched.
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

## AGENTS.md

Claude Code (v2.1.277+) reads `AGENTS.md` natively. By default (`Project instructions` setting `claude-md-or-agents-md`):

| Files present | What Claude reads |
|---|---|
| `AGENTS.md`, no `CLAUDE.md` or `CLAUDE.local.md` in the working directory or above | `AGENTS.md` |
| `AGENTS.md` and a `CLAUDE.md` or `CLAUDE.local.md` in the working directory or above | `CLAUDE.md` files only |
| A `CLAUDE.md` that imports `AGENTS.md` (`@AGENTS.md`) | `CLAUDE.md`, with `AGENTS.md` through the import |

The setting `claude-md-and-agents-md` reads both. A subdirectory `AGENTS.md` loads only when Claude opens a file there with the Read tool, and only if that subdirectory has no `CLAUDE.md` of its own. `InstructionsLoaded` hooks do not fire for an `AGENTS.md` read through the setting (they do fire for one a `CLAUDE.md` imports). In some sessions `AGENTS.md` cannot be read directly (built-in plugin disabled, versions before 2.1.281 on Bedrock or with telemetry off): there, the `@AGENTS.md` import is the way.

## Useful debugging hook

The `InstructionsLoaded` hook logs exactly which instruction files were loaded, when, and why. Use it after a rulify pass to verify path-scoped rules are triggering as expected.
