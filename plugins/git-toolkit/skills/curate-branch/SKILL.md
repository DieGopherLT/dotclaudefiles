---
name: curate-branch
description: >
  Curate a branch before it becomes a PR or gets merged: back it up, rebase it onto the target,
  audit the diff for leftovers, accidental files and secrets, then rebuild its history into
  atomic, bisectable commits with messages and a branch name rewritten in hindsight, executing
  the rewrite after one confirmation. Use it whenever a branch is about to leave its author's
  hands: preparing a PR or a merge, squashing or reordering commits, or fixing commit messages or
  the branch name after the fact, in any language ("cura la rama", "prepare the branch for PR").
argument-hint: "[target-branch]"
---

# Curate Branch

Curating rewrites history so the branch reads as if it had been written knowing the final result.
The tree the branch delivers never changes, except for hygiene fixes the user approved.

```
1 Preflight -> 2 Backup -> 3 Sync -> 4 Hygiene -> 5 Plan + confirm -> 6 Rebuild -> 7 Verify -> 8 Publish
```

The backup in step 2 precedes every change, so any step can be undone. Step 3 only rebases;
step 5 is the only approval point and gates the history rewrite.

## 1. Preflight

Target: `$ARGUMENTS` if given; otherwise the upstream's branch (`git rev-parse --abbrev-ref
@{upstream}`, remote prefix stripped); otherwise `main` or `master`, whichever exists. Run
`git fetch`; from here on `<target>` means `origin/<name>` when it exists, so the branch lands on
the real tip instead of a stale local copy.

Stop and report if any of these fails:

- The worktree is clean and no rebase, merge or cherry-pick is in progress.
- The current branch is not the target.
- The branch has commits ahead of the target (`git rev-list --count <target>..HEAD` > 0). With
  exactly one commit, only steps 3, 4 and the message/name review apply.
- Every commit in `<target>..HEAD` was authored by the user (`git log --format='%ae'` against
  `git config user.email`). Rewriting someone else's commits breaks their local copy, so ask
  before going on.

Also note whether the branch exists on the remote and whether it has an open PR
(`gh pr view --json number,state 2>/dev/null`); steps 5 and 8 depend on it.

## 2. Backup

```bash
git branch -f backup/curate/<branch> HEAD
```

This ref is the undo path for the whole skill (`git reset --hard backup/curate/<branch>`).
Never delete it; the user does once satisfied.

## 3. Sync

```bash
git rebase <target>
```

A plain rebase also drops merge commits from the target into the branch, leaving it linear. On
conflicts, invoke `conflict-resolver`. Record the resulting tip as `<synced>`: it is the tree the
final branch must reproduce.

## 4. Hygiene audit

Read `git diff <target>...HEAD` and list every finding:

| Finding | Examples | Action |
|---|---|---|
| Leftovers | debug prints, `console.log`, commented-out code, TODOs added on this branch | fix if the user agrees |
| Accidental files | `.env`, binaries, large files, editor or OS files, generated plans | remove if the user agrees |
| Secrets | tokens, keys, passwords, connection strings | remove; see below |
| Out of scope | unrelated formatting, opportunistic refactors | flag only |
| Missing release chores | version bump or changelog the repo requires | fix if the user agrees |

Commit the approved fixes on the tip with any valid message; step 6 folds each into the commit it
corrects, so the problem disappears from every commit, not just the last one. Then set `<synced>`
to the new tip.

If a secret was already pushed, rewriting removes it from the branch but not from the remote's
caches or anyone's clone: tell the user to rotate it.

## 5. Plan and confirm

Read every commit in `<target>..HEAD` (`git show --stat`, then the diff where the message is
vague) and group them into the commits the branch should have had. Keep this plan in the
conversation, never in a file.

- One group per logical, testable change: a feature built over WIP commits, a fix plus its "oops"
  follow-ups, a refactor that only compiles once all its steps land.
- Fixes from step 4 join the group whose content they correct.
- A commit and its revert, both on this branch, are dropped together.
- Groups may be reordered so related work sits together, but only when their files do not
  overlap; overlapping groups keep their original relative order to avoid conflicts.
- Every group must check out as a coherent, buildable state. When unsure, merge groups: fewer,
  larger commits beat a broken bisect point.
- A commit mixing unrelated concerns is flagged, not split.
- Write each group's message from scratch with hindsight, following the `commit` skill's message
  format (Step 4) and commit form (Step 5: heredoc when there is a body or an apostrophe). Keep
  scopes consistent across the branch.
- Invoke `branching` to propose a name that describes what the branch turned out to be. Keep
  the current name if it already fits. With an open PR, do not propose a rename: renaming the
  remote branch closes the PR.

Show the plan as a table, oldest commit first (SHAs are the post-rebase ones), plus the findings
flagged in step 4:

```
| # | Final message                         | Source commits            |
|---|---------------------------------------|---------------------------|
| 1 | feat(auth): validate jwt on each call | a1b2c3d, d4e5f6a, 0f9e8d7 |
| 2 | test(auth): cover expired tokens      | 9c8b7a6                   |
Dropped: 5e4d3c2 + its revert 2b1a0f9
Branch: feature/jwt-stuff -> feature/jwt-validation
Push: force-with-lease to origin (branch already published)
```

Wait for the user's approval. Apply corrections they request and show the plan again.

## 6. Rebuild

Rebuild on a detached HEAD at the target, one group at a time, cherry-picking each source
commit separately:

```bash
git switch --detach <target>
git cherry-pick --no-commit <sha>   # once per source commit of the group, oldest first
git commit -m '<final message>'
```

Pass one SHA per call: a multi-commit `cherry-pick --no-commit` that hits a conflict cannot be
continued. A conflict means the group gathered or moved commits that depend on an intervening
one: invoke `conflict-resolver` naming the commit being applied, then cherry-pick the next SHA.
`commit-guard` validates each message. Skip a group whose combined diff is empty.

If the repo has a test or build command (Makefile, package scripts, `go test ./...`, and so on),
run it after each commit. A failure means the grouping left a broken state: stop, report it and
regroup with the user. Without a detectable command, say that bisectability was inferred, not
tested.

## 7. Verify

```bash
git diff --quiet <synced> HEAD
```

A non-empty diff means content was lost or added during the rebuild. Stop, show the diff and
leave the branch untouched. Otherwise move the branch and apply the rename:

```bash
git branch -f <branch> HEAD && git switch <branch>
git branch -m <branch> <new-name>   # only if a rename was approved
```

## 8. Publish and report

If step 3 resolved conflicts, do not push: the resolution is code nobody has reviewed, and step 7
cannot catch it because it compares against the rebased tree. Report the resolved files and stop
there. The branch is pushed, merged or opened as a PR only after that resolution is reviewed;
curating again after the review finds no conflicts and publishes.

Otherwise, if the branch was on the remote, push the plan's approved way:

```bash
git push --force-with-lease origin <name>
# on rename, also: git push origin --delete <old-name> && git branch -u origin/<new-name>
```

`--force-with-lease` refuses the push if someone else pushed in the meantime; report that instead
of forcing.

Report the before and after commit lists, the files whose conflicts step 3 resolved (none
included), the hygiene changes, anything flagged but untouched, whether tests ran per commit, and
the undo command with the backup ref.
