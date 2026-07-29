---
name: log-binnacle
description: >
  Write the closing entry of a work session into the run's binnacle (.claude/binnacle.md): insert
  an immutable entry at the top of the changelog, advance the session checkbox and
  current_session, update status and last_updated, and recalculate the read_until_line cursor.
  Invoke when the task titled "invoke log-binnacle" is reached — the explicit last task of every
  session in a task-harness run — or whenever the user asks to close, log, or checkpoint the
  current session before a /clear.
---

# Log binnacle

One operation: close the current session by writing its entry into `.claude/binnacle.md` and
updating the file's state. The entry is the only thing a future cold session will have instead of
this conversation — write it for that reader.

## Write the entry

Compose the entry in Spanish, following the entry shape in the binnacle (see the `[S1]` example
that ships in the template). Order matters: the expensive-to-reconstruct content comes first,
cheap pointers last.

- **Header**: `## [S<n>] <fecha ISO> — alcance: <bloques de la sesión>`.
- **Estado al cierre**: one paragraph — where the run stands, the first thing a cold reader must
  know.
- **Hecho**: one line per completed subtask, block code first (`A1: ...`), with what changed, why
  it matters, and the commit SHA.
- **Decisiones**: each decision with its full reasoning. The reasoning is the expensive part —
  write it complete, not as a label.
- **Desviaciones y sorpresas**: what differed from the plan or was discovered; `ninguna` if the
  session was clean.
- **Siguiente**: the exact first action of the next session.
- **Referencias**: `path::Symbol`, commit SHAs, docs — pointers, not prose.

Insert the entry **directly below the `## Entradas` marker line**, above any previous entry.
Previous entries are immutable: never edit, deprecate, or summarize them, no matter how stale
they look.

## Update the mutable state

In the same pass:

1. **Plan de sesiones**: mark the closed session's checkbox `[x]`. If the session deviated from
   plan, rewrite the *remaining* (unchecked) sessions and the *Bloques* of unfinished blocks —
   re-planning the future is allowed; rewriting the past is not.
2. **Frontmatter**:
   - `current_session`: advance to the next session number.
   - `status`: keep `in-progress` while working sessions remain; set `ready-for-review` when the
     session just closed was the last working session (only Sesión R remains). `done` is set by
     the user after their manual review, not here.
   - `last_updated`: current ISO timestamp.
3. **Recalculate `read_until_line`** — deterministic recipe:
   - Find the line numbers of all entry headers (lines starting with `## [`).
   - If there are two or more, the cursor is **the line before the second header**.
   - If there is exactly one (first session), the cursor is the **last line of the file**.

   Verify with `grep -n '^## \[' .claude/binnacle.md` and `wc -l` rather than counting by eye. A
   `Read` with `limit: read_until_line` must return frontmatter, conventions, session plan, and
   the new entry — nothing older.

## Close the turn

After writing, tell the user the session is closed, what state the run is in, and — when `status`
became `ready-for-review` — that the next step is theirs: run `/code-review` manually in a clean
session. The next working session starts with `/clear` and reopens through the `binnacle` skill's
resume procedure.
