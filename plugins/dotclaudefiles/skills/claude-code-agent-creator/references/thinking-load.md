# Thinking Load: Choosing `model` + `effort`

Two dials set how much reasoning an agent pays for per turn:

- **`model`** — capability ceiling and price per token.
- **`effort`** — how much work the model does within that ceiling: thinking depth, number of tool calls, verification, how far it pushes before reporting back. It scales *all* output tokens, not just thinking.

Principle: **mechanical and small → light model, low effort; open-ended and long-horizon → heavy model, high effort.** Calibrate to the task, not to a default.

Prices and benchmarks below are as of September 2026. Re-verify at https://platform.claude.com/docs/en/about-claude/pricing when a new model ships.

## The four tiers

Prefer the bare alias — it resolves to the latest model in the tier with zero maintenance. Pin a full ID (`claude-opus-5`) only for reproducibility.

| Alias | Current model | Context | Max output | Input $/MTok | Output $/MTok | Cache read $/MTok | Effort levels |
| --- | --- | :-: | :-: | :-: | :-: | :-: | --- |
| `haiku` | Haiku 4.5 | 200K | 64K | 1 | 5 | 0.10 | none |
| `sonnet` | Sonnet 5 | 1M | 128K | 2 | 10 | 0.20 | low, medium, high, xhigh, max |
| `opus` | Opus 5 | 1M | 128K | 5 | 25 | 0.50 | low, medium, high, xhigh, max |
| `fable` | Fable 5.1 | 1M | 128K | 10 | 50 | 0.25 | low, medium, high, xhigh, max |

Per-token ratios: sonnet : opus : fable = **1 : 2.5 : 5**. Haiku is 0.5× Sonnet.

Notes:
- Sonnet 5's $2/$10 was announced as introductory through Aug 31, 2026 and was made permanent on Aug 10, 2026. Older material quoting $3/$15 is stale.
- Fable 5.1 cache reads cost 2.5 % of input (every other model: 10 %). This matters for long agentic loops that re-read a large stable prefix — Anthropic estimates ~25 % lower cost on typical Fable workloads, up to ~45 % on cache-heavy ones.
- Models from Opus 4.7 onward (including Sonnet 5, Opus 5, Fable 5.x) use a tokenizer that yields up to ~35 % more tokens for the same text (heaviest on code and structured data). Same rate, more tokens. Do not reuse token estimates from Sonnet 4.6-era measurements.

### Context window as a dial

Haiku's 200K window is the only hard ceiling. Sonnet, Opus and Fable share 1M, so context volume alone never justifies moving up from Sonnet. A sub-agent's window is sized by its own model, not the parent's — an orchestrator that aggregates many sub-agent outputs must not be Haiku.

## The `effort` dial

Effort is a behavioral signal, not a token budget. The only hard cap is `max_tokens` (API-level). Lower effort → fewer, more consolidated tool calls, no preamble, terser output. Higher effort → plans first, reads more files, verifies, double-checks.

| Level | Use when |
| --- | --- |
| `low` | Scoped, latency-sensitive: lookups, classification, mechanical edits. Anthropic's docs name "subagents" as the typical `low` use case. |
| `medium` | Balanced implementers. On Sonnet 5, `medium` ≈ Sonnet 4.6 at `high`. |
| `high` | Default on the API and on Claude Code for Haiku / Sonnet / Opus. Omitting the field inherits the session level, which is `high` unless the user changed it. Exception: Fable in Claude Code has no user-configurable default; Claude picks the effort per step. |
| `xhigh` | Long-horizon agentic work, repeated tool calling, deep exploration. Recommended top level on Sonnet 5 for hard coding; the sweet spot on Opus and Fable. |
| `max` | No constraint on token spending. Frontier problems only. On Sonnet: a signal to change model. On Fable: rarely worth it over `xhigh`. |

An unsupported level is not an error: Claude Code silently runs the highest supported level at or below it. On Haiku that means no effort at all — omit the field.

## Cost per task, not cost per token

Per-token rate × tokens consumed = real cost. At high effort a cheaper model iterates more (more turns, more output) and can overtake a pricier model that finishes in fewer steps. The Artificial Analysis Intelligence Index measures exactly this. The index is recomputed often and absolute numbers shift between versions; the figures below are from index v4.3 (live page, Sep 11, 2026), `max` effort unless noted. Re-check https://artificialanalysis.ai before quoting them.

| Model (effort) | Intelligence Index | Cost per task (USD) |
| --- | :-: | :-: |
| Sonnet 5 (`max`) | 38 | not published at v4.3 (was 1.53 at v4.1) |
| Opus 5 (`max`) | 51 | 5.86 |
| Fable 5 (`max`) | 50 | not published |
| Fable 5.1 (`low`) | 47 | 2.37 |
| Fable 5.1 (`medium`) | 49 | 2.98 |
| Fable 5.1 (`high`) | 51 | 3.91 |
| Fable 5.1 (`xhigh`) | 53 | 5.98 |
| Fable 5.1 (`max`) | 53 | 7.63 |

Reading the table (the conclusions are stable across index versions; the numbers are not):

- **Sonnet at `max` is the wrong buy.** It lands well below Opus 5, and Artificial Analysis reports Opus 5 at `high`/`xhigh` outperforming Sonnet 5 (`max`) at similar or lower cost per task. Rule: **Sonnet up to `xhigh`; if you want `max`, switch to `opus` + `high`/`xhigh`.**
- **Fable 5.1's premium is real**: about 1.3× Opus 5 per task at `max`, for +2 points. On Fable, `xhigh` scores the same as `max` for roughly 22 % less. Fable earns its price only on long, multi-step work that Opus and Sonnet cannot finish at any effort (Anthropic's own framing).
- Effort spread on Fable 5.1: about 3× cost between `low` and `max`, for +6 points. The dial is wide — use it.

## Subscription users (Pro / Max): limits, not dollars

If the user runs Claude Code on a subscription, the cost that matters is **share of the 5-hour session window and the weekly cap**, both shared across all models and across claude.ai and Claude Code. Anthropic publishes only relative anchors (Pro ≥ 5× Free per session; Max 5x = 5× Pro; Max 20x = 20× Pro) and no per-model multipliers — but the per-token price ratios above (1 : 2.5 : 5) are the best available proxy for how fast each tier drains the window, compounded by the tokenizer factor.

| Plan | `haiku` / `sonnet` / `opus` | `fable` |
| --- | --- | --- |
| Pro | included; Sonnet is the default model | **not included** — runs on pay-as-you-go usage credits; a `model: fable` sub-agent prompts for credits (once per interactive session) or falls back. In `-p` / SDK runs there is no prompt: credits are billed silently |
| Max (5x / 20x) | included; Opus is the default model | included up to **50 % of the weekly limit**; beyond that → usage credits or switch model. Anthropic publishes no per-model drain rate; assume the 5× token price ratio |

Practical rules for subscribers:

1. **Pro: never `model: fable` in a sub-agent.** Fable is a manual, main-session decision when the user has topped up credits.
2. **Max: at most one Fable agent per workflow** (the orchestrator or architect), and only when Opus at `xhigh` has been tried and fell short. A single heavy Fable agentic session can consume a large fraction of a 5-hour window.
3. **Route volume to Haiku / Sonnet.** Researchers and explorers on `haiku` (or `sonnet` + `low`) are the biggest lever on weekly consumption because they are the agents that run most often.
4. **Use `effort: medium` on Sonnet implementers** — same quality as last generation's `high`, fewer tokens.
5. **`maxTurns`** is the subscriber's hard brake. Set it on every autonomous worker; the output is marked partial and can be resumed instead of silently burning the window.
6. `experimental.cacheTtl: 1h` is ignored while the subscription is on usage credits — do not rely on it there.

## Decision matrix: task → (model, effort)

Archetype defaults live in `SKILL.md`; this is the finer grain by task.

| Task | Model | Effort | Why |
| --- | --- | --- | --- |
| Search / extract / classify, read-only | `haiku` | — | mechanical; nothing to reason about |
| Apply a known pattern across files (rename, formatting) | `sonnet` | `low` | coordination without judgment |
| Fix a scoped bug; write tests for a module | `sonnet` | `medium` | ≈ last generation's `high`, cheaper |
| Code / architecture review | `sonnet` | `high` | open-ended judgment |
| Hard multi-file implementation | `sonnet` | `xhigh` | Sonnet's ceiling before switching model |
| Security / compliance audit | `opus` | `high` → `xhigh` | a missed finding is expensive; Opus at `high` already beats Sonnet at `max` per task |
| Cross-codebase migration, redesign, orchestration | `opus` | `xhigh` | long-horizon planning and recovery |
| Multi-hour autonomous run Opus cannot finish | `fable` | `xhigh` | the only case that justifies 5× Sonnet's rate; `max` adds nothing measurable for ~28 % more |

A frontmatter `effort` overrides the session level for this agent only. Extended thinking is inherited from the session; there is no per-agent thinking switch.

## Anti-patterns not covered above

- **Choosing Opus because the task is "long".** Length is context; Sonnet has 1M too. Choose Opus for reasoning depth, Fable for what Opus cannot finish.
- **Reusing effort settings from a previous generation.** Anthropic recommends a fresh effort sweep per model; Sonnet 5's levels shifted one notch relative to 4.6.
