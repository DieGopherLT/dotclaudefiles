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
persist them as a source-of-truth (SoT) file per domain, report each finding with its location, confidence,
and mapped techniques, then offer to apply a fix via the `refactor` skill.

This skill is a **scale dispatcher**: it picks its execution strategy by how many physical domains the
target spans. A single-domain target runs inline — you spawn the 5 category detectors directly, no
orchestration overhead. A multi-domain target fans out through a `Workflow` that pipelines each domain
through its own detector batch. Either way, detection and reporting only — this skill never edits code.

## Step 1 — Resolve the target

Determine what to scan from the user's request:

- An explicit path (`src/order-service.ts`), a directory, or a named function/type.
- If the request is "this" / "this code" with no path, use the file or symbol currently in focus in the
  conversation. If genuinely ambiguous, ask one short clarifying question before scanning.

## Step 2 — Partition into domains

A **domain** is a top-level module folder under a conventional root: `src/`, `packages/`, `plugins/`, or
the repo root itself when none of those roots is present. Map the resolved target UP to the domain(s) that
contain it:

- A single file or a nested directory maps to the one top-level folder that contains it.
- If the target itself IS one of those roots (e.g. the user asks to scan all of `plugins/`), every
  immediate child directory of that root is its own domain.

`domainCount` is the number of distinct top-level domains the target resolves to. The domain identifier
used everywhere downstream (SoT filename, `domain` field, `path` field on findings) is the **repo-relative
path** (e.g. `src/orders`, `plugins/refactoring-guru`) — convert to repo-relative before persisting even
though absolute paths are what gets passed to the Workflow in Step 3.

If `domainCount` is 0 (the target does not resolve to anything scannable), tell the user there is nothing
to scan and stop here.

## Step 3 — Dispatch by domain count

**One domain — run inline.** Do not invoke the `Workflow` tool for a single domain; that would spin up
orchestration for work you can do directly. Launch the 5 `smell-detector` agents yourself via the `Agent`
tool, foreground, no `name`, one per category (`bloaters`, `oo-abusers`, `change-preventers`,
`dispensables`, `couplers`), each scoped to this domain. Once all 5 return, synthesize their findings
by hand using **exactly** these rules — they must stay byte-identical to the Workflow's synthesis logic
in `scripts/workflow.js` so a domain scanned inline or via Workflow always produces the same SoT file:

1. Merge all 5 detectors' `findings` arrays into one list for this domain.
2. Rename each finding's `file` field to `path`.
3. Add `technique`: the first element of that finding's `techniques` array (the most-direct one). Keep
   `techniques` off the final finding object — the SoT schema (Step 4) carries `technique` singular only.
4. Add `severity`, derived from `confidence`: `>= 95` → `critical`, `>= 90` → `high`, `>= 85` → `medium`,
   otherwise `low`.
5. Add `cross_cutting: true` iff `smell` is exactly one of `Shotgun Surgery`, `Inappropriate Intimacy`, or
   `Divergent Change` — `false` for every other smell.

**Two or more domains — dispatch the Workflow.** Invoke:

```
Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/smell-scan/scripts/workflow.js", args: { domains: ["<absolute path to domain 1>", "<absolute path to domain 2>", ...] } })
```

The Workflow pipelines each domain through its own 5-detector batch and applies the identical synthesis
rules above (see the script's `synthesizeDomain`), returning `{ domains: [{ domain, total, findings }],
total }` with no filesystem writes and no `code` assigned yet — codes are assigned next, over the
aggregated set.

## Step 4 — Assign codes and persist

Whether Step 3 ran inline (one domain) or via Workflow (many), you now hold one or more domains' worth of
findings. Assign reference codes **globally**, over the full aggregated set across every domain in this
scan, so a code is never ambiguous:

- Sort findings by `confidence` descending.
- Assign `code` sequentially per category prefix — `B` (Bloaters), `OO` (OO Abusers), `CP` (Change
  Preventers), `D` (Dispensables), `C` (Couplers) — counting across all domains, not restarting per domain.

Capture one `scanned_at` ISO 8601 timestamp for this whole scan. For each domain, slug its repo-relative
path (`/` → `-`) and write its findings to `.claude/refactoring-guru/findings/<domain-slug>.json`,
conforming to:

```json
{
  "domain": "src/orders",
  "scanned_at": "2026-06-30T14:00:00Z",
  "total": 2,
  "findings": [
    {
      "code": "B1",
      "smell": "Long Method",
      "category": "Bloaters",
      "path": "src/orders/order-service.ts",
      "line_range": [45, 120],
      "evidence": "75-line function performs validation, transformation and persistence",
      "confidence": 92,
      "severity": "high",
      "technique": "Extract Method",
      "resolution_plan": "Extract validation (45-60), transformation (61-95), persistence (96-120) into three named functions; the body becomes three calls.",
      "cross_cutting": false
    }
  ]
}
```

## Step 5 — Present the prioritized report

Render the findings ordered by severity (critical → high → medium → low). Each finding's reference code
(`B1`, `B2`, `OO1`, `CP1`, `D1`, `C1`, …) is a per-scan handle the user can pass straight to `refactor`.

For each finding, show:

```
### <code> · <smell> — <severity> (confidence <n>)
- File: <path>:<line_start>-<line_end>
- Evidence: <evidence>
- Technique: <technique>
```

When `domainCount` > 1, also show the domain each finding belongs to, grouped or annotated so the user can
tell which SoT file it lives in. Group by severity band; within a band, keep confidence ordering. Lead the
report with a one-line summary: total findings and the count per severity. If `total` is 0 across every
domain, say the target is clean of high-confidence smells — do not pad with low-confidence noise.

Reference codes are assigned per scan, sequentially within each category prefix, globally across every
domain scanned. They are stable only within this scan; re-scanning may renumber. The smell *types* and
their detection criteria live in `references/smell-catalog.md`.

## Step 6 — Offer to refactor

After the report, offer to apply a fix:

- The user can pass a reference code (`refactor B1`) or name a technique and location explicitly.
- Invoking the `refactor` skill resolves the code unambiguously — even across a multi-domain scan, since
  codes are globally unique — and carries the finding's technique, file, location, and smell context into
  a safe test → refactor → test → commit cycle. Recommend tackling findings highest-severity first, and
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
- SoT files under `.claude/refactoring-guru/findings/` are transient analysis artifacts, gitignored — they
  are not meant to be committed.
