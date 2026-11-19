---
name: clean-branches
description: >
  Delete branches already merged into the base branch, together with their worktrees; age is never
  the criterion. Use it when the user asks to clean, prune or tidy branches or worktrees, or after
  merges leave them piled up, in any language ("limpia las ramas", "borra los worktrees viejos",
  "cleanup merged branches"). Before a worktree is removed it saves what would be lost with it: the
  lessons in its work log and any uncommitted change worth keeping. Never pushes and never touches
  remote branches.
argument-hint: "[base-branch]"
---

# Clean Branches

A merged branch has delivered its code, but its worktree can still hold things git does not carry:
uncommitted edits, ignored files, and a work log (`.claude/binnacle.md`) with the lessons of the
work. Removing the worktree destroys all of it for good, so it is recovered first and the removal
comes last.

```
1 Survey -> 2 Delete the clear cases -> 3 Recover -> 4 Plan + confirm -> 5 Execute -> 6 Report
```

## 1. Survey

Base: `$ARGUMENTS` if given (`develop`, say), otherwise `main` or `master`, whichever exists. Run
`git fetch --prune`; if it fails, stop and say so, because merged would be judged against stale
refs. From here on `<base>` means `origin/<name>` when it exists.

List `git branch --format='%(refname:short) %(objectname:short)'` and `git worktree list --porcelain`.
Run `git worktree prune` first so worktrees whose directory is gone do not block branch deletion.
A branch is a **candidate** only when:

- its name has a `<prefix>/` (`feature/`, `fix/`, `refactor/`...). Names without one (`main`, `dev`,
  `staging`, `testing`) are long-lived and never touched, and so are `release/` and `hotfix/`.
- it is not the base, and it is not checked out in the worktree you stand in or the primary one.
- its worktree, if any, is not locked (`locked` in the porcelain output): skip it and report.

**Merged** means one of:

- `git merge-base --is-ancestor <branch> <base>` succeeds; or
- `gh pr list --head <branch> --base <base-name> --state merged --json number,headRefOid` returns a
  PR whose `headRefOid` equals the branch tip. Squash and rebase merges leave no ancestry; the tip
  match proves the branch has no commits after that PR, which a reused branch name would.

Not provably merged means keep and report, whatever its age.

A branch never worked on passes the ancestry test trivially, so it must not count as merged. Treat
it as in progress when every entry of `git reflog show --format=%gs <branch>` starts with `branch:
Created`, when its reflog is empty (expired or fetched from elsewhere), or when its worktree has a
`.claude/binnacle.md` and no commits of its own.

`backup/curate/<name>` refs (left by `curate-branch`) are the undo path of a history rewrite. Delete
one only together with the branch of the same name; one whose branch has another name (renamed by
the curation) or is gone is reported and kept.

## 2. Delete the clear cases

A merged candidate with no worktree is deleted right away, no confirmation: nothing outside git
depends on it. A merged candidate whose worktree is clean (`git -C <path> status --porcelain`
empty) and has no `.claude/binnacle.md` is handled the same way after `git -C <path> status
--ignored --short` shows nothing beyond dependency folders and `.env`; anything else ignored
(local databases, certificates, notes) is lost on removal, so that worktree moves to step 4.
Remove with `git worktree remove <path>`, never `--force`, then the branch and its backup ref.

Delete branches with `git branch -d`. Use `-D` only when git refuses because the merge was
confirmed through `gh` (squash) or the local base it checks against is stale; the merged test above
already passed. Record each deleted branch's SHA for the report.

## 3. Recover

For each remaining merged candidate that has a worktree, read its `.claude/binnacle.md` whole, if
present, and inspect its uncommitted changes.

**Knowledge in the work log.** Look for decisions, reversals, deviations from the plan, and changed
conditions of the repo. Keep an item only when someone who clones the repo fresh would hit a wall
without it: it must not be derivable from the code, `git log`, or what the repo's CLAUDE.md, README
and docs already say. Check those before keeping anything. A summary of what the run did is not
knowledge, and neither is a fact the merged diff already shows. Route each survivor:

- True only on the user's machine or setup: memory. Invoke `remember` to classify and write it,
  which also keeps entries auditable; if it is not installed, ask the user where to record it.
- True for anyone working on the repo: the repo's own docs, in the place a reader would look for
  it (CLAUDE.md, a path-scoped rule, README, `docs/`).

**Uncommitted changes.** For each changed fragment run `git -C <path> diff HEAD -- <file>`, read the
work log around that area, and compare with `git diff <base> -- <file>` to see whether it already
landed. Then pick one:

| Verdict | When | Action |
|---|---|---|
| Discard | already in `<base>`, or abandoned in the log | `git -C <path> restore .` and `git -C <path> clean -fd` |
| Cherry-pick | useful, not in `<base>`, and the log shows it is finished | commit it on the branch, then cherry-pick that commit onto `<base>` |

A change that is useful but unfinished is not a third verdict: the branch is kept, with the worktree
untouched, and reported.

## 4. Plan and confirm

Step 2 is the only step that has changed anything so far; this one covers the rows that need
judgment. One table, one confirmation:

```
| Branch / worktree      | Recover                               | Then                    |
|------------------------|---------------------------------------|-------------------------|
| feature/jwt-validation | memory: staging needs X (log, run 2)  | remove worktree, branch |
|                        | doc: CLAUDE.md "Auth" gets Y          |                         |
|                        | cherry-pick fix in auth.ts            |                         |
| fix/null-cart          | discard 2 files (already in main)     | remove worktree, branch |
Kept: refactor/db-layer (not merged), chore/empty-branch (no work yet)
```

A discard cannot be undone: show its diff stat and list the untracked files it deletes. Wait for
approval and apply the corrections requested.

## 5. Execute

Per row, in this order, so nothing is removed before it is saved:

1. Write the memory entries.
2. Commit on the branch what step 3 marked, with `commit`, from the worktree directory.
3. In the primary worktree (first entry of `git worktree list`): it must be on `<base>`'s local
   branch and clean, otherwise stop and ask where to land the work. Fast-forward it to `<base>`
   (`git merge --ff-only`), then apply the doc edits and cherry-pick the commits from step 2, with
   `commit` for the docs. A cherry-pick conflict goes to `conflict-resolver`. Never push.
4. Discard what step 3 marked.
5. `git worktree remove <path>`, never `--force`. A refusal means something is left in the tree:
   re-read it, do not force.
6. Delete the branch and its backup ref as in step 2. A branch whose last commit was cherry-picked
   is not an ancestor of `<base>` (the pick has a new SHA), so `-d` refuses; the content has landed,
   so use `-D`.

If any of steps 1 to 4 fails, leave that row's worktree and branch untouched and report the failure;
the work log is still the only copy of its lessons.

## 6. Report

List per branch: deleted (with SHA, restorable by `git branch <name> <sha>`), kept and why, what
was saved and where (memory entry or doc path), cherry-picked commits, discarded changes, backup
refs kept. State that docs and cherry-picks sit on the local base, unpushed. List merged prefixed
branches still on the remote (`git branch -r --merged <base>`); deleting remote branches is outside
this skill.
