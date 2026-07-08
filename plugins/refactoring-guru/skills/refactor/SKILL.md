---
name: refactor
description: >
  This skill should be used when the user says "refactor this", "fix this smell", "apply Extract Method",
  "apply [technique name]", "clean up this code", or passes a finding code from smell-scan (e.g. B1, D3,
  C2). Also trigger when the user wants to apply a specific refactoring.guru technique to a specific
  location, or to apply everything (or everything in a domain) flagged by a prior smell-scan. Carries each
  finding's technique, file, location, and smell context into a safe test → refactor → test → commit
  cycle, delegating edits to the refactoring-applier agent.
---

# Refactor

Apply one or more named refactoring.guru techniques safely, always inside a dedicated worktree and always
through the full test → refactor → test → reconcile Workflow — regardless of how many findings or domains
are in scope. Worktree isolation is useful independent of scale: it lets you keep working elsewhere while
refactor runs, and the whole-project build gate in the Reconcile phase protects a single-finding change
exactly as it protects a multi-domain one. A refactor that changes observable behavior is a bug, not a
refactor.

## Step 1 — Identify scope

Resolve which finding(s) are in play, from one of:

- **A single finding code**: the user passes a reference code (`refactor B1`). Recover that finding from
  the SoT file that contains it — the most recent `smell-scan` run persisted one file per domain under
  `.claude/refactoring-guru/findings/`. Codes are globally unique across a scan, so a bare code resolves
  unambiguously even if several SoT files exist.
- **An explicit technique + location**: the user names a technique and a location (`apply Extract Method to
  getTotal in order-service.ts`). No `smell-scan` finding covers this exact location, so before proceeding
  to Step 2, write an ephemeral SoT-shaped file so the rest of this flow treats it exactly like any real
  finding, never as a special-cased in-memory value:

  - **Location**: `.claude/refactoring-guru/findings/_adhoc-<domain-slug>-<file-slug>-L<start>-<end>.json`
    — the `_adhoc-` prefix keeps it visibly distinct from a real scan's `<domain-slug>.json`, so it can
    never collide with or overwrite persisted scan output for that domain.
  - **Shape**: wrap the single finding in the same envelope a real SoT file uses — `{ domain, scanned_at,
    total, findings: [...] }` — not a bare finding object. `domain` is the resolved top-level module folder
    (repo-relative, e.g. `src/orders`) containing the target file; `scanned_at` is the current ISO 8601
    timestamp; `total: 1`; `findings` holds the one finding object with the fields below. Step 3 reads
    `sot.domain` and flattens `sot.findings` exactly like a real scan's file — a flat, unwrapped file
    resolves to zero findings and the request silently does nothing.
  - **Fields**: `code: "AD1"` (single-use — no cross-scan global uniqueness needed); `path`/`line_range`/
    `technique` taken directly from the user's request; `evidence` is a literal echo of the user's
    instruction (e.g. `"User explicitly requested this technique at this location."`); `confidence: 100`
    (a directive, not a probabilistic detection); `smell`/`category` resolved via a best-effort reverse
    lookup (technique → smell) against `${CLAUDE_PLUGIN_ROOT}/references/smell-catalog.md` — if no exact
    reverse mapping exists, `smell: "N/A (user-directed)"`; `severity` is omitted (ad-hoc findings never
    enter a prioritized report); `cross_cutting` is `true` only if the resolved `smell` lands in the
    cross-cutting name set (`Shotgun Surgery`, `Inappropriate Intimacy`, `Divergent Change`), `false`
    otherwise (including when `smell` could not be resolved).

  This file then flows into Step 3 exactly like any other domain's SoT file — nothing downstream
  distinguishes an ad-hoc request from a real scan's finding.
- **A broader request**: "refactor everything flagged in `src/orders`" resolves to that domain's whole SoT
  file. "Refactor everything" resolves to every SoT file from the most recent scan.

If neither a code, an explicit technique+location, nor a resolvable broader request is available, ask one
short clarifying question before proceeding. Do not guess the target.

## Step 2 — Count findings

Count the findings the resolved scope touches, across however many domains/SoT files are in play.

- **Zero findings in scope** — tell the user there is nothing to refactor and stop. Do not enter a
  worktree for empty work.
- **One or more findings** — always continue to Step 3. There is no separate path by finding or domain
  count; a single finding and a multi-domain batch both run the same way.

## Step 3 — Prepare and dispatch

a. Read and parse the relevant SoT JSON file(s) (or the ad-hoc file from Step 1) — this skill parses them,
   not the Workflow script. Detect the project's whole-project build/test command (`buildCmd`) and its
   scoped safe-cycle test command (`testCmd`).

   While reading, check each finding's `technique` against `${CLAUDE_PLUGIN_ROOT}/references/
   technique-playbooks.md`: if it is one of the OOP-specific techniques and the finding's `path` is not
   class/inheritance code, do not include it as-is — look up the finding's `smell` in
   `${CLAUDE_PLUGIN_ROOT}/references/smell-catalog.md` for a non-OOP alternative technique, or flag the
   mismatch to the user before dispatching, instead of forcing an inapplicable technique through.

b. Check whether the current working tree is already a dedicated (non-main) worktree, so a worktree never
   nests inside another: compare `git rev-parse --git-dir` against `git rev-parse --git-common-dir`
   (resolve both to absolute paths) — if they differ, you are already inside a linked worktree.
   - **Already in a worktree**: confirm `git status` is clean (or that any uncommitted changes present are
     ones you intend to fold in) before proceeding — Step 4's `git reset --soft <baseRef>` collapses
     everything between `baseRef` and the final tree into one commit, so pre-existing unrelated uncommitted
     work in this worktree would be swept in too. Then capture `baseRef = git rev-parse HEAD` in place and
     skip ahead to (d) — do not call `EnterWorktree`.
   - **Not in a worktree**: capture `baseRef = git rev-parse HEAD` in the current checkout, **before**
     entering any worktree — this is what the final history collapse in Step 4 resets onto.

c. `EnterWorktree` at `.claude/worktrees/refactoring-guru-refactor-<scope>`, where `<scope>` names the
   batch (e.g. the common ancestor directory of the domains in play, or `refactor-batch` when there is no
   meaningful common ancestor).

d. Dispatch the Workflow:

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/refactor/scripts/workflow.js", args: { sotContents: [<parsed SoT objects>], sotFilePaths: { "<domain>": "<absolute path to that domain's SoT file>", ... }, buildCmd: "<detected build/test gate>", testCmd: "<detected scoped test command>", projectRoot: "<absolute path inside the worktree>", baseRef: "<the SHA captured in step b>" } })
```

`sotFilePaths`' keys are each SoT file's own `domain` field value as parsed from its JSON content (e.g.
`"src/orders"`) — the same string the Workflow finds on each `finding.domain` after flattening
`sotContents` — not the filename slug (`src-orders`) used to name the file on disk.

Do not set `isolation: 'worktree'` on anything you invoke afterward — you are already operating inside the
dedicated worktree (entered in step c, or already active per step b) and every sub-agent should inherit it
as its cwd, not spawn its own.

The Workflow buckets findings into intra-domain (parallel, one applier lane per domain), cross-cutting
(deferred to a reconciliation phase), and skipped (resolution spans domains but the smell is not
cross-cutting by name). It returns `{ mergeable, applied, buildPasses, crossCuttingApplied, rollbackSha,
skipped }`.

## Step 4 — Collapse history

If `applied` is empty (every finding was skipped), there is nothing to collapse — skip straight to Step 5
and report the skips directly; do not create an empty commit.

Otherwise, after the Workflow returns, collapse its internal rollback commit(s) away so only one clean
commit lands on top of `baseRef`:

```
git reset --soft <baseRef>
git commit -m "refactor: <summary of what was applied>"
```

No commit message anywhere in this flow — including the reconciler's internal one, which this reset
discards — may contain the word "checkpoint" or any other internal-mechanism label.

## Step 5 — Hand off

Report the merge verdict first, then present the worktree for review:

- Lead with `mergeable` and what it means: if `true`, the intra-domain work is behavior-preserving and
  build-green, independent of whether the cross-cutting reconciliation itself succeeded.
- Report `crossCuttingApplied`: if `false`, the cross-cutting findings were rolled back because the
  whole-project build failed with them applied — say so, and list those findings under "needs manual
  follow-up."
- List everything in `skipped` with its reason (no safety net, spans domains, or cross-cutting rolled
  back).
- Present the worktree path for the user's review. Never auto-merge — merging is the user's call.

## References

- `${CLAUDE_PLUGIN_ROOT}/references/technique-playbooks.md` — execution playbooks for all 67 techniques
  across the 6 groups: per-group safety discipline, per-technique steps with verification points, and
  pitfalls. Consult the relevant entry to justify or explain a technique choice.
- `${CLAUDE_PLUGIN_ROOT}/references/smell-catalog.md` — the smell catalog (detection criteria,
  smell→technique mapping), used for the ad-hoc reverse lookup in Step 1 and to justify a technique
  choice.
- `${CLAUDE_PLUGIN_ROOT}/references/workflow.md` — the safe test → refactor → test → commit cycle
  rationale that any fix should follow.
