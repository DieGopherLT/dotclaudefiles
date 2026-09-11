---
name: squash-suggester
description: >
  Analyzes a branch's commit history and produces a squash plan for interactive rebase —
  a markdown file with a table of every commit, its recommended action (pick, squash, or fixup),
  and the reasoning, preserving atomicity and bisectability throughout. Invoke immediately
  whenever the user says "suggest squashes", "squash plan", "clean up my branch", "compact the
  history", "squash commits before merge", "prepare branch for PR", "organize commits", or
  mentions wanting fewer commits before merging or opening a PR. Don't wait for the user to
  specify a target branch — default to main and proceed. The output is a ready-to-use reference
  for running git rebase -i.
argument-hint: "[target-branch]"
---

# Squash Suggester

Produce a squash plan for the current branch by delegating the analysis to `squash-planner`.

## Step 1 — Determine target and merge base

Target: `$ARGUMENTS` if given; otherwise the configured upstream
(`git rev-parse --abbrev-ref @{upstream}`, stripping the remote prefix); otherwise `main` or
`master`, whichever exists.

Merge base: `git merge-base <target> HEAD`. If it equals `HEAD`, the branch has zero commits
ahead of the target — report this and stop.

## Step 2 — Invoke squash-planner

Invoke the `squash-planner` agent with:

- **Branch to analyze**: the current branch name
- **Merge base**: the SHA from Step 1
- **Target branch**: for display context in the report

## Step 3 — Write the squash plan file

Save the agent's output verbatim — no paraphrasing or summarizing — as
`squash-plan-<current-branch>.md` in the repository root. If the branch name contains `/`
(e.g., `feat/auth-refactor`), replace `/` with `-` in the filename.

## Step 4 — Report to the user

Tell the user the file path and the command to apply it:

```bash
git rebase -i <merge-base-sha>
```

Do not execute the rebase. This skill only produces the plan — the user applies it.
