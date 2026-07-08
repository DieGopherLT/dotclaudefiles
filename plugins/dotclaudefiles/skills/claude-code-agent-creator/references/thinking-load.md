# Thinking Load: Choosing Model + Effort

Thinking load is the amount of reasoning capacity an agent pays for on every turn. It is set by two independent dials in the frontmatter:

- **`model`** — the capability ceiling (and the price per token).
- **`effort`** — how hard the model thinks *within* that ceiling.

Tuning these together is the single biggest lever on an agent's cost and latency. The guiding principle:

> The more **mechanical and deterministic** the task — and the **smaller** its scope — the lighter the model and the lower the effort. The more **open-ended, ambiguous, or long-horizon** the task, the heavier the model and the higher the effort.

A formatter that applies fixed rules needs none of the reasoning a security audit demands. Paying for the audit's thinking load on the formatter is pure waste; under-powering the audit produces a worthless result. Calibrate to the task, not to a default.

## The `model` dial

Prefer the bare alias — `haiku`, `sonnet`, or `opus` — over a pinned model ID. The alias always resolves to the latest model in that tier, so the agent gets capability and price improvements with zero maintenance. Pin a full ID (`claude-opus-4-8`) only when you need reproducibility against a specific version.

| Tier     | Alias    | Context | Effort support                          |
| -------- | -------- | :-----: | --------------------------------------- |
| Light    | `haiku`  | 200k    | none                                    |
| Balanced | `sonnet` | 1M      | full ladder (`xhigh` not recommended)   |
| Heavy    | `opus`   | 1M      | full ladder                             |

- **`haiku`** — Fastest and cheapest, no effort dial. Best for read-only search, classification, extraction, and high-volume mechanical work where reasoning adds no value.
- **`sonnet`** — Strong speed/intelligence balance, adaptive thinking. The sensible default for most coding and agentic work: review, testing, debugging, bounded-complexity refactors.
- **`opus`** — Highest capability. Reach for it when tasks are open-ended, long-horizon, or demand the deepest reasoning — architecture, cross-codebase migrations, orchestrators in ultracode workflows, and audits where a miss is unacceptable.

`model: inherit` (the default) adopts the parent session's model — use it for agents that should track whatever the caller is running rather than fixing a tier.

### Context window as a dial

Context window is a third property alongside capability and price. Haiku has a 200k window; Sonnet and Opus both offer 1M — a 5× advantage over the light tier that matters in specific scenarios:

- **Orchestrators in ultracode workflows** — an orchestrator that fans out to dozens of sub-agents must fit all their outputs in its own context before synthesizing. At 200k this becomes a hard ceiling; at 1M it is rarely a constraint.
- **Cross-codebase migrations and audits** — agents that must hold large file sets, diff output, and reasoning chains simultaneously will thrash at 200k.
- **Long-horizon agentic loops** — each tool call round-trip adds to the accumulated context. Agents expected to run 50+ tool calls before concluding need the larger window to avoid truncation mid-task.

Since Sonnet gained the 1M window, context volume alone no longer forces Opus: a long-horizon task within Sonnet's capability ceiling stays on Sonnet. The Opus decision is now purely about reasoning capability, not scope. The window argument only rules out Haiku for aggregation-heavy roles.

## The `effort` dial

Effort is a behavioral signal, not a hard token budget. It scales **all** tokens in a turn — reasoning, tool calls, preamble, and final text. Lower effort means fewer and more-consolidated tool calls, terser confirmations, and direct action; higher effort means deeper exploration before acting.

| Level    | Use when                                                                                      |
| -------- | --------------------------------------------------------------------------------------------- |
| `low`    | Simple, scoped, latency-sensitive work — lookups, classification, mechanical edits, fast loops. |
| `medium` | Balanced work — most implementers and hybrid "understand then act" tasks.                      |
| `high`   | Complex reasoning where quality outweighs cost. The default when effort is honored.            |
| `xhigh`  | Long-horizon agentic work, deep exploration, repeated tool calling. Best paired with `opus`; on `sonnet` it is supported but generally not recommended. |
| `max`    | Absolute ceiling — frontier problems where correctness matters more than cost or latency. On the balanced tier this level is usually a signal to move up a model, not up an effort (see cost crossover below). |

### Cost crossover

The real cost of an agent is rate × tokens consumed per task, not the rate alone. At high effort, a
cheaper-per-token model iterates more — more agentic turns, more output, more self-correction — and
that volume can overtake the superior model's price. Measured on the same complex agentic task,
Sonnet 5 at `max` burns up to 6× the agentic turns and ~40% more output tokens than Opus 4.8,
averaging ~$2.29 per task — roughly 15% **more** expensive than Opus, despite the lower base rate
($3/$15 vs $5/$25 per Mtok).

Practical guidance for Sonnet:

- **`low` / `medium`** — the cheap default: 60–70% cheaper per task than Opus.
- **`high`** — the sweet spot: close to Opus quality on tool-heavy tasks at moderate cost.
- **`max` (and `xhigh`)** — stops being a "budget Opus". If the task demands that level of
  reasoning, go straight to `opus` — you pay the same or less and get the higher capability ceiling.

The rule of thumb: **escalate the model before escalating the effort past `high` on a cheaper tier.**

### Model × effort support matrix

`effort` is honored only by models that support it. Setting an unsupported level is a no-op, not an error — so it silently does nothing. Keep this matrix in mind when pairing the two dials:

| Model    | `low` | `medium` | `high` | `xhigh` | `max` |
| -------- | :---: | :------: | :----: | :-----: | :---: |
| `haiku`  |   —   |    —     |   —    |    —    |   —   |
| `sonnet` |   ✓   |    ✓     |   ✓    |   ✓*    |   ✓   |
| `opus`   |   ✓   |    ✓     |   ✓    |    ✓    |   ✓   |

\* Supported but generally not recommended — the cost crossover makes `opus` the better buy at that level.

Three rules cover everything:

1. **Haiku has no effort dial.** Omit `effort` on a Haiku agent — it runs at its single baseline regardless.
2. **Sonnet supports the full ladder, but past `high` the cost crossover applies.** `xhigh` and `max` on Sonnet usually cost as much as (or more than) Opus per task — escalate the model instead.
3. **Opus supports the full ladder**, including `xhigh`.

This is itself a hint: the light tier exposes no effort knob *because* it is meant for deterministic work, while the full ladder lives on the heavy tier where ambiguity lives.

## Mapping by archetype

The four agent archetypes cluster naturally on the thinking-load spectrum. Treat these as starting points, then adjust for scope.

| Archetype     | Typical thinking load                | Default pairing            | Why                                                                                          |
| ------------- | ------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------- |
| Researcher    | Low — mostly mechanical retrieval     | `haiku` (no effort)        | Search and extraction are deterministic. Bump to `sonnet` + `medium` only if heavy synthesis is involved. |
| Implementer   | Medium — understand, decide, act      | `sonnet` + `medium`        | Edits balance mechanical change with tactical judgment. Drop to `low` for known patterns; escalate to `opus` + `high`/`xhigh` for multi-file or architectural changes. |
| Auditor       | High — judgment and subtle patterns   | `sonnet` + `high`          | Review is ambiguous; effort is what catches the subtle issue. Use `opus` + `max` when a miss is unacceptable (security, compliance). |
| Orchestrator  | High — planning and long-horizon work | `opus` + `high` or `xhigh` | Coordinating other agents demands planning and recovery across a long horizon — the heaviest end of the spectrum. |

## Decision matrix: task characteristics → (model, effort)

Two axes drive the choice: **determinism** (mechanical ↔ ambiguous) and **scope** (small ↔ long-horizon).

| Task                                              | Model    | Effort           | Rationale                                                              |
| ------------------------------------------------- | -------- | ---------------- | --------------------------------------------------------------------- |
| Search / extract / classify (read-only)            | `haiku`  | —                | Mechanical; no reasoning to pay for.                                   |
| Apply a known pattern across files (formatting, rename) | `sonnet` | `low`            | Cross-file coordination, but no judgment.                             |
| Fix a specific bug; write tests for a module       | `sonnet` | `medium`         | Mechanical search plus a tactical decision.                          |
| Code / architecture review                         | `sonnet` | `high`           | Open-ended judgment; effort surfaces subtle issues.                   |
| Security / compliance audit                        | `opus`   | `max`            | A missed finding is a disaster; cost is irrelevant.                   |
| Cross-codebase migration, redesign                 | `opus`   | `xhigh`          | Long-horizon, high-stakes, needs planning and recovery.              |

## Setting it in frontmatter

```yaml
---
name: code-reviewer
description: Reviews code for quality and security. Use proactively after edits to auth or input-handling logic.
tools: Read, Grep, Glob, Bash
model: sonnet      # bare alias → always the latest Sonnet
effort: high       # honored by sonnet; overrides session effort
---
```

- `model` resolution order (first match wins): env var `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation parameter → frontmatter `model` → main session model.
- `effort` overrides the session-level effort for this agent only, and is honored only by models that support it (see the matrix).

## Anti-patterns

- **Defaulting everything to `opus` + `max`.** It feels safe and quietly burns 5x the cost and a multiple of the latency on tasks a lighter pairing would nail. Calibrate down.
- **Setting `effort` on a Haiku agent.** It is ignored. If the task genuinely needs an effort dial, it needs at least Sonnet.
- **Using `sonnet` + `max` (or `xhigh`) as a budget Opus.** The cost crossover means the per-task cost can exceed Opus with equal or lower quality. If you need the ceiling, change the model, not the effort.
- **Under-powering an orchestrator or architect with `haiku`.** The capability ceiling is too low for planning and long-horizon coordination, no matter the effort — and Haiku has no effort to raise anyway.
- **Pinning a full model ID without a reason.** It freezes the agent on one version and adds maintenance. Use the bare alias unless reproducibility demands a pin.
- **Assigning an orchestrator or long-horizon agent to Haiku when it must aggregate large sub-agent outputs.** Its 200k window becomes a hard ceiling before synthesis is possible. Aggregation-heavy roles need at least Sonnet's 1M window.
- **Reaching for Opus solely because "the task is complex" or "the task is long".** Complexity is about reasoning, not context volume — and Sonnet now shares Opus's 1M window, so scope alone never justifies the jump. Escalate to Opus only when the task exceeds Sonnet's capability ceiling.
