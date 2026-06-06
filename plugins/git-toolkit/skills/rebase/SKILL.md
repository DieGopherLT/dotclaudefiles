---
name: rebase
description: >
  Assist with an in-progress git rebase, especially when there are merge conflicts. Invoke when the
  user says "help with rebase", "rebase conflict", "I have conflicts", "rebase is stuck", "resolve this
  conflict", "rebase went wrong", or when they are mid-rebase and need guidance on what to keep. The
  key value of this skill is analyzing the history of both branches to understand the intent behind
  each side's changes before deciding how to consolidate them.
---

# Rebase Assistance

You are helping with a rebase that is already in progress and has conflicts. The goal is not to
mechanically pick one side over the other — it's to produce a result that preserves the intent of
changes from both branches while affecting neither more than necessary.

Understanding *why* each change was made is mandatory before touching any conflict marker.

## Step 1 — Assess the current state

Run these commands to understand where things stand:

```bash
git status                           # shows conflicting files and rebase progress
git rebase --show-current-patch      # shows the commit currently being applied
git log --oneline ORIG_HEAD..HEAD    # commits already replayed successfully
```

Identify:
- Which files have conflicts (`UU` status in `git status`)
- Which commit is being applied right now (the "incoming" side)
- What branch is being rebased onto (the target)

## Step 2 — Delegate history analysis to git-history-retriever

Before touching any conflict marker, invoke the `git-history-retriever` agent. Provide it:
- The list of conflicting files
- The branch being rebased (source of commits to replay)
- The branch being rebased onto (the target)

The agent will analyze the commit history of both branches for each conflicting file and report the
intent behind each side's changes. Wait for its report before proceeding to Step 3.

## Step 3 — Analyze each conflict with the history report in hand

For each conflicting file, read the conflict markers in the working tree:
- `<<<<<<< HEAD` (or `<<<<<<< ours`) — current state on the target branch
- `=======` — separator
- `>>>>>>> <sha>` — incoming change from the commit being replayed

Cross-reference with the agent's history report:
- Are both sides adding independent things that should coexist?
- Is one side a refactor of structure that the other side's change now needs to respect?
- Is one side already a superset of the other (one change subsumed)?
- Are they genuinely contradictory — two different answers to the same problem?

## Step 4 — Propose the resolution

For each conflict, produce the resolved content explicitly. Do not say "keep the incoming side" —
show the actual merged result. Explain the reasoning in terms of intent, not just code structure.

Common patterns:

| Situation | Resolution |
|-----------|------------|
| Both sides add independent things | Merge both; order by logical dependency |
| One side refactors what the other changes | Apply the functional change on top of the refactored structure |
| One side is a subset of the other | Keep the superset; verify nothing was silently dropped |
| Genuinely contradictory | Surface both intents clearly; let the user decide |

## Step 5 — Execute the resolution

After the user approves each resolution:

1. Write the resolved content to the file — remove all conflict markers
2. Stage the file: `git add <file>`
3. Move to the next conflicting file
4. When all conflicts are resolved, continue: `git rebase --continue`

If `--continue` reveals new conflicts in subsequent commits, restart from Step 1 for the new conflict.

## Aborting

If the conflicts are deeply intertwined and a merge would be safer, it is always valid to abort:

```bash
git rebase --abort
```

This returns to the exact state before the rebase started, with no partial changes left behind.
Mention this option if the conflict resolution would require wholesale rewrites or the history
analysis shows the branches diverged in fundamentally incompatible directions.
