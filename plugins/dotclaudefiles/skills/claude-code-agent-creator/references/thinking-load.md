# Thinking Load: Choosing `model` + `effort`

Two dials set how much reasoning an agent pays for per turn:

- **`model`**: capability ceiling and price per token.
- **`effort`**: how much work the model does within that ceiling: thinking depth, number of tool calls, verification, how far it pushes before reporting back. It scales *all* output tokens, not just thinking.

Principle: **mechanical and small, light model and low effort; open-ended and long-horizon, heavy model and higher effort.** Calibrate to the task, not to a default. The data behind every number here is in `cost-intelligence-research.md` (compiled 2026-10-09); re-verify prices at https://platform.claude.com/docs/en/about-claude/pricing when a model ships.

## The four tiers

Prefer the bare alias; it resolves to the latest model in the tier with zero maintenance. Pin a full ID (`claude-opus-5-5`) only for reproducibility.

| Alias | Current model | Context | Max output | Input $/MTok | Output $/MTok | Cache read $/MTok | Effort levels | Default effort |
| --- | --- | :-: | :-: | :-: | :-: | :-: | --- | :-: |
| `haiku` | Haiku 5.5 | 1M | 128K | 0.10 (0.50 over 100K prompt) | 0.50 (2.50 over 100K) | 0.01 (0.05) | low, medium, high, xhigh, max | medium |
| `sonnet` | Sonnet 5.5 | 1M | 128K | 2 | 10 | 0.10 | low, medium, high, xhigh, max | medium |
| `opus` | Opus 5.5 | 1M | 128K | 4 | 20 | 0.20 | low, medium, high, xhigh, max | medium |
| `fable` | Fable 5.1 | 1M | 128K | 10 | 50 | 0.25 | low, medium, high, xhigh, max | high |

Per-token ratios, sonnet : opus : fable = **1 : 2 : 5**. Haiku is 0.05x Sonnet while the prompt stays under 100K tokens and 0.25x above it.

Notes:
- **Haiku's price cliff is the only hard dial.** A request whose prompt (cache reads included) passes 100K tokens is billed on the 5x card. Every other tier bills one rate across the whole 1M window, so context volume alone never justifies moving up from Sonnet. A sub-agent's window is sized by its own model, not the parent's.
- Cache reads: 2.5 % of input on Fable, 5 % on Opus and Sonnet, 10 % on Haiku. Long agentic loops that re-read a large stable prefix narrow Fable's premium (Anthropic: ~25 % cheaper than Fable 5 on typical workloads, up to ~45 % on cache-heavy ones).
- All four tiers share the Opus 4.7 tokenizer: ~30 % more tokens than Sonnet 4.6 / Haiku 4.5 era measurements for the same text, heaviest on code.

## The `effort` dial

Effort is a behavioral signal, not a token budget; the only hard cap is `max_tokens`, and thinking counts toward it. Lower effort means fewer, more consolidated tool calls, no preamble, terser output. Higher effort means a plan first, more files read, verification. Level names do not mean the same amount of thinking across models: the 5.5 family was recalibrated, so a level carried over from Sonnet 5 or Opus 5 is a guess.

| Level | Use when |
| --- | --- |
| `low` | Chat, classification, extraction, one lookup. Sub-agent caveat: with a long system prompt, Haiku and Sonnet at `low` sometimes stop early or report a change done without running a check. Not for implementers. |
| `medium` | The Claude Code default on Haiku, Sonnet and Opus (the API default on Sonnet is `high`). Agentic coding and multistep tool use start here. Opus `medium` exceeds Opus 5 `high` on coding and knowledge work. |
| `high` | Knowledge work, longer agent tasks, strict instruction following, review where a miss costs. Fable's default. On Haiku, the honest default for an implementer with a long prompt. |
| `xhigh` | The last stop on Sonnet and Opus before changing model. On Fable it scores the same as `max`. Costs 2.5x `high` on Opus for about one point. |
| `max` | Never for a sub-agent. +0 to +4 index points over `xhigh` for 1.3x to 2.8x the cost on every tier; on Sonnet it costs more per task than Opus at `max` and scores lower. |

An unsupported level is not an error: Claude Code runs the highest supported level at or below it. Omitting `effort` inherits the session level, which is the model's default (`medium` on the three 5.5 tiers) unless the user changed it. `CLAUDE_CODE_EFFORT_LEVEL` outranks the frontmatter field; a per-invocation `effort` parameter on the Agent call outranks both (v2.1.292+).

## Cost per task, not cost per token

Per-token rate times tokens consumed is the real cost. At high effort a cheaper model iterates more and can overtake a pricier model that finishes in fewer steps. Artificial Analysis Intelligence Index v4.3.2, score / cost per task (full ladders and sources in `cost-intelligence-research.md`):

| Effort | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
| --- | :-: | :-: | :-: | :-: |
| low | n/p | 36 / $0.41 | 42 / $0.55 | 47 / $2.37 |
| medium | 34 / $0.05* | 41 / $0.59 | 51 / $1.34 | 49 / $2.98 |
| high | 38 / n/p | 47 / $1.08 | 54 / $1.82 | 51 / $3.91 |
| xhigh | n/p | 52 / $2.74 | 56 / $3.46 | 53 / $5.98 |
| max | 43 / $0.21* | 56 / $7.60 | 58 / $5.98 | 53 / $7.63 |

*Provisional: measured before the over-100K rate card was applied.

The escalation ladder this gives, one notch at a time:

1. **Haiku `medium`, then `high`.** Haiku `high` (38) beats Sonnet `low` (36) and sits one point under Sonnet `medium` (41) at a fraction of the cost; what pushes work off Haiku is token volume and wall-clock (Haiku at `max` emits more tokens per task than Opus) and the long-prompt behaviors above, not price. Needing more than Haiku `high` means Sonnet `medium`, not Haiku `xhigh`.
2. **Sonnet `medium`, then `high`.** Sonnet `high` is still cheaper than Opus `medium`; Sonnet `xhigh` is not. Needing more than Sonnet `high` means Opus `medium`.
3. **Opus `medium`, then `high`, then `xhigh`.** Four of Opus's five levels sit on the Pareto frontier. Anthropic's measured re-run rule for anything with a failure signal (SWE-bench Pro): run everything at `low`, resume only the failures at `high`: ~97 % pass for ~$0.17 per task against 95.3 % for $0.29 running everything at `high`. Starting at `medium` alone gave ~97 % for ~$0.24.
4. **Fable `high`.** Only after Opus `xhigh` fell short, or when the scope is broad, complex and critical at once (section below). Fable `medium` scores below Opus `high` at 1.6x the cost; `xhigh` is Fable's ceiling.

## When Fable earns 2.5x Opus

Opus 5.5 first, always: on SWE-bench Pro Opus `medium` matched Fable's default for a fifth of the cost per solved task, and Anthropic says the gap "is narrower than the scores suggest" in its own use. Fable is the right sub-agent model when:

- **The scope is broad, complex and critical together**: sessions that run for hours, a corpus that fills most of the window, interlocking constraints where one missed condition sinks the result. Anthropic positions Fable 5.1 for exactly this (long-context reasoning across the full 1M window and multi-hour agentic coding are where it improved most), and no public benchmark measures Opus 5.5 against it there. Same window on both; the claimed difference is how well details across it get connected.
- **Opus `xhigh` already failed on this task.** The documented escalation, and nearly the same price per task ($3.46 vs $3.91).
- **A retry costs more than the premium**: Fable's first-attempt edge is real but narrow (47 vs 42 at `low`).

Run it at `high`. Reserve `max` for nothing: it ties `xhigh`.

## Subscription users (Pro / Max): limits, not dollars

On a subscription the cost that matters is share of the 5-hour window and the weekly cap, shared across models and across claude.ai and Claude Code. Anthropic publishes only relative anchors (Pro >= 5x Free; Max 5x = 5x Pro; Max 20x = 20x Pro) and no per-model drain rates; the per-token ratios above (haiku 0.05 : sonnet 1 : opus 2 : fable 5) are the best proxy.

| Plan | `haiku` / `sonnet` / `opus` | `fable` |
| --- | --- | --- |
| Pro | included; Opus 5.5 is the default model | **not included**: bills usage credits; a `model: fable` sub-agent shows a consent prompt once per interactive session, and in `-p` / SDK runs bills silently |
| Max (5x / 20x) | included; Opus 5.5 is the default model | included up to **50 % of the weekly limit** (claude.com/pricing; re-check), beyond that usage credits or another model |

Practical rules for subscribers:

1. **Pro: never `model: fable` in a sub-agent.** Fable is a manual, main-session decision when the user has topped up credits.
2. **Max: at most one Fable agent per workflow** (the orchestrator or architect), and only when the scope is broad, complex and critical at once, or after Opus at `xhigh` fell short. One heavy Fable session can consume a large fraction of a 5-hour window.
3. **Route volume to Haiku.** Researchers and explorers on `haiku` are the biggest lever on weekly consumption because they run most often; Haiku `high` now covers synthesis that used to need Sonnet.
4. **`medium` is the floor for implementers on every tier**, and `high` on Haiku when the prompt is long.
5. **`maxTurns`** is the subscriber's hard brake. Set it on every autonomous worker; the output is marked partial and can be resumed.
6. `experimental.cacheTtl: 1h` is ignored while the subscription is on usage credits.

## Decision matrix: task to (model, effort)

Archetype defaults live in `SKILL.md`; this is the finer grain by task.

| Task | Model | Effort | Why |
| --- | --- | --- | --- |
| Search / extract / classify, read-only | `haiku` | `medium` | the default; `low` only for a single lookup |
| Codebase research with a synthesized answer | `haiku` | `high` | one index point under Sonnet `medium` for a fraction of the cost |
| Apply a known pattern across files (rename, formatting) | `sonnet` | `medium` | verifiable by a command; a miss is caught |
| Fix a scoped bug; write tests for a module | `sonnet` | `medium` | Sonnet's start for agentic coding; `high` when tests are flaky or the module is coupled |
| Code / architecture review | `sonnet` | `high` | Sonnet's last stop; `opus` + `medium` when the diff is cross-cutting |
| Security / compliance audit | `opus` | `medium` to `high` | a missed finding is expensive; Opus `medium` already outscores Sonnet `high` |
| Cross-codebase migration, redesign, orchestration | `opus` | `high` | long-horizon planning and recovery; `xhigh` after a measured miss |
| Broad + complex + critical scope, or Opus `xhigh` fell short | `fable` | `high` | the only case that justifies 5x Sonnet's rate; `max` adds nothing over `xhigh` |

A frontmatter `effort` overrides the session level for this agent only. Extended thinking is inherited from the session; there is no per-agent thinking switch.

## Anti-patterns

- **Choosing Opus because the task is "long".** Length is context; Sonnet has 1M too. Choose Opus for reasoning depth, Fable for breadth plus depth plus stakes.
- **Escalating effort instead of model.** Sonnet `max` costs more than Opus `xhigh` for the same score; Haiku `xhigh` can return an empty reply. One notch up the model is the cheaper move past `high`.
- **Reusing effort settings from a previous generation.** The 5.5 ladders were recalibrated; Anthropic recommends a fresh sweep per model.
