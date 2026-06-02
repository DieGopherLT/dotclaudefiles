# Context Document Template

Structure and writing guidelines for the session context document produced by `end-session`.

---

## Golden Rule

The document is self-contained. A reader who was not in the session — including a future Claude instance with no memory of this conversation — must be able to reconstruct the full working context from the document alone, without reading the git log or the code from scratch.

Test every sentence: "Would a reader need to already know this to understand it?" If yes, add the prerequisite.

---

## Writing Priority: What Gets Space

Allocate space according to how difficult the knowledge was to generate:

| Priority | Content | Space |
|---|---|---|
| 1 (most) | Investigation-intensive discoveries: non-obvious root causes, architectural constraints uncovered, failed approaches and why they failed, key decisions and their reasoning | Maximum detail |
| 2 | Current state: what was built, what was changed, what is the stopping point | Medium detail |
| 3 | Easily inferable facts: file names, public APIs, things readable from the code in under 30 seconds | One-line reference only |

Do not write explanations for things the reader can find by opening a file. Instead, write the file reference so they know where to look.

---

## Document Structure

```markdown
Este archivo fue creado por la skill /end-session

# Session Context: <branch-name or topic>

## Goal

One or two sentences: what was this session trying to accomplish and why.

## Current State

What was achieved. Reference specific files and symbols (`file::Symbol` format when possible).
If the session completed its goal: say so.
If interrupted: state this clearly and proceed to the Stopping Point section.

## Stopping Point

[Include only if work was interrupted]

- **Last completed step**: <specific description, e.g., "implemented X in file.go:42">
- **Next step**: <exact action to take when resuming, e.g., "wire X into Y via the Z interface — see file.go:10">
- **Blocker (if any)**: <what was blocking progress, if applicable>

Be precise enough that the next session can resume without re-reading the entire conversation.

## Key Discoveries

Knowledge that required significant investigation to uncover. This is the most valuable section.

For each discovery:
- State the finding directly
- Explain WHY it matters (what would break if ignored)
- Include the source or reference (file path, external doc, error message that led here)

Example structure:
- **Finding**: The X system does Y when Z happens.
  **Why it matters**: Ignoring this causes W.
  **Source**: `path/to/file.go:55` or "investigation of the Foo API docs"

## Decisions Made

Architectural or design decisions taken during the session, with their rationale.

For each decision:
- What was decided
- Why (the constraint, tradeoff, or information that drove it)
- What was ruled out and why

## Context Map

Quick orientation for the reader. Only include entries that are non-obvious from filenames alone.

- `path/to/file.ext` — what it does and why it matters here
- `path/to/other.ext` — same

For obvious files (e.g., `plugins/foo/SKILL.md` when the session was about the foo skill), omit.

## Pending Work

[Include only if there is identified work that was not started]

List in priority order. Distinguish between:
- **Blocked**: needs X before it can start
- **Ready**: can start immediately on resume
```

---

## Format Notes

- Use `file::Symbol` (e.g., `auth.go::validateToken`) for LSP-resolvable symbol references
- Use `path/to/file.go:42` for line-specific references
- Keep the document under 150 lines. Past that, it stops being read carefully.
- No generic advice ("write tests", "handle errors") — only session-specific facts
- No boilerplate sections: omit any section that has nothing to say

---

## Destination-Specific Notes

### When writing to a project file

Place the file where it will be found naturally:
- If working on a feature branch: `.claude/docs/<branch-name>.md` or a path the user specifies
- If the project has a `docs/sessions/` or similar convention: follow it

### When writing to memory

**Resolving the memory path:**

Run `git rev-parse --show-toplevel` to get the project root (e.g., `/home/diego/projects/foo`). Convert it to a memory path by replacing every `/` with `-`:

```
/home/diego/projects/foo  →  ~/.claude/projects/-home-diego-projects-foo/memory/
```

Write the context document to `<memory-path>/<slug>.md`.

**Memory file frontmatter:**

```markdown
---
name: <kebab-case-slug matching the branch or topic>
description: <one-line summary used to judge relevance in future sessions — be specific about what was being built>
metadata:
  type: project
---

Este archivo fue creado por la skill /end-session

[document body]
```

The `name` slug is what the user will cite in future sessions to retrieve the context. Make it memorable and specific: `auth-middleware-rewrite`, `end-session-skill-dev`, `payment-webhook-integration` — not `session-2025-05-30` or `work-notes`.

**MEMORY.md pointer:**

After writing the topic file, add or update the pointer in `~/.claude/projects/<project>/memory/MEMORY.md`:

```
- [Title](slug.md) — one-line hook describing what work it preserves
```

Place it under the most relevant existing section, or create a new section if none fits.
