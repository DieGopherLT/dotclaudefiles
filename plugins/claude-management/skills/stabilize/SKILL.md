---
name: stabilize
description: >
  Esta skill debe usarse cuando el usuario pide "stabilize", "estabiliza los flujos",
  "cosecha las sesiones", "harvest flows", "mina los transcripts", "convierte lo repetido
  en skill", o cuando decide actuar sobre el aviso del hook session-harvest de que la cola
  alcanzo su umbral — ese aviso es una notificacion al usuario, y correr esta skill es
  siempre decision suya. Tambien usarla si el usuario
  menciona querer extraer flujos mecanicos repetidos (migraciones, wiring, boilerplate)
  de sesiones pasadas y convertirlos en skills o rules del proyecto ("cosecha los flujos",
  "estabiliza lo aprendido"). Mina los transcripts
  encolados con agentes transcript-digester en paralelo, cruza sesiones buscando flujos y
  convenciones recurrentes ademas de correcciones explicitas del usuario, verifica cada
  candidato con practice-verifier y materializa solo los confirmados como recursos del
  proyecto o memoria de feedback. Ejecutable en background.
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

The hook's threshold announcement is a user-facing notification (systemMessage) — it never lands in your context, so **the primary path is reconstruction**. The single source of truth for the key derivation is the `queue_file_for_repo` function in this plugin's `hooks/session-harvest/session-harvest.sh` — read it and replicate it exactly. Do not derive the key from memory or from this paragraph: the hook owns the format (repo root from the git common dir, worktrees resolving to the main repo's queue, non-git cwd falling back to the cwd itself).

Shortcut: if the user pasted the queue path from the hook's notification, use it verbatim instead of re-deriving it.

Read `.pending` from the queue file and record the list you got — Step 6 removes exactly these entries, nothing else. If the file is missing or the array is empty, report there is nothing to stabilize and stop — do not go hunting for transcripts outside the queue; the hook already classified which sessions are worth mining.

## Step 2 — Digest each transcript in parallel

One `transcript-digester` agent per pending transcript, all in parallel — they are read-only and share nothing. Pass each agent the transcript's absolute path and the project root.

Prefer running this fan-out through the **Workflow tool**: its `agent()` accepts a JSON Schema, which forces the sub-agent through StructuredOutput and validates the digest at the tool-call layer (with automatic retry on mismatch) — malformed JSON never reaches you. This skill instructing the call counts as explicit Workflow opt-in. Sketch:

```javascript
export const meta = {
  name: 'stabilize-digest',
  description: 'Digest harvested session transcripts in parallel',
  phases: [{ title: 'Digest' }],
}
// DIGEST_SCHEMA: declare as a const — the JSON Schema form of the digest
// contract in references/digest-schema.md (flows, conventions, user_corrections, session_summary)
const digests = await parallel(args.transcripts.map(path => () =>
  agent(`Digest the Claude Code session transcript at ${path}. Project root: ${args.projectRoot}.`,
        { agentType: 'claude-management:transcript-digester', schema: DIGEST_SCHEMA, phase: 'Digest' })))
return digests.filter(Boolean)
```

If the Workflow tool is unavailable in the session, fall back to launching the agents with the Agent tool in parallel and parsing each final message as raw JSON — the agents are prompted to emit it fence-free either way.

**Pass `transcripts` as a real JSON value in `args`, never as a JSON-encoded string.** A production run of this exact fan-out failed with `undefined is not an object (evaluating 'args.transcripts.map')` because the invocation serialized `args` to a string (`args: "{\"transcripts\":...}"`) instead of passing the object itself — the script then saw `args` as a string, so `args.transcripts` was `undefined`. The `Workflow` tool description already warns about this; the fix is on the calling side, not in the script above. If you find yourself reaching for a JSON.stringify-style workaround, inline the transcript list as a `const` in the script body instead of routing it through `args`.

Each returns a digest JSON (`flows`, `conventions`, `user_corrections`, `session_summary`) — the contract is in `references/digest-schema.md`. A digest with empty arrays is a valid result, not a failure. Drop agents that error out and continue with the rest; note the dropped transcript in the final report. Failed transcripts are consumed along with the rest in Step 6 — they are not retried, because a transcript that failed to digest once will almost certainly fail again and would clog the queue.

A large fan-out can return a combined result too big for the task-notification to show in full — the notification gets truncated in context. That is expected, not a failure: the notification's own `<diagnostics>` block gives the path to the full `.output` file and the per-agent `journal.jsonl`. Read one of those before concluding a digest is missing or malformed.

## Step 3 — Synthesize candidates across sessions

This is the step where cross-session mining actually happens, and it runs in your context — you have all digests side by side.

A **candidate** is a flow or convention that shows up in **2 or more distinct sessions**, or 3+ times within a single session. Match by intent and shape, not by literal strings — "add DB migration" and "create schema migration" digested from different sessions are the same flow if their steps have the same shape. The cross-session bar exists because one session's repetition may be a one-off task; the same mechanics resurfacing in independent sessions is what "this will happen again" actually looks like.

When merging occurrences into one candidate, keep the union of observed steps and note discrepancies — a step present in one session and absent in another is worth flagging for the verifier.

This repetition bar applies only to `flows` and `conventions` — patterns inferred by observing behavior, where repetition is the only evidence that it's a habit rather than a one-off. Every entry in `user_corrections` is its own candidate regardless of how many times it appears, in this session or across others: it is feedback the user already gave directly, not something you inferred. Dedupe near-identical corrections across sessions (same rule, different wording) into one candidate, but never hold one back waiting for a second occurrence.

## Step 4 — Verify every candidate

Launch one `practice-verifier` agent per candidate, in parallel. Pass the candidate (the full flow or convention, with its steps or claim and its `applies_to`/`files_touched_pattern` glob) and the project root — the verifier does its own external/internal classification per claim. It returns a verdict JSON (contract also in `references/digest-schema.md`). Same mechanism as Step 2: prefer a Workflow fan-out with a VERDICT_SCHEMA const so StructuredOutput validates each verdict; Agent-tool parallel with raw-JSON parsing is the fallback.

Materialization rule — apply it strictly. The confidence bar is owned by the verifier's own contract (`agents/practice-verifier.md`), not by this skill:

- `confirmed` at or above the verifier's actionable bar → materialize as-is
- `adjusted` at or above the bar → apply the listed corrections, then materialize
- `refuted`, or anything below the bar → do NOT materialize; report it with the verifier's evidence

Do not argue with a refutation because the pattern appeared often. Frequency got the candidate this far; correctness decides the rest.

For `user_corrections` candidates, the verifier's job is different: it is not judging whether the correction was right — the user already decided that — but whether the corrected practice is still current (the corrected code, tool, or convention hasn't since changed in a way that makes the correction stale). Pass this framing to the verifier explicitly so it doesn't re-litigate the correction itself.

## Step 5 — Materialize through remember's routing

For each surviving candidate, classify its destination with the decision tree in `../remember/references/storage-decision-guide.md`:

- **Executable multi-step procedure** (flows) → `.claude/skills/<name>/SKILL.md`, following that guide's Skill destination spec — including its third-person description format
- **Convention tied to file types or directories** → `.claude/rules/<topic>.md` with a `paths` frontmatter scoped to the candidate's `applies_to` glob
- **Project-wide orientation** (rare from mining, but possible) → the project's CLAUDE.md
- **Explicit user correction** (`user_corrections`) → Memory, `type: feedback`, per the guide's Memory destination spec

Name resources by intent (`prisma-migrations`, not `flow-1`). If a resource with the same purpose already exists, merge into it instead of creating a sibling — an update to an existing rule beats a near-duplicate.

## Step 6 — Consume the queue and report

Rewrite the queue file: remove from `pending` exactly the paths you read in Step 1 (a `jq` filter against your recorded list), and set `last_stabilize` to the current timestamp. Do NOT empty the array wholesale — this skill runs long, and the harvest hook may have queued new transcripts while it worked; wiping `pending` would silently drop them un-mined. Consumed entries never come back: the queue is a work list, not a log.

Report to the user:

- Resources created or updated, with paths
- Candidates refuted or below threshold, each with the verifier's reason — these are as informative as the survivors
- Transcripts that failed to digest, if any

## Constraints

- Never commit or push the materialized resources — leave them in the working tree for the user's normal git flow.
- Do not materialize anything that skipped verification, regardless of how obvious it looks.
- This skill is background-friendly: it needs no interaction until the final report.
