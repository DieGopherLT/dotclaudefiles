---
name: stabilize
description: >
  Esta skill debe usarse cuando el usuario pide "stabilize", "estabiliza los flujos",
  "cosecha las sesiones", "harvest flows", "mina los transcripts", "convierte lo repetido
  en skill", o — el disparador principal — cuando un hook de Stop anuncia que la cola de
  stabilize alcanzó su umbral de transcripts cosechables. Tambien usarla si el usuario
  menciona querer extraer flujos mecanicos repetidos (migraciones, wiring, boilerplate)
  de sesiones pasadas y convertirlos en skills o rules del proyecto. Mina los transcripts
  encolados con agentes transcript-digester en paralelo, cruza sesiones buscando flujos y
  convenciones recurrentes, verifica cada candidato con practice-verifier y materializa
  solo los confirmados como recursos del proyecto. Ejecutable en background.
---

# Stabilize

You are about to mine past session transcripts for knowledge that repeats — and turn the survivors into permanent project resources. The premise of this harness: anything the agent does mechanically session after session (a migration flow, dependency wiring, boilerplate with a fixed shape) should become a skill or rule so future sessions get it for free instead of re-deriving it.

Two guardrails shape everything below:

1. **Repetition measures habit, not correctness.** Every candidate passes through the practice-verifier agent before touching disk. Stabilizing a bad habit compounds exactly like stabilizing a good one — the verifier is the sign check.
2. **The destination is decided by classification, not by this skill.** remember (push, in-the-moment) and stabilize (pull, cross-session mining) are two capture channels converging on the same routing: the decision tree in `../remember/references/storage-decision-guide.md`.

## Step 1 — Resolve the queue

The session-harvest hook maintains one queue per repository at:

```
~/.claude/claude-management/harvest/<repo-key>.json
```

where `<repo-key>` is the repo root path with slashes as dashes, and the repo root comes from `git rev-parse --path-format=absolute --git-common-dir` (worktree sessions share the main repo's queue). Resolve it the same way from the current cwd.

Read `.pending` from the queue file. If the file is missing or the array is empty, report there is nothing to stabilize and stop — do not go hunting for transcripts outside the queue; the hook already classified which sessions are worth mining.

## Step 2 — Digest each transcript in parallel

Launch one `transcript-digester` agent per pending transcript, all in parallel — they are read-only and share nothing. Pass each agent:

- The transcript's absolute path
- The project root

Each returns a digest JSON (`flows`, `conventions`, `session_summary`) — the contract is in `references/digest-schema.md`. A digest with empty arrays is a valid result, not a failure. Drop agents that error out and continue with the rest; note the dropped transcript in the final report.

## Step 3 — Synthesize candidates across sessions

This is the step where cross-session mining actually happens, and it runs in your context — you have all digests side by side.

A **candidate** is a flow or convention that shows up in **2 or more distinct sessions**, or 3+ times within a single session. Match by intent and shape, not by literal strings — "add DB migration" and "create schema migration" digested from different sessions are the same flow if their steps have the same shape. The cross-session bar exists because one session's repetition may be a one-off task; the same mechanics resurfacing in independent sessions is what "this will happen again" actually looks like.

When merging occurrences into one candidate, keep the union of observed steps and note discrepancies — a step present in one session and absent in another is worth flagging for the verifier.

## Step 4 — Verify every candidate

Launch one `practice-verifier` agent per candidate, in parallel. Pass the candidate (flow or claim), its type hints, and the project root. The verifier returns a verdict JSON (contract also in `references/digest-schema.md`).

Materialization rule — apply it strictly:

- `confirmed` with confidence >= 80 → materialize as-is
- `adjusted` with confidence >= 80 → apply the listed corrections, then materialize
- `refuted`, or any verdict below 80 → do NOT materialize; report it with the verifier's evidence

Do not argue with a refutation because the pattern appeared often. Frequency got the candidate this far; correctness decides the rest.

## Step 5 — Materialize through remember's routing

For each surviving candidate, classify its destination with the decision tree in `../remember/references/storage-decision-guide.md`:

- **Executable multi-step procedure** (flows) → `.claude/skills/<name>/SKILL.md`, following that guide's Skill destination spec — including its third-person description format
- **Convention tied to file types or directories** → `.claude/rules/<topic>.md` with a `paths` frontmatter scoped to the candidate's `applies_to` glob
- **Project-wide orientation** (rare from mining, but possible) → the project's CLAUDE.md

Name resources by intent (`prisma-migrations`, not `flow-1`). If a resource with the same purpose already exists, merge into it instead of creating a sibling — an update to an existing rule beats a near-duplicate.

## Step 6 — Consume the queue and report

Rewrite the queue file: empty `pending`, set `last_stabilize` to the current timestamp. The queue is a work list, not a log — leaving entries behind would re-mine the same transcripts next time.

Report to the user:

- Resources created or updated, with paths
- Candidates refuted or below threshold, each with the verifier's reason — these are as informative as the survivors
- Transcripts that failed to digest, if any

## Constraints

- Never commit or push the materialized resources — leave them in the working tree for the user's normal git flow.
- Do not materialize anything that skipped verification, regardless of how obvious it looks.
- This skill is background-friendly: it needs no interaction until the final report.
