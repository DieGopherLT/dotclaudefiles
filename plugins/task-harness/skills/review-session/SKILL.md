---
name: review-session
description: >
  Run Sesión R of a task-harness run: review everything the run committed since base_sha with
  the project's own auditors, /code-review at an effort chosen by a declared rubric, and
  /security-review when a trust boundary was touched; contrast every finding against the plan
  and the binnacle before accepting it, dispatch the survivors as parallel background fixes, and
  close through log-binnacle. Pre-existing findings are logged to a file, never fixed; /simplify
  runs last over the run's diff. Invoke it whenever the binnacle's resume gate finds
  status: ready-for-review, or when the user asks to review the run, run Sesión R, or review the
  branch of a worktree that carries a .claude/binnacle.md — in any language.
---

# Review session

The run's working sessions are closed and the binnacle says `ready-for-review`. This session
owns the review: it decides how hard to look, launches every independent review at once,
arbitrates the findings with the context the run left behind, applies what survives, and hands
the run back to the user as `done` or with one more working session.

It starts where the `binnacle` skill's resume procedure leaves it: binnacle read up to the
cursor, plan read from `plan_path`, git reconciled against `base_sha`. Everything below assumes
those three are in context — do not re-read them.

## Is a pass worth running?

Confirm `git status` is clean; the review covers history, not the working tree. Then judge the
changeset, not the file count: new business logic, cross-cutting edits, or anything the plan
calls risky warrants the full pass. A run that turned out to be a rename, a config change, or
docs does not — say so, skip to *Close*, and let the user confirm `done`. The binnacle's friction
totals and the `main`/`delegable` marks are a concrete input here: a run made only of delegable
mechanical blocks rarely needs more than a light look.

## Choose the effort for `/code-review`

Decide it now, from the plan and the binnacle, not at planning time: the modifiers below depend
on what execution actually did — whether tests exist, which blocks turned out mechanical, what
deviated — and only the entries know that.

The guiding question: *what does a false negative cost, and how much noise do I tolerate to
avoid it?* `low`/`medium` optimize precision; `high` and `xhigh` widen coverage and accept
uncertain findings, which is what you want when a miss is expensive.

**Step 1 — the cost of a miss sets the base band.** Read it from the plan's domain:

| What does a false negative cost? | Base |
|---|---|
| Expensive: payments, auth, persistence, concurrency, contracts others consume | `xhigh` |
| Moderate: normal business logic, visible but contained error | `high` |
| Cheap: internal, mechanical, reversible, no new logic | `medium` |

**Step 2 — yes/no modifiers of ±1 level**, bounded to `low → medium → high → xhigh`:

| Modifier | Effect | Where to read it |
|---|---|---|
| New logic with real decision density | +1 | plan, *Hecho* of the entries |
| No tests — the review is the only defense | +1 | entries, `git diff --stat <base_sha>..HEAD` |
| Real coupling: many call sites of what changed | +1 | call-site counts in *Bloques* |
| Pure mechanical transformation (rename, move, config) | −1 | `delegable` marks, *Hecho* |
| Project auditors will cover this same patch | −1 | the scan in the next section |

`low` is reachable only from base `medium` with a mitigator. `xhigh` is the ceiling: a `+1` on
base `xhigh` changes nothing, and `max` is never chosen — repeated `max` reviews are too costly
for the user's subscription. File count never sets the band by itself. Declare the decision in
the report so it can be audited: «base high, +1 sin tests, −1 auditores → high». `ultra` is out
of scope — it is user-triggered and billed.

## Identify the project's auditors

Scan the available agents for an auditing or reviewing role — names or descriptions with
`audit`, `review`, `check`, `inspector`, `validator` — and keep the ones whose domain matches the
changeset. These carry project knowledge `/code-review` lacks, which is why they earn the −1
modifier above. None applying is a normal outcome, not a gap.

## Launch every review at once

Everything here is independent, so start it all in the same turn and let it run in the
background while you wait:

- Each selected auditor as an Agent, briefed per the `subagent-dispatch` skill with the diff
  range `<base_sha>..HEAD` and the plan path.
- `/code-review <effort>` **without `--fix`**: applying fixes is delegated below, where this
  session's context is spent arbitrating rather than editing.
- `/security-review` only when the changeset touches a trust boundary — user input, auth or
  authz, API surfaces, calls to external services. Omitting it for purely internal changes is
  the intended outcome, not an oversight.

## Arbitrate with the run's own memory

This is where the binnacle pays for itself. Before classifying anything, hold each finding
against the plan and the entries' *Decisiones* and *Desviaciones*:

- A finding that contradicts a recorded decision **and that decision's reasoning still holds**
  is a false positive — the reviewer lacked the context. Discard it and say which decision
  covers it.
- A finding that contradicts a recorded decision whose reasoning the finding actually refutes is
  the most valuable kind: keep it and flag the decision as revised.
- A finding about code outside `git diff <base_sha>..HEAD` is pre-existing: out of scope for
  this branch, logged to a file instead of fixed (see below).

What remains is the in-scope set. Report the discards with their reasons — the user reads this
to trust the filter.

## Dispatch the fixes

Group in-scope findings so no two agents share a file (the same disjointness the delegable gate
uses) and prefer fewer agents with more fixes each. Launch them in parallel, in the background,
briefed per `subagent-dispatch`, and calibrate per group to its heaviest finding:

| Finding | Model + effort |
|---|---|
| Explicit fix: missing guard, off-by-one, rename, existing helper to call | `haiku` + `high` (default) |
| Bounded fix that needs tactical judgment: restructure one function, touch one module's call sites | `sonnet` + `medium` |
| Cross-cutting or design-level, or a PLAUSIBLE that needs its trigger investigated | `opus` + `medium`/`high` |

A fix in a critical domain moves up one row even when it looks mechanical.

**Pre-existing findings** are never fixed and never dispatched: they are not this run's work.
Append each one to `.claude/preexisting-findings.md` in the main worktree (first line of
`git worktree list`), not the run's worktree, which is discarded after merge. Create the file if
missing and make sure the repo's local exclude (`.git/info/exclude`) ignores it, as the binnacle
does. One entry per finding: `file:line`, the defect, why it is outside `<base_sha>..HEAD`, the
reviewer that raised it and its confidence, the run's branch and date. Skip a finding already
listed. The user triages the file whenever they choose; the closing entry only names it.

When the in-scope appliers return, review their reports as `subagent-dispatch` prescribes, run
the run's own verification command, and commit through the `commit` skill — one commit per
group is fine.

## Simplify last

Once the in-scope fixes are committed, invoke `/simplify` over `<base_sha>..HEAD`. It runs
after the fixes, not beside them, for two reasons: what it finds is aesthetic, and it edits files,
so running it alongside the appliers would collide with them. All four angles it provides —
reuse, simplification, efficiency, altitude — are mandatory; do not drop one because the diff
looks clean for it, and say in the report what each angle found, "nothing" included. Restrict it
to code the run changed: anything it flags outside the range is pre-existing and goes to the file
above. Run the verification command again and commit through the `commit` skill, separate from
the fix commits.

## Close

Invoke `log-binnacle` for Sesión R. Its entry carries the declared effort, the reviews that ran,
every discarded finding with the decision that covered it, the fixes committed, the `/simplify`
result per angle, and how many pre-existing findings went to `.claude/preexisting-findings.md`. `done` is still the user's call: with every in-scope finding
fixed and verified, `log-binnacle` leaves `reviewed` and you tell them the run awaits their
confirmation — given in this session, curate the run's branch for merge, then
set `status: done` and `last_updated` yourself, entries untouched. Curation comes after the review
because it folds the review's fix and `/simplify` commits into the commits they correct, and
before `done` because `done` means ready to merge. If the curation's rebase resolved conflicts,
the branch now holds code nobody reviewed: run `/code-review` over the resolved files before
`done` — `low` when the resolution only merged independent changes, `medium` when it changed
logic — commit any fix and curate again. Until that review passes, nothing is pushed, merged or
opened as a PR. With findings this
session could not resolve — a design question, a fix that failed verification — `log-binnacle`
reopens the run with a working session for them, and *Siguiente* names the first one.
