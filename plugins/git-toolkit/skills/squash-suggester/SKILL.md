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

Analyze the current branch's commit history and produce a squash plan that preserves atomicity
and bisectability. Delegates the analysis to `squash-planner` and writes the result as a
markdown file the user can review before running the interactive rebase.

## Step 1 — Determine branches and merge base

```bash
git branch --show-current
git log --oneline -1
```

Identify:
- **Current branch** — the branch being analyzed
- **Target branch** — where this branch will eventually merge into

If a target branch was passed as `$ARGUMENTS`, use it. Otherwise, check for a configured
upstream (`git rev-parse --abbrev-ref @{upstream}` strips the remote prefix), then fall back
to `main` or `master` (whichever exists):

```bash
git rev-parse --abbrev-ref @{upstream} 2>/dev/null   # may print "origin/main"
git branch --list main master                         # fallback detection
```

Compute the merge base:

```bash
git merge-base <target-branch> <current-branch>
```

If the merge base equals the current branch tip, the branch has zero commits ahead of the
target — report this and stop.

## Step 2 — Invoke squash-planner

Invoke the `squash-planner` agent with:

- **Branch to analyze**: the current branch name
- **Merge base**: the SHA from Step 1
- **Target branch**: for display context in the report

The agent reads every commit in the range, groups them by semantic intent, and returns a
complete squash plan with pick/squash/fixup assignments and bisect safety notes.

## Step 3 — Write the squash plan file

Save the agent's output as:

```
squash-plan-<current-branch>.md
```

Place it in the repository root. If the branch name contains `/` (e.g., `feat/auth-refactor`),
replace `/` with `-` in the filename.

The file must contain exactly what the agent produced:
- A table with columns: **SHA**, **Message preview**, **Action**, **Reasoning**
- A bisect safety section

Do not paraphrase or summarize the agent's output — write it verbatim.

## Step 4 — Report to the user

Tell the user:
- The file path where the plan was saved
- The `git rebase -i` command to use:
  ```bash
  git rebase -i <merge-base-sha>
  ```
- A reminder: the rebase editor lists commits oldest-first; the plan table matches that order

Do not execute the rebase. This skill only produces the plan — the user applies it.
