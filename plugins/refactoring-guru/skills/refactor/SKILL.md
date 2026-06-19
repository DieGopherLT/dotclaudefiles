---
name: refactor
description: >
  This skill should be used when the user says "refactor this", "fix this smell", "apply Extract Method",
  "apply [technique name]", "clean up this code", or passes a finding code from smell-scan (e.g. B1, D3,
  C2). Also trigger when the user wants to apply a specific refactoring.guru technique to a specific
  location. Carries the finding's technique, file, location, and smell context into a safe
  test → refactor → test → commit cycle, delegating the edit to the refactoring-applier agent.
---

# Refactor

Apply one named refactoring.guru technique to one concrete location, safely. This skill coordinates the
change: it resolves what to apply, loads the technique's playbook, guards the change with tests, dispatches
the edit to `refactoring-applier`, and confirms behavior was preserved. It never changes behavior — a
refactor that alters observable behavior is a bug.

## Step 1 — Identify the finding

Resolve technique + location from the user's request, in one of two ways:

- **From a smell-scan code**: the user passes a reference code (`refactor B1`). Recover that finding's
  smell, file, line range, evidence, and mapped techniques from the most recent `smell-scan` report. If
  the finding lists several techniques, pick the most-direct one (first in the list) unless the user named
  a different one; if the choice is non-obvious, state your pick and why in one line.
- **Explicit technique + location**: the user names a technique and a location (`apply Extract Method to
  getTotal in order-service.ts`). Use those directly.

If neither a code nor an explicit technique+location is available, ask one short clarifying question before
proceeding. Do not guess the target.

## Step 2 — Load the technique playbook

Read the matching entry in `references/technique-playbooks.md` for the chosen technique: its group safety
discipline, execution steps, and pitfalls. This is the mechanics the applier will follow. If the technique
is OOP-specific and the target is not class/inheritance code, stop and tell the user the technique does not
apply here — suggest the closest applicable alternative from the smell's technique list.

## Step 3 — Verify the safety net before touching code

Confirm the tests covering the target location pass right now. A refactor on red code is guessing.

- If tests exist and pass: proceed.
- If tests exist and fail: stop — the code is already broken; report it and do not refactor over red.
- If no test covers the location: warn the user explicitly. Offer to pin current behavior with a quick
  characterization test first, or to proceed in the smallest possible steps with behavior verified by
  other means. Never pretend a safety net exists when it does not.

The full safe-cycle rationale (test → refactor → test → commit) lives in this plugin's
`../smell-scan/references/workflow.md`.

## Step 4 — Dispatch the applier

Invoke the `refactoring-applier` agent with everything it needs to execute without re-deriving context:

- **Technique** — the chosen technique name.
- **File** — the target file.
- **Location** — the function/type/line range.
- **Smell context** — the smell and the evidence behind it.
- **Mechanics** — the technique's playbook steps from Step 2, passed verbatim so the agent follows them in
  order.

The applier reads the location (LSP-first for supported languages), applies the mechanics in small steps,
preserves behavior, and reports what changed plus its verification.

## Step 5 — Verify behavior is preserved

After the applier returns:

- Confirm the build/typecheck and the tests covering the location are green — re-run them if the applier's
  report leaves any doubt. For supported languages, check editor diagnostics for new type errors.
- If anything is red, the refactor changed behavior. Do not "fix" the test to match — revert the change and
  report, or have the applier redo the step more carefully.

## Step 6 — Report

Summarize for the user:

- **Technique applied** and **location** (lines before → after).
- **Smell removed** — which finding this addressed.
- **Behavior preservation** — the commands run and their green result; one line confirming inputs→outputs
  and side-effect ordering are unchanged.
- Any prerequisite technique applied, or follow-up smell observed but intentionally left untouched.

Offer the next step: commit this change on its own (a pure `refactor:` commit keeps it bisectable — invoke
the `commit` skill), and/or tackle the next-highest-severity finding. Apply one technique per cycle; do not
batch multiple techniques into one pass.

## References

- `references/technique-playbooks.md` — execution playbooks for all 67 techniques across the 6 groups:
  per-group safety discipline, per-technique steps with verification points, and pitfalls. Always consult
  the relevant entry before dispatching the applier.
- `../smell-scan/references/smell-catalog.md` — the smell catalog (detection criteria, smell→technique
  mapping) and `../smell-scan/references/workflow.md` — the safe-cycle rationale. Both ship in this same
  plugin's `smell-scan` skill; consult them to justify a technique choice or the cycle discipline.
