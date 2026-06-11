# Thinking Load Inside a Workflow

Thinking load is the reasoning capacity an agent pays for on every turn. It is set by two independent dials, and this file covers how to pull them **inside a workflow fan-out** — which behaves differently from tuning a standalone sub-agent.

## The two dials

- **`model`** — the capability ceiling and the price per token.
- **`effort`** — how hard the model thinks *within* that ceiling. It is a behavioral signal, not a hard token budget: it scales all tokens in a turn (reasoning, tool calls, final text).

The guiding principle: the more **mechanical and deterministic** (and smaller) the task, the lighter the model and the lower the effort; the more **open-ended, ambiguous, or long-horizon**, the heavier the model and the higher the effort.

Tiers — prefer the bare alias (`haiku` / `sonnet` / `opus`) over a pinned ID so the agent tracks the latest model in its tier:

- `haiku` — fastest, cheapest, **200k** context. **No effort dial.** Read-only search, classification, extraction, high-volume mechanical work.
- `sonnet` — strong speed/intelligence balance, **200k** context, the sensible default. Most coding and agentic work.
- `opus` — highest capability, long-horizon coherence, and the only tier with a **1M** context window. Architecture, migrations, audits where a miss is unacceptable — and, in workflows, the synthesizing tail (see below).

**Context window is a third dial, alongside capability and price.** Haiku and Sonnet share 200k; Opus has 1M — a 5x advantage that is often the deciding factor in a workflow even when Sonnet's *capability* would suffice. The reason is structural: the reduce/synthesize tail must hold the fleet's aggregated outputs in its own context before it can reason over them. A synthesizer or completeness critic fed by dozens of sub-agents will hit 200k as a hard ceiling — and this is a **runtime failure mode, not a slowdown**: when the aggregated input overflows the window the agent truncates or dies and the whole run fails (a Sonnet tail running out of context has sunk real workflows). At 1M it rarely happens. So escalate the tail to Opus for the window, not only for capability. Conversely, do **not** reach for Opus on a fan-out worker whose task is bounded (one file, one claim, a fixed result set) — there the 200k window is no bottleneck and the extra cost is waste.

**The effort support matrix** — an unsupported level is silently ignored, not an error, so a wrong pairing fails quietly:

| Model | `low` | `medium` | `high` | `xhigh` | `max` |
| --- | :---: | :---: | :---: | :---: | :---: |
| `haiku` | — | — | — | — | — |
| `sonnet` | yes | yes | yes | no | yes |
| `opus` | yes | yes | yes | yes | yes |

Three rules cover it: haiku has **no** effort dial (omit it); sonnet supports everything **except** `xhigh` (use `high` or jump to `max`); opus supports the full ladder. The anti-pattern is defaulting everything to `opus` + `max` — it quietly burns ~5x cost and a multiple of latency on work a lighter pairing nails.

## What changes inside a workflow

### 1. `agent()` exposes `model`, not `effort`

The call signature is:

```js
agent(prompt, { label, phase, schema, model, isolation, agentType })
```

There is **no `effort` field**. You cannot dial a single agent's effort up or down from the script. This is the most important and most surprising fact about tuning thinking load in a workflow. Anyone who reaches for `agent(prompt, { effort: 'low' })` is writing something the runtime ignores entirely.

So effort is set by one of two indirect levers (next two sections), while `model` is the one direct, per-call dial you have.

### 2. Effort is inherited from the session — and ultracode runs hot

Every `agent()` that does not override `model` **inherits the main-loop (session) model**, and every agent inherits the **session effort**. Under the `ultracode` setting, session effort is `xhigh`. Two consequences:

- In an ultracode run, `agent(prompt)` with no `model` is, by default, the **heaviest** pairing available: session model (typically Opus) at `xhigh`. That is correct for the synthesis tail and ruinous for a 100-agent retrieval fleet.
- The lever you have from the script is therefore mostly **downshifting via `model`**. Setting `model: 'haiku'` gives you a cheap worker that *also* ignores effort (haiku has no effort dial), so it is naturally light regardless of the hot session setting. That is why scouts and extractors belong on haiku: it is the one tier the session's `xhigh` cannot inflate.

### 3. `agentType` is how you pin an exact (model, effort) pairing

When you need an effort level the script can't express — most commonly a **low-effort or medium-effort Sonnet** worker, since Sonnet *does* read effort but `agent()` won't pass it — bind a custom sub-agent via `agentType`:

```js
agent(prompt, { agentType: 'chunk-typer', schema: CHUNK_SCHEMA })
```

`agentType` resolves from the same registry as the `Agent` tool. The named agent's frontmatter carries its own `model` + `effort`, and that pairing wins. It composes with `schema` (the StructuredOutput instruction is appended to the custom agent's system prompt). Author such agents as standalone sub-agent definitions, calibrating `model` + `effort` in their frontmatter.

Use this when:

- You want a **repeatable, precisely-tuned** worker reused across many workflows (e.g. a `sonnet` + `medium` chunk typer for migrations).
- The role needs **shallow, fast** Sonnet judgment and the session is running hot — pin `sonnet` + `low` in the agent definition so the fan-out doesn't inherit `xhigh`.
- The role needs a **specialized system prompt** beyond what an inline prompt string conveys.

For most roles, the inline `model` dial is enough; reach for `agentType` when the script-level controls genuinely can't express the calibration you need.

## Effort granularity depends on portability

Levers 1 and 2 only ever give *uniform* effort — every inheriting agent runs at the session level. `agentType` is the **only** way to differentiate effort *per role*. But it resolves at **runtime, in whatever environment the workflow runs in**: reference an agent that isn't in that environment's registry and it fails. So the question is never "do specialized sub-agents exist?" — it is "**which sub-agents are *guaranteed* where this workflow will execute?**" You already hold the answer in context: the `Agent` tool's registry of available `agentType`s (the same one a workflow resolves against) — read it there, don't glob `.claude/agents/`. That list reflects the *current* environment, which is the guaranteed registry for a project/task workflow but not for a distributed skill or plugin; the answer hinges on what the workflow is authored for.

| Workflow authored for... | `agentType` safely referenceable? | Effort strategy |
| --- | --- | --- |
| A skill (esp. global) | No — travels to unknown environments; project agents not guaranteed | Inline `model` + session effort only; a specialized `agentType` is a fragile reference here. |
| A task / the current project | Yes — the project's own agents | Match against the loaded registry; else fall back to inline `model`. |
| A plugin | Yes, fully — the plugin ships its `agents/` with it | Author specialized sub-agents with pinned `(model, effort)` and bundle them. |

**The plugin case is special.** Because the artifact ships its own `agents/`, you own the registry end to end — and the workflow is *distributed*, so granular effort pays off on every future run. Don't settle for inline tiers there: create the precisely-tuned sub-agents the roles deserve and bundle them. Recognize that this is the moment to do so.

Resolve effort as a fallback chain, stopping at the first that applies:

> specialized `agentType` *guaranteed in scope* → (plugin / repeatable, worth the investment) *author and bundle* a pinned sub-agent → inline `model` + session effort → pure session inheritance.

Confirm with the user only for what discovery can't settle: a **purpose-ambiguous match** (a found agent's name fits the role but its system prompt may not — e.g. a `code-reviewer` for an adversarial *verifier* slot), or the **investment call** (no agent fits, and authoring a precisely-tuned one trades maintenance for accuracy against the inline-`model` fallback).

## The fleet shape: many cheap workers, a few expensive deciders

A standalone sub-agent is one calibration decision. A workflow is a *distribution* of them, and the distribution has a characteristic shape:

- **Wide, cheap base** — the fan-out (scouts, extractors, classifiers, per-finding skeptics). High volume, mechanical or narrow. Every token here is multiplied by the fleet size, so over-powering it is the costliest mistake in the whole script.
- **Narrow, expensive tip** — the reduce/synthesize tail (the synthesizer, the completeness critic, an unacceptable-miss verifier). Low count, but a single miss here discards everything the base produced. Under-powering it is the *other* costliest mistake.

Calibrate against both failure modes, not just one. The two anti-patterns are symmetric: a fleet left on the ultracode default (`xhigh`) burns multiples of budget on retrieval haiku would nail; a synthesizer dropped to haiku throws away the fleet's work by failing to reason over it.

## Role to tier mapping

Starting points — adjust for scope (a scout over a 2M-line monorepo may warrant Sonnet; a synthesizer over five bullet points may not need Opus).

| Workflow role | Determinism / scope | Model | Effort lever | Rationale |
| --- | --- | --- | --- | --- |
| Scout / finder / searcher | mechanical / tiny | `'haiku'` | none | Grep-and-locate is deterministic; haiku ignores the hot session effort, keeping it cheap. |
| Extractor / classifier | mechanical / tiny | `'haiku'` | none | Pull claims, label, route — no judgment to pay for. |
| Transformer / implementer | medium / bounded | `'sonnet'` or omit | session, or `agentType` `medium` | Edit one chunk: mechanical change plus a tactical decision. Pin via agentType to stop a hot session inflating it. |
| Reviewer / auditor (per dimension) | open-ended / a slice | `'sonnet'` -> `'opus'` | session `high`/`xhigh` | Review surfaces subtle issues; effort is what catches them. Opus when a miss is unacceptable. |
| Skeptic / verifier (adversarial) | narrow judgment / one claim | `'sonnet'` | session; `agentType` if it must stay cheap | One refutation attempt; many run in parallel, so cost adds up — pin shallow if needed. |
| Judge (panel) | comparative judgment / N attempts | `'sonnet'`/`'opus'` | session | Scoring competing attempts; Opus when the decision is high-stakes. |
| Synthesizer | open-ended / long-horizon | `'opus'` or inherit | `xhigh` under ultracode | Writes the final answer from survivors. This is exactly where you want it hot. |
| Completeness critic | open-ended / whole-job | `'opus'` | session `high` | Hunts for what the fleet missed — needs to reason over the entire result set. |

## Quick checklist

- Did you set `model` on every high-volume fan-out role? (If not, an ultracode run silently puts them on the heaviest pairing.)
- Is anything trying to pass `effort` to `agent()`? Remove it — it's ignored. Move the effort decision to the session level or an `agentType`.
- Is the synthesizer / unacceptable-miss verifier on `opus` (or a deliberate inherit), not accidentally downshifted?
- Do any roles need a precise Sonnet effort the script can't express? Pin them via `agentType`, authoring the agent as a standalone sub-agent definition.
