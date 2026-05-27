# Module CLAUDE.md Template (Reference)

Use this structure when generating or rebuilding a module-level `CLAUDE.md`. Sections marked **required** must be present. Sections marked **optional** appear only when there is real, non-obvious content. Empty placeholders are not allowed — omit the section instead.

## The exact structure

```markdown
# [Module Name]

## Overview
[1-2 sentences. Required. Describe the module's role in the larger system, not its internal mechanics. The internal mechanics are in the code.]

## Entry Points
[Required. List the symbols a caller actually uses. Skip exports nobody calls.]
- `file::FunctionName` — [why a caller would reach for this, in <20 words]
- `file::ClassName.method` — [same]

## Key Files
[Required. Only files where the role is non-obvious from the filename. Skip self-explanatory ones.]
- **file** — [role in <20 words, focused on responsibility, not contents]

## Business Logic
[Required IF the module has decision logic, invariants, or workflows scattered across files. This is usually the most valuable section. Skip if the module is purely mechanical.]
[Concise prose or bullets. Surface: decision rules, invariants the code assumes, ordering constraints, state transitions.]

## Dependencies
[Required IF dependencies are non-obvious or carry meaning beyond their name.]

**Internal:**
- module — [why this module needs it, not what the dependency is]

**External:**
- package — [why this one was chosen / what role it plays]

**Environment Variables:**
- `VAR_NAME` — [purpose and what breaks if missing/wrong]

## Architecture
[Optional. Include only if there is a design choice that would surprise a new reader. Explain the choice AND the reason. Skip generic patterns ("uses MVC") that the code structure already shows.]

## Side Effects & Constraints
[Optional but high-value. Include if the module has hidden coupling, ordering requirements, or side effects that are not visible at the call site.]

## Failure Modes
[Optional. Include observed failure modes and recovery patterns — the kind of thing learned from incidents or test cases, not from reading happy-path code.]

## Common Pitfalls
[Optional. Only real pitfalls observed in code, tests, or incidents. Each pitfall must include the trap AND the fix.]
- [pitfall] → [solution]

## Usage Examples
[Optional. Include only if usage is non-obvious from the entry-point signatures. Skip if calling it is straightforward.]

```[language]
// [minimal example showing the non-obvious part]
```

```

## Section-by-section guidance

### Overview

Bad: "This module handles user authentication. It exports functions for login, logout, and session management."

Good: "Authentication boundary between the public API and the user-store. All session validation flows through here; downstream services trust requests that this module has stamped."

The first version restates the directory name. The second tells you something the file tree cannot.

### Entry Points

List the symbols callers actually use. If a module exports 40 things and 4 are used externally, list those 4. The rest are implementation detail discoverable via LSP `documentSymbol`.

Use `file::Symbol` format because LSP can resolve it directly. `auth::validateToken` is unambiguous; "the validateToken function" is not.

### Key Files

If a filename already tells you the role (`session-store.ts`, `password-hasher.go`), do not list it. List the files whose role is non-obvious — the orchestrators, the adapters, the files that hold cross-cutting concerns.

### Business Logic

This is where most of the value lives. The agent can read code; what it cannot easily reconstruct is the *web* of decisions that span files:

- "Tokens expire after 24h, but refresh extends only if the user has logged in within the last 7 days." (Decision rule.)
- "The session store assumes IDs are monotonic; non-monotonic IDs cause silent dedup." (Invariant.)
- "Validation happens in `validate()` then again in `commit()` — the second pass catches race conditions the first cannot see." (Ordering constraint.)

If you can write a sentence like one of those, it belongs here. If you can only write "this module validates input", drop it — the code says that.

### Dependencies

For each dependency, answer "why this one." Do not list dependencies just to list them. If `lodash` is imported because the team prefers it, that is not worth saying. If `lodash` is imported because the alternative caused a memory leak in 2023, that is.

For env vars: name what breaks when the var is missing or wrong. "Required" is not enough — say "missing → server fails to start at boot" or "wrong → silent fallback to in-memory store."

### Architecture, Side Effects, Failure Modes, Pitfalls, Examples

Every one of these is **optional**. Include them only when you have something concrete and non-obvious to put there. A section with one weak bullet is worse than no section — it tells the reader the file is padded.
