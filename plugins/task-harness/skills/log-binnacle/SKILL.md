---
name: log-binnacle
description: >
  Write the closing entry of a work session into the run's binnacle (.claude/binnacle.md): insert
  an immutable entry at the top of the changelog, advance the session checkbox and
  current_session, update status and last_updated, and recalculate the read_until_line cursor.
  Invoke when the task titled "invoke log-binnacle" is reached — the explicit last task of every
  session in a task-harness run — when a resume detects the previous session died without closing
  and needs a recovery entry, or whenever the user asks to close, log, or checkpoint the current
  session before a /clear.
---

# Log binnacle

One operation: close the current session by writing its entry into `.claude/binnacle.md` and
updating the file's state. The entry is the only thing a future cold session will have instead of
this conversation — write it for that reader.

## Write the entry

Compose the entry in Spanish following `references/entry-shape.md` — it also defines the
recovery-entry variant (`[S<n>-recuperada]`) used when a resume finds commits no entry accounts
for. Order matters: the expensive-to-reconstruct content comes first, cheap pointers last.

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

Locate the anchor with `grep -n '^## Entradas$' .claude/binnacle.md` (run from the worktree root;
the marker heading is exactly that line, with an HTML comment directly below it). Insert the
entry below that comment line, above any previous entry: one blank line, the entry, one blank
line. Previous entries are immutable: never edit, deprecate, or summarize them, no matter how
stale they look.

## Update the mutable state

In the same pass:

1. **Plan de sesiones**: mark the closed session's checkbox `[x]`. If blocks of that session were
   left unfinished, move them into a remaining session in the same pass — a checked session must
   not silently own pending work. Re-planning rewrites only the *remaining* (unchecked) sessions
   and the *Bloques* of unfinished blocks; rewriting the past is not allowed.
2. **Frontmatter** — `current_session` and `status` follow this table (`total` counts working
   sessions only; Sesión R never counts):

   | Session just closed | Working sessions remaining | `current_session` becomes | `status` becomes |
   |---|---|---|---|
   | n, with n < total | yes | `n+1 of <total>` | `in-progress` |
   | n, with n == total | no (only Sesión R remains) | `R of <total>` | `ready-for-review` |

   `done` is set later by the review session on the user's confirmation, never here. Always stamp
   `last_updated` with the current ISO timestamp.
3. **Recalculate `read_until_line`** — deterministic recipe, run from the worktree root:
   - `grep -n '^## \[' .claude/binnacle.md` — the line numbers of all entry headers.
   - Two or more headers: the cursor is **the line before the second header**.
   - Exactly one header (first session): the cursor is the last line of the file, obtained with
     `awk 'END{print NR}' .claude/binnacle.md` (not `wc -l`, which undercounts when the trailing
     newline is missing).
   - Zero headers means the insertion did not happen — stop and fix that before touching the
     cursor.

   A `Read` with `offset: 1, limit: read_until_line` must return frontmatter, conventions,
   session plan, and the new entry — nothing older.

## Close the turn

After writing, tell the user the session is closed and what state the run is in, and hand them
the exact resume prompt for the next session — for example: «tras el `/clear`, abre con: "retoma
el run desde la bitácora de este worktree"» — so the cold session's first message contains the
trigger, instead of relying on it discovering the file. When `status` became `ready-for-review`,
say the next step is theirs: run `/code-review` manually in a clean session.
