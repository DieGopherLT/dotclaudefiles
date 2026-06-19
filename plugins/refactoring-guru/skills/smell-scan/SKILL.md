---
name: smell-scan
description: >
  This skill should be used when the user says "scan this for smells", "audit this code", "what code
  smells does X have", "review this for quality issues", "find code smells in", or asks about the code
  quality of a specific file, function, or class. Also trigger when the task-planning quality pass runs
  over modified files. Covers the full refactoring.guru taxonomy of 26 smells across 5 categories,
  producing located, confidence-scored findings mapped to concrete refactoring techniques — not generic
  Clean Code advice.
---

# Smell Scan

Turn a passive Clean Code reading into a reactive analysis of real code. Given a target — a file, a
directory, or a specific function/type — detect concrete code smells from the refactoring.guru taxonomy,
report each with its location, confidence, and the techniques that resolve it, then offer to apply a fix
via the `refactor` skill.

This skill orchestrates a Workflow that fans one read-only `smell-detector` per category across the target
in parallel, then synthesizes a single priority-ordered report. It does not write code — detection and
reporting only.

## Step 1 — Resolve the target

Determine what to scan from the user's request:

- An explicit path (`src/order-service.ts`), a directory, or a named function/type.
- If the request is "this" / "this code" with no path, use the file or symbol currently in focus in the
  conversation. If genuinely ambiguous, ask one short clarifying question before scanning.

Read the target enough to confirm it exists and to scope the scan. For a directory, the detectors will
enumerate files themselves; for a single symbol, narrow to its body and immediate collaborators.

## Step 2 — Run the detection Workflow

Invoke the Workflow at `scripts/workflow.js`, passing the resolved target as `args`:

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/smell-scan/scripts/workflow.js", args: { target: "<resolved target>" } })
```

The Workflow runs five `smell-detector` agents in parallel — one per category (Bloaters, OO Abusers,
Change Preventers, Dispensables, Couplers) — each reporting only its own category's smells at confidence
>= 80. It then synthesizes all findings in plain JavaScript: ordering by severity and assigning each a
reference code. The Workflow returns `{ target, total, findings }`, where each finding carries `code`,
`severity`, `smell`, `category`, `file`, `line_range`, `evidence`, `confidence`, and `techniques`.

## Step 3 — Present the prioritized report

Render the findings ordered by severity (critical → high → medium → low). Each finding's reference code
(`B1`, `B2`, `OO1`, `CP1`, `D1`, `C1`, …) is a per-scan handle the user can pass straight to `refactor`.

For each finding, show:

```
### <code> · <smell> — <severity> (confidence <n>)
- File: <file>:<line_start>-<line_end>
- Evidence: <evidence>
- Techniques: <technique>, <technique>, …
```

Group by severity band; within a band, keep the Workflow's confidence ordering. Lead the report with a
one-line summary: total findings and the count per severity. If `total` is 0, say the target is clean of
high-confidence smells — do not pad with low-confidence noise.

Reference codes are assigned per scan, sequentially within each category prefix. They are stable only
within this report; re-scanning may renumber. The smell *types* and their detection criteria live in
`references/smell-catalog.md`.

## Step 4 — Offer to refactor

After the report, offer to apply a fix:

- The user can pass a reference code (`refactor B1`) or name a technique and location explicitly.
- Invoking the `refactor` skill carries the finding's technique, file, location, and smell context into a
  safe test → refactor → test → commit cycle. Recommend tackling findings highest-severity first, and
  one technique at a time.

Do not start refactoring from this skill. This skill detects and reports; `refactor` applies.

## References

Load on demand, only when needed:

- `references/smell-catalog.md` — the 26 smells: reference code, detection criteria, problem, and mapped
  techniques. Consult to explain a finding or justify a confidence call.
- `references/refactoring-techniques.md` — the 67 techniques: when to apply and mechanics. Consult to
  explain why a technique maps to a smell.
- `references/workflow.md` — the safe test → refactor → test → commit cycle that any fix should follow.

## Scope notes

- The taxonomy includes OOP-specific smells (marked in the catalog). For non-OOP targets, detectors do not
  invent class/inheritance smells — those surface only when real type-hierarchy code is present.
- Findings are evidence-based: every one cites a file and line range with a concrete observation. Silence
  (zero findings) is a valid, correct result for clean code.
