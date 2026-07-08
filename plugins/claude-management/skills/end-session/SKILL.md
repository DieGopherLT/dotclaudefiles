---
name: end-session
description: Skill de invocacion manual exclusiva, ejecutada por el usuario via /end-session; el modelo nunca debe autoinvocarla. Cierra formalmente una sesion de trabajo: commitea los cambios de logica de negocio y genera un documento de contexto autocontenido para reconstruccion futura de la sesion.
version: 1.0.0
disable-model-invocation: true
---

# End Session

Automate session closing: commit business logic changes and produce a self-contained context document for future session reconstruction.

Two phases, always in order:
1. **Commit** — stage and commit changed business logic files; skip session artifacts
2. **Document** — create or update a context preservation file (project tracking file or memory entry)

Invoking this skill counts as explicit user approval to commit the classified changes.

## Reference files (read on demand)

- `references/commit-strategy.md` — classification heuristics for commit vs skip, WIP detection, and atomicity guidance. Read at Phase 1, Step 2.
- `references/context-doc-template.md` — full structure and writing priorities for the session context document. Read at Phase 2, Step 2.

## Phase 1: Commit Changes

### Step 1: Assess git state

Run `git status` and `git diff` to understand the full scope of changes (both staged and unstaged).

### Step 2: Classify files

Read `references/commit-strategy.md` for the full classification guide.

### Step 3: Determine completeness per logical group

For each group of related changes, determine whether the work is complete or interrupted. Use the session conversation context as the primary signal — you were part of the session. Read `references/commit-strategy.md` for additional code-level signals.

### Step 4: Stage and commit

Group related changes into atomic commits — one logical change per commit. Then commit each group:
- Complete work: use the appropriate conventional prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`)
- Incomplete or interrupted work: use `wip:` prefix
- Never mix unrelated changes in a single commit
- Format: single line, max 96 chars, no emojis, no co-author attribution

Use `git mv` for moves and `git rm` for deletes. Never `rm` + `git add`.

After committing, run `git status` to verify the working tree is clean for the classified files.

## Phase 2: Document the Session

### Step 1: Detect destination

Check for an existing tracking file in this order:
1. Any file in the project or its `.claude/` directory that contains the line `Este archivo fue creado por la skill /end-session`
2. `.claude/docs/<current-branch-name>.md` — the canonical location for branch-scoped session context

If found: **update it in place**.
If neither exists: **create a new memory entry**. Do not fuzzy-match across the project tree — if nothing is found through these two paths, use `AskUserQuestion` to confirm whether to write to a specific project file or fall back to memory.

### Step 2: Write the context document

Read `references/context-doc-template.md` for the full structure and writing priorities.

The golden rule: **the document must be self-contained**. A reader with zero session context must be able to reconstruct the full picture from it alone.

Writing priorities (in descending order of space allocated):
1. Knowledge that required significant investigation — non-obvious discoveries, decisions made and why, paths ruled out
2. Current state and exact stopping point (critical for interrupted work: specify file, function, step)
3. Obvious or easily inferable things — mention them superficially with a file reference or source link, do not explain

### Step 3: Attribution marker

Every file created or updated by this skill must contain this exact line somewhere prominent (first or last line of the document):

```
Este archivo fue creado por la skill /end-session
```

This marker signals that the next `/end-session` invocation should update this file rather than create a new one.

### Step 4: Finalize

**If the destination was a project file**: stop here.

**If the destination was a memory entry**:
- See `references/context-doc-template.md` — "Destination-Specific Notes / When writing to memory" — for the exact memory path format, frontmatter structure, and MEMORY.md pointer syntax.
- Report to the user:
  - The memory file name (kebab-case slug)
  - The reference phrase: `"la proxima sesion menciona '<slug>' para que encuentre este contexto de inmediato"`
