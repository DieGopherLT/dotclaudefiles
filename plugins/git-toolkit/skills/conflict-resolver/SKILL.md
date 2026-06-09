---
name: conflict-resolver
description: >
  Resolves git conflicts in progress — for both rebases and merges. Invoke immediately whenever
  the user says "help with rebase", "rebase conflict", "merge conflict", "I have conflicts",
  "rebase is stuck", "resolve this conflict", "rebase went wrong", or is mid-rebase or mid-merge
  and needs guidance on what to keep. Don't wait for the user to ask explicitly — if git status
  shows conflict markers or a rebase/merge is active, invoke this skill. Analyzes the commit
  history of every branch involved via parallel sub-agents to understand each side's intent
  before touching any conflict marker.
---

# Conflict Resolver

You are helping resolve git conflicts in progress — either a rebase or a merge. The goal is not
to mechanically pick one side over the other: it is to produce a result that preserves the intent
of changes from all branches while affecting none of them more than necessary.

Understanding *why* each change was made is mandatory before touching any conflict marker.

## Step 1 — Detect the operation type and conflicting state

```bash
git status
```

From the output, determine:
- Which files have conflicts (`UU` status)
- Whether a **rebase** or **merge** is active:
  - Rebase: presence of `.git/rebase-merge/` or `.git/rebase-apply/`
  - Merge: presence of `.git/MERGE_HEAD`
- The branches involved:
  - **Rebase**: `ORIG_HEAD` (branch being replayed) and `HEAD` (target)
  - **Merge**: `HEAD` (current branch) and `MERGE_HEAD` (branch being merged in)

For a rebase, also run:

```bash
git rebase --show-current-patch   # the commit currently being applied
git log --oneline ORIG_HEAD..HEAD # commits already replayed successfully
```

## Step 2 — Find the common ancestor and bound the analysis range

```bash
git merge-base <branch-A> <branch-B>
```

This gives the commit where the branches diverged. The relevant history for each branch is
`<merge-base>..<branch-tip>` — only the commits that diverged, nothing before. Save this range;
agents in Step 3 will use it to stay focused on what actually matters for the conflict.

## Step 3 — Delegate history analysis to git-history-retriever agents

Before touching any conflict marker, invoke one `git-history-retriever` agent **per branch
involved**. Launch all agents in parallel. Each agent receives:
- The branch it is analyzing
- The commit range: `<merge-base>..<branch-tip>`
- The list of conflicting files

For a standard 2-branch conflict (rebase or merge), launch 2 agents in parallel.
For an octopus merge (3+ branches), launch one agent per branch.

Wait for all agents to complete before proceeding to Step 4.

## Step 4 — Analyze each conflict with the history reports in hand

For each conflicting file, read the conflict markers in the working tree:
- `<<<<<<< HEAD` (or `<<<<<<< ours`) — current branch state
- `=======` — separator
- `>>>>>>> <sha>` — incoming change

Cross-reference with the agents' reports:
- Are both sides adding independent things that should coexist?
- Is one side a refactor of structure that the other side's change now needs to respect?
- Is one side already a superset of the other (one change subsumed)?
- Are they genuinely contradictory — two different answers to the same problem?

## Step 5 — Propose the resolution

For each conflict, produce the resolved content explicitly. Do not say "keep the incoming side" —
show the actual merged result. Explain reasoning in terms of intent, not code structure.

| Situation | Resolution |
|-----------|------------|
| Both sides add independent things | Merge both; order by logical dependency |
| One side refactors structure | Apply the functional change on top of the refactored structure |
| One side is a subset of the other | Keep the superset; verify nothing was silently dropped |
| Genuinely contradictory | Surface both intents clearly; let the user decide |

## Step 6 — Execute the resolution

After the user approves each resolution:

1. Write the resolved content to the file — remove all conflict markers
2. Stage the file: `git add <file>`
3. Move to the next conflicting file
4. When all conflicts are resolved, continue the operation:

**Rebase:**
```bash
git rebase --continue
```
If `--continue` reveals new conflicts in a subsequent commit:
- If the conflicting files were already analyzed in this session → skip to Step 4; the history
  reports are still valid for those files.
- If new files appear that were not previously analyzed, or the context from the prior analysis
  is no longer available → restart from Step 1 for the new conflict set.

**Merge:**
```bash
git merge --continue
# or: git commit  (if --continue is unavailable in the installed git version)
```

## Aborting

If the conflicts are deeply intertwined and a different approach would be safer:

```bash
git rebase --abort   # rebase
git merge --abort    # merge
```

Both return to the exact state before the operation started. Mention this option when:
- Conflict resolution would require wholesale rewrites
- History analysis shows the branches diverged in fundamentally incompatible directions
- A merge would preserve history better than the current rebase
