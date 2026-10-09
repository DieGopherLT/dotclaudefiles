---
name: review-session
description: >
  Run Sesión R of a task-harness run: review everything the run committed since base_sha with
  the project's own auditors, /code-review at an effort chosen by a declared rubric, and
  /security-review when a trust boundary was touched; contrast every finding against the plan
  and the binnacle before accepting it, dispatch the survivors as parallel background fixes, and
  close through log-binnacle. Invoke it whenever the binnacle's resume gate finds
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
avoid it?* `low`/`medium` optimize precision; `high` through `max` widen coverage and accept
uncertain findings, which is what you want when a miss is expensive.

**Step 1 — the cost of a miss sets the base band.** Read it from the plan's domain:

| What does a false negative cost? | Base |
|---|---|
| Expensive: payments, auth, persistence, concurrency, contracts others consume | `xhigh` |
| Moderate: normal business logic, visible but contained error | `high` |
| Cheap: internal, mechanical, reversible, no new logic | `medium` |

**Step 2 — yes/no modifiers of ±1 level**, bounded to `low → medium → high → xhigh → max`:

| Modifier | Effect | Where to read it |
|---|---|---|
| New logic with real decision density | +1 | plan, *Hecho* of the entries |
| No tests — the review is the only defense | +1 | entries, `git diff --stat <base_sha>..HEAD` |
| Real coupling: many call sites of what changed | +1 | call-site counts in *Bloques* |
| Pure mechanical transformation (rename, move, config) | −1 | `delegable` marks, *Hecho* |
| Project auditors will cover this same patch | −1 | the scan in the next section |

`low` is reachable only from base `medium` with a mitigator; `max` only from base `xhigh` with an
aggravator. File count never sets the band by itself. Declare the decision in the report so it
can be audited: «base high, +1 sin tests, −1 auditores → high». `ultra` is out of scope — it is
user-triggered and billed.

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
  this branch, handled separately below.

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

**Pre-existing findings** never land on this branch. Dispatch them fire-and-forget: one Agent
per disjoint file group, `isolation: "worktree"`, `run_in_background: true`, first instruction
`git switch -c fix/<slug> <base_branch>` so the fix is cut from the base and not from this run,
then fix only that and verify. Like every sub-agent, it leaves the diff uncommitted in its
worktree: committing is the main agent's job, after reviewing the report. List the dispatched
worktrees in the closing entry and do not wait for them — the user reviews and commits each one
when they get to it.

When the in-scope appliers return, review their reports as `subagent-dispatch` prescribes, run
the run's own verification command, and commit through the `commit` skill — one commit per
group is fine.

## Close

Invoke `log-binnacle` for Sesión R. Its entry carries the declared effort, the reviews that ran,
every discarded finding with the decision that covered it, the fixes committed, and the
pre-existing worktrees handed off. `done` is still the user's call: with every in-scope finding
fixed and verified, `log-binnacle` leaves `reviewed` and you tell them the run awaits their
confirmation — given in this session, set `status: done` and `last_updated` yourself, entries
untouched; with findings this
session could not resolve — a design question, a fix that failed verification — `log-binnacle`
reopens the run with a working session for them, and *Siguiente* names the first one.
