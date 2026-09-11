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

Goal: a result that preserves the intent of every branch's changes while affecting none of them
more than necessary. Not "pick a side".

## Step 1 — Read the operation state

`git status` names the operation (rebase or merge), the branches, and the conflicting files.
For a rebase, `git rebase --show-current-patch` gives the commit currently being applied.

## Step 2 — Bound the range

`git merge-base <A> <B>`. Agents get `<merge-base>..<tip>` only — pre-divergence history is noise.

## Step 3 — Understand intent before resolving

Launch one `git-history-retriever` per branch involved, in parallel, and wait for all of them —
the agent declares its own inputs. Skip the agents only when intent is already legible without
history: lockfiles, generated files, or a conflict whose two sides are self-evidently independent
additions.

## Step 4 — Propose the resolution

Cross-reference each conflict with the agents' reports and produce the resolved content
explicitly. Do not say "keep the incoming side" — show the actual merged result. Explain
reasoning in terms of intent, not code structure.

| Situation | Resolution |
|-----------|------------|
| Both sides add independent things | Merge both; order by logical dependency |
| One side refactors structure | Apply the functional change on top of the refactored structure |
| One side is a subset of the other | Keep the superset; verify nothing was silently dropped |
| Genuinely contradictory | Surface both intents clearly; let the user decide |

## Step 5 — Execute

After the user approves each resolution: resolve, stage, then `git rebase --continue` or
`git merge --continue`.

If a later commit conflicts on files already analyzed, the history reports still hold — reuse
them. New files, or lost context → restart from Step 1 for the new conflict set.

## Aborting

Offer `--abort` when resolution would need wholesale rewrites, when history shows the branches
diverged in incompatible directions, or when a merge would preserve history better than the
current rebase.
