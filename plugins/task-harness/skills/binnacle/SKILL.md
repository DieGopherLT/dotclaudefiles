---
name: binnacle
description: >
  Open, structure, and resume the durable log of a multi-session run: a .claude/binnacle.md file
  at the root of the run's worktree, created from a bundled template, ignored through the repo's
  local exclude file, and written as an immutable reverse-chronological changelog with a
  length-prefixed cursor so a cold session restores the run with a single bounded Read. Invoke
  when task-planning opens a run, and whenever a fresh session finds a binnacle in its worktree
  and must resume the run it describes. Session-closing entries are written by the log-binnacle
  skill, not here.
---

# Binnacle

A substantial task does not fit one context window. The work is split into **sessions** separated
by `/clear`, and everything the conversation-scoped task list knows dies at each cut. The binnacle
is the durable layer between sessions: one markdown file per worktree that carries the session
plan, the run's state, and an immutable changelog of what every closed session did and decided.
In pattern terms it is the run's memento — the externalized snapshot a later session restores
without having lived the original context.

Execution needs no skill of its own: each session works in the main context with its normal
tools, guided by this file. The binnacle's *Convenciones de ejecución* section carries the few
rules that must survive the cut (commit per block, immediate `TaskUpdate`, `log-binnacle` as the
last task of every session).

## Where it lives, and why it is never committed

- Path: `.claude/binnacle.md` at the root of the run's worktree. One worktree, one run, one file.
- Every run lives in a dedicated worktree — task-planning enforces this. A binnacle in the main
  working tree would be inherited by whatever branch checks out there next.
- Ignore it through the repo's local exclude file: append `.claude/binnacle.md` to
  `$(git rev-parse --git-common-dir)/info/exclude` when the line is absent. Never edit the tracked
  `.gitignore` for this — the exclude file is unversioned, applies to every worktree of the repo,
  and the line is written once for all future runs.

## Structure: an immutable changelog with a cursor

The file (see `references/binnacle-template.md`) has four zones, top to bottom:

1. **Frontmatter** — run identity and state. Keys stay in English for parse stability; the body
   is written in Spanish. Two keys carry the mechanics:
   - `read_until_line: N` — the cursor. A `Read` with `limit: N` returns exactly the hot prefix:
     frontmatter, execution conventions, session plan, and the most recent entry. History below
     the cursor is never loaded unless an entry points to it.
   - `plan_path` — the approved plan this run implements. Future sessions re-read the original
     plan from disk instead of reconstructing it from a conversation that no longer exists.
2. **Convenciones de ejecución** — the execution rules every session follows.
3. **Plan de sesiones** — checkboxes per session plus the block breakdown (letter groups). This
   zone is the only mutable one: checkboxes advance and re-planning rewrites it.
4. **Entradas** — the changelog, most recent entry first, inserted directly under the
   `## Entradas` marker line. Entries are **immutable**: never edited, deprecated, or summarized.
   Inside each entry, the expensive-to-reconstruct content comes first (closing state, decisions
   with their reasoning, deviations and surprises) and cheap pointers last
   (`path::Symbol`, commit SHAs).

Because new entries insert at the top of the entries zone, the hot prefix stays a stable size:
`read_until_line` only ever spans one entry, no matter how long the run gets.

## Opening

task-planning opens the binnacle when it registers a run:

1. Copy `references/binnacle-template.md` to `.claude/binnacle.md` in the worktree root.
2. Ensure the exclude line exists (command above).
3. Fill the frontmatter: `task`, `branch`, `worktree`, `base_ref` (branch @ merge-base SHA),
   `plan_path`, `status: in-progress`, `current_session: 1 of <total>`, `last_updated`.
4. Write *Plan de sesiones* and *Bloques* from the breakdown. The plan always ends with a
   `Sesión R — code review` executed manually by the user in a clean session — never by the run.
5. Set `read_until_line` to the last line of the file (there are no entries yet, so the whole
   file is the hot prefix).

There is no `A0` task recording the base ref: `base_ref` lives in the frontmatter.

## Resuming

When a session starts cold in a worktree that carries a binnacle:

1. Read the frontmatter (first ~15 lines), then `Read` the file with `limit: read_until_line`.
   That yields state, conventions, session plan, and the last entry — the full resume context.
2. Reconcile against `git log <base_ref>..HEAD --oneline`. Commits are the ground truth; where
   the binnacle and git disagree, trust git.
3. Re-register the current session's tasks with `TaskCreate` from the *Bloques* section: block
   code as the first token of each title (`A1: ...`), and the final task always
   `invoke log-binnacle`.
4. Continue from the **Siguiente** section of the most recent entry.
5. Re-read the plan at `plan_path` only when the session's scope needs detail the binnacle does
   not carry. Read entries below the cursor only when the last entry points to them.

## Closing a session

The last task of every session is invoking the `log-binnacle` skill — it writes the session's
entry, advances the checkbox and `current_session`, updates `status` and `last_updated`, and
recalculates `read_until_line`. When the final working session closes, `status` becomes
`ready-for-review`: the user runs the code review manually (`/code-review`) in a clean session,
and flips `status` to `done` when the run is truly finished.
