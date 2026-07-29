---
name: binnacle
description: >
  Open, structure, and resume the durable log of a multi-session run: a .claude/binnacle.md file
  at the root of the run's worktree, created from a bundled template, ignored through the repo's
  local exclude file, and written as an immutable reverse-chronological changelog with a
  line-count cursor (read_until_line) so a cold session restores the run with one bounded Read.
  Invoke when task-planning opens a run, and whenever a fresh session finds a binnacle in its
  worktree and must resume the run it describes. Session-closing entries are written by the
  log-binnacle skill, not here.
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

The file (see `references/binnacle-template.md`) has four zones, top to bottom: frontmatter,
*Convenciones de ejecución*, *Plan de sesiones* with its *Bloques*, and *Entradas* — the
changelog, most recent entry first, each new entry inserted directly below the `## Entradas`
marker. Frontmatter keys stay in English for parse stability; the body is written in Spanish.

Two frontmatter keys carry the mechanics:

- `read_until_line: N` — the cursor. A `Read` from line 1 with `limit: N` returns exactly the hot
  prefix: frontmatter, conventions, session plan, and the most recent entry. Because new entries
  insert at the top of the entries zone, the hot prefix stays a stable size no matter how long
  the run gets; history below the cursor is never loaded unless an entry points to it.
- `plan_path` — the approved plan this run implements. Future sessions re-read the original plan
  from disk instead of reconstructing it from a conversation that no longer exists.

Mutability is per zone, stated once:

| Zone | Mutability | Who writes it |
|---|---|---|
| Frontmatter: `current_session`, `status`, `last_updated`, `read_until_line` | mutable | `log-binnacle`; `status: done` by the review session on the user's confirmation |
| Frontmatter: `task`, `branch`, `worktree`, `base_branch`, `base_sha`, `plan_path` | frozen after opening | nobody |
| Convenciones de ejecución | frozen | nobody |
| Plan de sesiones / Bloques | mutable: checkboxes, plus re-planning of unchecked sessions and unfinished blocks | `log-binnacle` |
| Entradas | append-only at the top; existing entries immutable — never edited, deprecated, or summarized | `log-binnacle` |

Where this skill and the binnacle's own blockquote ever disagree, this skill wins.

## Opening

task-planning opens the binnacle when it registers a run:

1. Copy `references/binnacle-template.md` to `.claude/binnacle.md` in the worktree root. The
   template ends at the `## Entradas` marker and its comment line — a freshly opened binnacle has
   zero entries.
2. Ensure the exclude line exists (command above).
3. Fill the frontmatter: `task`, `branch`, `worktree`, `base_branch`, `base_sha` (the frozen
   merge-base SHA — the only value ever used as a git revision), `plan_path`,
   `status: in-progress`, `current_session: 1 of <total>` where total counts working sessions
   only (Sesión R never counts), `last_updated`.
4. Write *Plan de sesiones* and *Bloques* from the decomposition. The plan always ends with a
   `Sesión R — code review` executed manually by the user in a clean session — never by the run.
5. Set `read_until_line` to the last line of the file, verified with a command
   (`awk 'END{print NR}' .claude/binnacle.md`), not by eye.

There is no `A0` task recording the base ref: `base_sha` lives in the frontmatter.

## Resuming

When a session starts cold in a worktree that carries a binnacle:

0. **Status gate.** Read the frontmatter first (`Read` with `limit: 12`) and branch on `status`:
   - `in-progress` — continue with the steps below.
   - `ready-for-review` — do not register tasks and do not write code. Report the run's state
     and that the review is the user's to run. If the user runs the review in this session, work
     from it, and on their explicit confirmation that the run is finished set `status: done` and
     `last_updated`, leaving all entries untouched.
   - `done` — report that the run is closed and ask before doing anything in this worktree.
1. `Read` the file with `offset: 1, limit: <read_until_line>`. `limit` is a line count, so it
   equals the cursor only when reading from line 1 — never start the bounded read at an offset.
   The small overlap with the frontmatter peek is intentional.
2. Reconcile against `git log <base_sha>..HEAD --oneline` (`base_sha`, never `base_branch` — the
   branch moves, the SHA is frozen). Commits are the ground truth; where the binnacle and git
   disagree, trust git.
3. **Recovery.** If git shows commits that no entry above the cursor references, the previous
   session died before closing. Do not continue silently: invoke `log-binnacle` to write a
   recovery entry first (it defines the shape), listing only what `git show` proves and never
   inventing decisions no commit evidences. Then resume from that entry.
4. Re-register the current session's tasks with `TaskCreate` from the **Bloques** section — one
   task per subtask, block code as the first token of each title (`A1: ...`), and the final task
   always `invoke log-binnacle`.
5. Continue from the **Siguiente** section of the most recent entry.
6. Re-read the plan at `plan_path` only when the session's scope needs detail the binnacle does
   not carry. Read entries below the cursor only when the last entry points to them.

## Closing a session

The last task of every session is invoking the `log-binnacle` skill — it writes the session's
entry, advances the checkbox and `current_session`, updates `status` and `last_updated`, and
recalculates `read_until_line`. When the final working session closes, `status` becomes
`ready-for-review`: the user runs the code review manually (`/code-review`) in a clean session,
and the run reaches `done` only through the status gate above.
