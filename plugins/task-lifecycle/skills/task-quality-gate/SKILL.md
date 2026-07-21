---
name: task-quality-gate
description: >
  Review a finished changeset from up to ten independent angles at once, adversarially verify every
  candidate finding, and dispatch the survivors as fixes. Invoke whenever the user wants their work
  reviewed — "review my changes", "review this branch", "audit the diff", "check what I just wrote",
  "is this ready to merge", "run the quality gate", "look for bugs in this changeset" — and invoke it
  automatically at the end of task-execution, once every group is committed. Works standalone on any
  branch with commits: it needs only a base ref to diff against, not a plan or a task list. This is the
  third of three chained skills, following task-planning and task-execution.
---

# Task Quality Gate

This skill reviews a changeset that already exists in git history. It fans out ten read-only auditors
over the same patch, has every candidate finding attacked by an adversarial verifier, and hands you the
survivors to arbitrate.

It works standalone. A branch with commits and a base ref is the whole prerequisite — there is no need
for `task-planning` to have run, or for a task list to exist.

## Step 1 — Confirm there is something to review

**Everything must be committed.** Run `git status`; if anything is uncommitted, commit it via the
`commit` skill or stash it first. The gate reviews history, not the working tree.

**Establish the base ref.** This is what the diff is taken against — usually `main`, but use whatever
ref the branch was actually cut from. `git merge-base HEAD main` settles it when it is unclear. Every
step below calls it the **base branch**.

**Assess whether the changeset warrants a pass.** A judgment call, not a checkbox:

- Warrants one: several files modified, new business logic, cross-cutting changes, or code where
  readability and duplication concerns are plausible.
- Does not: a single-file edit, a documentation-only change, a config tweak, a trivial rename.

If it does not warrant a pass, say so and stop. The multi-agent overhead exceeds the benefit on small
changes, and running it anyway trains everyone to ignore the output.

## Step 2 — Generate the patch once

```bash
git diff <base-branch>..HEAD > /tmp/quality-gate-<branch-slug>.patch
```

Generate it **once**. Every agent in this phase reads that same file by path, which is why none of them
needs `Bash` or its own git access. Note the absolute path — the Workflow needs it.

## Step 3 — Choose the effort band

Two steps, auditable and reproducible. The guiding question: *what does a false negative cost, and how
much noise do I tolerate to avoid it?* `medium` optimizes precision — few findings, all actionable.
`high` through `max` widen coverage and accept uncertain findings, which is what you want when a miss is
expensive.

**Step 1 — the dominant criterion sets the base band (cost of a miss):**

| What does a false negative cost? | Base band |
|---|---|
| Expensive: critical domain — payments, auth, persistence, concurrency, contracts others consume | `xhigh` |
| Moderate: normal business logic, visible but contained error | `high` |
| Cheap: internal, mechanical, reversible change with no new logic | `medium` |

**Step 2 — yes/no modifiers of ±1 level**, bounded to the ladder `medium → high → xhigh → max`:

| Modifier | Effect |
|---|---|
| New logic with real decision density? | +1 |
| No tests — the review is the only defense? | +1 |
| Real coupling (many call sites of what changed)? | +1 |
| Pure mechanical transformation (rename, move, config)? | −1 |
| Domain auditors already covered this same patch? | −1 |

`medium` is the floor: it is already the precision-optimized configuration, and there is nothing cheaper
than it except not running the gate at all — which is Step 1's decision, not this one. A mitigator
applied at base `medium` leaves it at `medium`. `max` is reachable only from base `xhigh` plus an
aggravator.

Declare the decision in the report: "base high, +1 no tests, −1 auditors → high".

Anchors: a 30-file mass rename → base medium, −1 mechanical → `medium`; one file in the payments flow
with no tests → base xhigh, +1 → `max`. File count is explicitly a weak proxy — it never sets the band
by itself.

### What the band actually changes

| Band | Correctness angles | Bias | Confidence cut | Gap sweep | Report cap | Agent effort |
|---|---|---|---|---|---|---|
| `medium` | A-C | precision | 80 | no | 8 | inherited |
| `high` | A-C | recall | 50 | no | 10 | inherited |
| `xhigh` | A-E | recall | 50 | yes | 15 | inherited |
| `max` | A-E | recall | 50 | yes | 15 | `max` override |

The five quality angles — reuse, simplification, efficiency, altitude, conventions — run at every band.
Deeper bands lower the confidence cut rather than raising it, because a recall-biased sweep is only
worth running if the uncertain findings actually surface; the adversarial verifier is what protects
precision, not the threshold. `max` differs from `xhigh` in exactly one lever: it overrides every
agent's reasoning effort to `max`, where the other bands inherit each agent's own frontmatter
calibration.

## Step 4 — Run the domain auditors first, if any apply

Scan the available agents list for any with an auditing or review role — look for names or descriptions
containing `audit`, `review`, `check`, `inspector`, `validator`. Identify every one whose domain the
changeset actually touches, and invoke them all in parallel.

This is discovery, not a fixed list: which auditors exist depends on what is installed. Skip this step
entirely when none apply — that is the correct outcome, not an oversight. Their findings merge with the
gate's at arbitration time, and their coverage is what the `−1` modifier above accounts for.

## Step 5 — Run the review Workflow

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/task-quality-gate/scripts/workflow.js",
  args: {
    effort: "<band from Step 3>",
    patchPath: "<absolute path from Step 2>",
    baseBranch: "<base branch>",
    repoRoot: "<absolute repo root>"
  }
})
```

The script pipelines each angle straight into verification with no barrier between them, collects and
deduplicates the survivors, runs the gap sweep in the deeper bands, and returns:

```js
{ band, findings: [ { file, line, category, class, short_summary, summary, failure_scenario, confidence, verdict, verdict_reasoning } ], preExisting, counts }
```

`verdict` is `CONFIRMED` or `PLAUSIBLE`; refuted findings never reach you, and `verdict_reasoning`
carries the verifier's argument so arbitration does not start from zero. `findings` come ranked
correctness-first — a correctness bug always outranks a quality finding when the cap forces a cut.
`preExisting` holds the real defects the verifier dated before the branch: they never enter the main
report, and they are the input to the out-of-scope dispatch in Step 7. The Workflow returns data and
writes nothing — every decision about what to do with the findings is yours.

The Workflow tool requires the user to have opted into multi-agent orchestration. If they have not, say
what the gate would run and its rough scale, and offer it — do not silently downgrade to a single
inline review, which is precisely the thing this gate replaced.

## Step 6 — Run `/security-review` if a trust boundary moved

Invoke `/security-review` only when the changeset touches an entry or exit barrier: user input handling,
authentication, authorization, API boundaries, or external service calls. Skip it for purely internal
changes where no trust boundary is crossed — omitting it there is intentional.

## Step 7 — Arbitrate

The Workflow verified each finding in isolation. You are the only participant with the context of why
the changeset was written, and arbitration is where that pays.

1. **Discard false positives** the verifier could not have caught — a finding that is technically right
   but rests on a constraint you know does not apply.
2. **Split the rest** into **in-scope** (introduced by this changeset) and **pre-existing out-of-scope**
   (surfaced by the review but present before the branch). The Workflow already did the first pass: its
   `preExisting` field carries the defects the verifier dated before the branch. Start from that split —
   demote any finding you know predates the branch, and promote any `preExisting` entry the verifier
   misdated.
3. **Report** the arbitrated set with the `ReportFindings` tool, most-severe first, so the host renders
   them natively. The Workflow's finding shape maps field for field — pass `file`, `line`, `summary`,
   `short_summary`, `failure_scenario`, `category`, and `verdict` through, and set `level` to the band
   from Step 3. Report the findings once: `ReportFindings` or prose, never both.
4. **Dispatch** both groups as described below, then commit the applied in-scope fixes via the `commit`
   skill.

Do not apply the fixes yourself. By this point your context is spent on the feature, and applying fixes
already specified by the verifiers is low-density work that contaminates it.

## In-scope findings — parallel appliers on the current branch

Group the findings so that no two write agents ever touch the same file, and prefer fewer agents
carrying more fixes each. Dispatch the groups in parallel with the Agent tool.

Calibrate model and effort per finding; when one agent carries several, calibrate to the heaviest in its
group:

| Finding level | Model + effort |
|---|---|
| `CONFIRMED` with an explicit fix (missing guard, off-by-one, rename, existing helper) | `haiku` (no effort) |
| Bounded local fix requiring tactical judgment (restructure one function, call sites of one module) | `sonnet` + `low`/`medium` |
| Cross-cutting fix, `PLAUSIBLE` needing the trigger investigated, or an altitude finding (design-level, above the line-by-line diff) | `opus` + `medium`/`high` — never `sonnet` + `max` as a substitute (cost crossover) |

Transversal escalator: a fix in a critical domain moves up one row even when it looks mechanical.

## Pre-existing out-of-scope findings — fire-and-forget dispatch

Never touch them on the current branch. Dispatch them as background agents instead:

1. Group them by file or module so no two agents ever write the same files.
2. For each group, launch an implementer agent with `isolation: "worktree"` and
   `run_in_background: true`.
3. The fix must be based on the **base branch**, not on the current one. The worktree is created from
   the current state, so the agent's first instruction is to cut a fresh branch from the base:
   `git switch -c fix/<slug> <base-branch>`, before touching anything.
4. Each agent's prompt carries: the concrete finding with its location, that branch-from-base
   instruction, the instruction to fix only that, to verify (build and tests), and to commit in its
   worktree with a `fix:` message. Never push.
5. At the close, report the dispatched agents with their worktree and branch for later review and merge.
   Do not block on them.

## Closing

Report, in this order:

- The band and how it was derived ("base high, +1 no tests → xhigh").
- The findings, via `ReportFindings`.
- What was applied on this branch, and the commit.
- The out-of-scope agents dispatched, with their branches.

A gate that found nothing is a real result. Say so plainly rather than manufacturing findings to justify
the pass.
