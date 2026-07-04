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

Apply one or more named refactoring.guru techniques safely. This skill is a **scale dispatcher**: it picks
its execution strategy by how many domains the requested scope spans. A single finding in a single domain
runs inline — you resolve it, verify the safety net, and dispatch one applier directly. A scope spanning
two or more domains fans out through a `Workflow` inside a dedicated worktree, with a reconciliation gate
at the end. Either way, a refactor that changes observable behavior is a bug, not a refactor.

## Step 1 — Identify scope

Resolve which finding(s) are in play, from one of:

- **A single finding code**: the user passes a reference code (`refactor B1`). Recover that finding from
  the SoT file that contains it — the most recent `smell-scan` run persisted one file per domain under
  `.claude/refactoring-guru/findings/`. Codes are globally unique across a scan, so a bare code resolves
  unambiguously even if several SoT files exist.
- **An explicit technique + location**: the user names a technique and a location (`apply Extract Method to
  getTotal in order-service.ts`). Use those directly; this always resolves to a single finding in a single
  domain.
- **A broader request**: "refactor everything flagged in `src/orders`" resolves to that domain's whole SoT
  file. "Refactor everything" resolves to every SoT file from the most recent scan.

If neither a code, an explicit technique+location, nor a resolvable broader request is available, ask one
short clarifying question before proceeding. Do not guess the target.

## Step 2 — Count domains and dispatch

Count the distinct domains the resolved scope touches.

- **Zero findings in scope** — tell the user there is nothing to refactor and stop. Do not enter a
  worktree for empty work.
- **One finding in one domain** — go inline: continue to Step 3 below (the original single-finding flow).
  No worktree, no Workflow.
- **Two or more domains** — go scaled: skip to "Scaled path" below.

### Inline path (single finding, single domain)

**Step 3 — Load the technique playbook**

Read the matching entry in `references/technique-playbooks.md` for the chosen technique: its group safety
discipline, execution steps, and pitfalls. This is the mechanics the applier will follow. If the technique
is OOP-specific and the target is not class/inheritance code, stop and tell the user the technique does not
apply here — look up the finding's `smell` in `../smell-scan/references/smell-catalog.md` and suggest the
closest applicable alternative technique for that smell (the persisted finding carries only the single
chosen `technique`, not the full mapped list, so the catalog is the source for alternatives).

**Step 4 — Verify the safety net before touching code**

Confirm the tests covering the target location pass right now. A refactor on red code is guessing.

- If tests exist and pass: proceed.
- If tests exist and fail: stop — the code is already broken; report it and do not refactor over red.
- If no test covers the location: warn the user explicitly. Offer to pin current behavior with a quick
  characterization test first, or to proceed in the smallest possible steps with behavior verified by
  other means. Never pretend a safety net exists when it does not.

The full safe-cycle rationale (test → refactor → test → commit) lives in this plugin's
`../smell-scan/references/workflow.md`.

**Step 5 — Dispatch the applier**

Invoke the `refactoring-applier` agent with everything it needs to execute without re-deriving context:

- **Technique** — the chosen technique name.
- **File** — the target file.
- **Location** — the function/type/line range.
- **Smell context** — the smell and the evidence behind it.
- **Mechanics** — the technique's playbook steps from Step 3, passed verbatim so the agent follows them in
  order.

The applier reads the location (LSP-first for supported languages), applies the mechanics in small steps,
preserves behavior, and reports what changed plus its verification.

**Step 6 — Verify behavior is preserved**

After the applier returns:

- Confirm the build/typecheck and the tests covering the location are green — re-run them if the applier's
  report leaves any doubt. For supported languages, check editor diagnostics for new type errors.
- If anything is red, the refactor changed behavior. Do not "fix" the test to match — revert the change and
  report, or have the applier redo the step more carefully.

**Step 7 — Report**

Summarize for the user:

- **Technique applied** and **location** (lines before → after).
- **Smell removed** — which finding this addressed.
- **Behavior preservation** — the commands run and their green result; one line confirming inputs→outputs
  and side-effect ordering are unchanged.
- Any prerequisite technique applied, or follow-up smell observed but intentionally left untouched.

Offer the next step: commit this change on its own (a pure `refactor:` commit keeps it bisectable — invoke
the `commit` skill), and/or tackle the next-highest-severity finding. Apply one technique per cycle; do not
batch multiple techniques into one pass.

### Scaled path (two or more domains)

**Step 3 — Prepare and enter a dedicated worktree**

1. Capture `preWorkBase = git rev-parse HEAD` in the current checkout, **before** entering any worktree —
   this is what the final history collapse resets onto.
2. Enter a dedicated worktree via `EnterWorktree` at `.claude/worktrees/refactoring-guru-refactor-<scope>`,
   where `<scope>` names the batch (e.g. the common ancestor directory of the domains in play, or
   `refactor-batch` when there is no meaningful common ancestor).
3. Read and parse the relevant SoT JSON file(s) — this skill parses them, not the Workflow script.
4. Detect the project's whole-project build/test command (`buildCmd`) and its scoped safe-cycle test
   command (`testCmd`) the same way you would for the inline path's safety-net check.

**Step 4 — Dispatch the Workflow**

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/refactor/scripts/workflow.js", args: { sotContents: [<parsed SoT objects>], buildCmd: "<detected build/test gate>", testCmd: "<detected scoped test command>", projectRoot: "<absolute path inside the worktree>", preWorkBase: "<the SHA captured in Step 3>" } })
```

Do not set `isolation: 'worktree'` on anything you invoke afterward — you are already inside the dedicated
worktree from Step 3 and every sub-agent should inherit it as its cwd, not spawn its own.

The Workflow buckets findings into intra-domain (parallel, one applier lane per domain), cross-cutting
(deferred to a reconciliation phase), and skipped (resolution spans domains but the smell is not
cross-cutting by name). It returns `{ mergeable, applied, buildPasses, crossCuttingApplied, rollbackSha,
skipped }`.

**Step 5 — Collapse history**

After the Workflow returns, collapse its internal rollback commit(s) away so only one clean commit lands on
top of `preWorkBase`:

```
git reset --soft <preWorkBase>
git commit -m "refactor: <summary of what was applied>"
```

No commit message anywhere in this flow — including the reconciler's internal one, which this reset
discards — may contain the word "checkpoint" or any other internal-mechanism label.

**Step 6 — Hand off**

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

- `references/technique-playbooks.md` — execution playbooks for all 67 techniques across the 6 groups:
  per-group safety discipline, per-technique steps with verification points, and pitfalls. Always consult
  the relevant entry before dispatching the applier.
- `../smell-scan/references/smell-catalog.md` — the smell catalog (detection criteria, smell→technique
  mapping) and `../smell-scan/references/workflow.md` — the safe-cycle rationale. Both ship in this same
  plugin's `smell-scan` skill; consult them to justify a technique choice or the cycle discipline.
