# Thinking Load: Choosing Model + Effort

Thinking load is the amount of reasoning capacity an agent pays for on every turn. It is set by two independent dials in the frontmatter:

- **`model`** — the capability ceiling (and the price per token).
- **`effort`** — how hard the model thinks *within* that ceiling.

Tuning these together is the single biggest lever on an agent's cost and latency. The guiding principle:

> The more **mechanical and deterministic** the task — and the **smaller** its scope — the lighter the model and the lower the effort. The more **open-ended, ambiguous, or long-horizon** the task, the heavier the model and the higher the effort.

A formatter that applies fixed rules needs none of the reasoning a security audit demands. Paying for the audit's thinking load on the formatter is pure waste; under-powering the audit produces a worthless result. Calibrate to the task, not to a default.

## The `model` dial

Prefer the bare alias — `haiku`, `sonnet`, or `opus` — over a pinned model ID. The alias always resolves to the latest model in that tier, so the agent gets capability and price improvements with zero maintenance. Pin a full ID (`claude-opus-4-8`) only when you need reproducibility against a specific version.

| Tier     | Alias    | Profile                                                                                      | Reach for it when                                                                                 |
| -------- | -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Light    | `haiku`  | Fastest, cheapest, smaller context. No effort control.                                       | Read-only search, classification, extraction, high-volume mechanical work where quality margins are thin. |
| Balanced | `sonnet` | Strong speed/intelligence balance, large context, adaptive thinking. The sensible default.   | Most coding and agentic work: review, testing, debugging, bounded-complexity refactors.           |
| Heavy    | `opus`   | Highest capability, long-horizon coherence, full effort ladder. Slowest and most expensive. | Architecture, cross-codebase migrations, novel problem-solving, audits where a miss is unacceptable. |

`model: inherit` (the default) adopts the parent session's model — use it for agents that should track whatever the caller is running rather than fixing a tier.

## The `effort` dial

Effort is a behavioral signal, not a hard token budget. It scales **all** tokens in a turn — reasoning, tool calls, preamble, and final text. Lower effort means fewer and more-consolidated tool calls, terser confirmations, and direct action; higher effort means deeper exploration before acting.

| Level    | Use when                                                                                      |
| -------- | --------------------------------------------------------------------------------------------- |
| `low`    | Simple, scoped, latency-sensitive work — lookups, classification, mechanical edits, fast loops. |
| `medium` | Balanced work — most implementers and hybrid "understand then act" tasks.                      |
| `high`   | Complex reasoning where quality outweighs cost. The default when effort is honored.            |
| `xhigh`  | Long-horizon agentic work, deep exploration, repeated tool calling. **Opus only.**            |
| `max`    | Absolute ceiling — frontier problems where correctness matters more than cost or latency.      |

### Model × effort support matrix

`effort` is honored only by models that support it. Setting an unsupported level is a no-op, not an error — so it silently does nothing. Keep this matrix in mind when pairing the two dials:

| Model    | `low` | `medium` | `high` | `xhigh` | `max` |
| -------- | :---: | :------: | :----: | :-----: | :---: |
| `haiku`  |   —   |    —     |   —    |    —    |   —   |
| `sonnet` |   ✓   |    ✓     |   ✓    |    ✗    |   ✓   |
| `opus`   |   ✓   |    ✓     |   ✓    |    ✓    |   ✓   |

Three rules cover everything:

1. **Haiku has no effort dial.** Omit `effort` on a Haiku agent — it runs at its single baseline regardless.
2. **Sonnet does not support `xhigh`.** Use `high` or jump to `max`; `xhigh` is silently ignored.
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
- **Setting `xhigh` on Sonnet.** Silently ignored. Use `high`, or move to `opus` if you truly need `xhigh`.
- **Under-powering an orchestrator or architect with `haiku`.** The capability ceiling is too low for planning and long-horizon coordination, no matter the effort — and Haiku has no effort to raise anyway.
- **Pinning a full model ID without a reason.** It freezes the agent on one version and adds maintenance. Use the bare alias unless reproducibility demands a pin.
