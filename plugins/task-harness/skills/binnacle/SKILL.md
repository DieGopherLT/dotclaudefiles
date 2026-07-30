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
| Frontmatter: `task`, `branch`, `worktree`, `base_branch`, `base_sha` | frozen after opening | nobody |
| Frontmatter: `plan_path` | frozen after opening, except repair when the resume finds the file missing and the user confirms the new path (see Resuming, step 4) | that repair only |
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
   merge-base SHA — the only value ever used as a git revision), `plan_path` (resolved with the
   recipe below), `status: in-progress`, `current_session: 1 of <total>` where total counts
   working sessions only (Sesión R never counts), `last_updated`.
4. Write *Plan de sesiones* and *Bloques* from the decomposition. The plan always ends with a
   `Sesión R — code review` executed manually by the user in a clean session — never by the run.
5. Set `read_until_line` to the last line of the file, verified with a command
   (`awk 'END{print NR}' .claude/binnacle.md`), not by eye.

There is no `A0` task recording the base ref: `base_sha` lives in the frontmatter.

### Resolving `plan_path`

Every future session re-reads the plan from this path, so it must be an **expanded absolute
path** (`/home/<user>/...`, never `~`-prefixed — the `Read` tool requires an absolute path) to a
file that exists right now. Never fill it from memory, and never substitute a summary of the plan
inside the binnacle — the binnacle carries state, not specification.

Which value to record:

| Situation | `plan_path` |
|---|---|
| The user named a plan file, or one exists on disk for this work — anywhere: `~/.claude/plans/`, an in-repo `spec/`, a doc the user pointed at | that file's absolute path, verified |
| A plan was approved in this conversation (via `ExitPlanMode`, or written plan text the user accepted) but no file exists on disk | write it to disk first (steps 4-5), then that path |
| A direct implementation request with no plan artifact and no approved plan text — the decomposition being produced now is the only design | `none` |

Recipe:

1. If the user named a path, expand it to absolute and go to step 3.
2. Otherwise run `mkdir -p ~/.claude/plans` and list `ls -t ~/.claude/plans/`, keeping only files
   whose name or `# ` title matches this task. Exactly one match — use it. Zero matches — treat
   the plan as unsaved (step 4). Two or more matches — ask the user which one; never pick by
   recency alone.
3. Verify with `ls <path>`. A failed `ls` means the file does not exist — route to step 4, never
   to `none`. Record the expanded absolute path.
4. To materialize an unsaved plan, derive the filename from the run's branch, stripping the type
   prefix: `feat/http-client-extraction` → `~/.claude/plans/http-client-extraction.md`.
5. If that file already exists, do not overwrite it — it may be another run's frozen `plan_path`
   target. Suffix `-2`, `-3`, ... until the name is free, write the full approved plan there, and
   verify with `ls`.

## Resuming

When a session starts cold in a worktree that carries a binnacle:

0. **Status gate.** Read the frontmatter first (`Read` with `limit: 12`) and branch on `status`:
   - `in-progress` — continue with the steps below.
   - `ready-for-review` — register no tasks and write no code until the user decides. Report
     the run's state and that the review is theirs to run. Then:

     | User's response in this session | Do |
     |---|---|
     | Confirms the run is finished | Set `status: done` and `last_updated`. Entries untouched. Stop. |
     | Reports review findings to fix | Set `status: in-progress`, add a new working session to *Plan de sesiones* with its blocks, bump the total and `current_session`, register that session's tasks (final task `invoke log-binnacle`), then execute normally. |
     | Says nothing, or asks something else | Stay read-only. Do not touch the frontmatter. |
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
   inventing decisions no commit evidences. Then re-run steps 0 and 1: `log-binnacle` rewrote
   `current_session`, `status`, `read_until_line`, and `last_updated`, so every value read before
   the recovery entry is stale. If the refreshed `status` is no longer `in-progress`, follow that
   branch of the gate and stop — a recovery entry can close the run's last working session.
4. **Read the plan.** `Read` the file at `plan_path` in full (skip only when `plan_path` is
   `none`). The binnacle carries state — what was done and what comes next — not specification:
   the session about to execute needs the plan's intent and design decisions, not just its task
   titles. Each session runs only a slice of the run, so the full plan fits its budget.
   If the Read fails because the file no longer exists, stop before registering any task and ask
   the user for the plan's current location — do not glob `~/.claude/plans/` for a lookalike and
   do not proceed planless. `plan_path` is frozen against rewriting, not against repair: once the
   user confirms the new path, verify it with `ls`, update `plan_path` and `last_updated`, and
   note the repair in the next session entry's *Desviaciones*.
5. Re-register the current session's tasks with `TaskCreate` from the **Bloques** section — one
   task per subtask, block code as the first token of each title (`A1: ...`), and the final task
   always `invoke log-binnacle`.
6. Continue from the **Siguiente** section of the most recent entry. Read entries below the
   cursor only when the last entry points to them. When the binnacle has zero entries — the
   run's first session died before closing anything — there is no *Siguiente*: start from the
   first subtask of the first block of the current session as written in **Bloques**.

## Closing a session

The last task of every session is invoking the `log-binnacle` skill — it writes the session's
entry, advances the checkbox and `current_session`, updates `status` and `last_updated`, and
recalculates `read_until_line`. When the final working session closes, `status` becomes
`ready-for-review`: the user runs the code review manually (`/code-review`) in a clean session,
and the run reaches `done` only through the status gate above.
