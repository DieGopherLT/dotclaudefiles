---
name: workflow-creator
description: Designs, writes, or audits dynamic workflows for Claude Code — the JavaScript orchestration scripts the Workflow tool runs to fan many subagents across one large job (triggered by 'ultracode' or by asking to "use a workflow"). Use this skill proactively whenever the user says "create a workflow", "write a dynamic workflow", "orchestrate subagents", "fan out agents", "parallelize this with agents", "codebase-wide audit", "massive bug hunt", "ultracode workflow", "port this from X to Y", "migrate the whole repo", or describes work a single pass can't hold (repo-wide audits, large migrations, language ports, verified multi-source research). Also use it to audit or review an existing workflow script — "audit this workflow", "review my orchestration script", "is this workflow correct", "improve this workflow" — checking data-flow shape, per-role thinking load, and runtime safety. For authoring a single isolated sub-agent that reports back once, this is not the skill. Reach for this even when the user only hints at coordinating many agents or scaling a job beyond one context window.
---

# Workflow Creator

This skill helps you **author** dynamic workflows and **audit** existing ones: the JavaScript orchestration scripts the `Workflow` tool runs. A workflow decomposes one large job across tens to hundreds of subagents, runs them as `pipeline()`/`parallel()` fan-outs, verifies its own results, and returns only the converged answer to the main context.

It works in **two modes**, both built on the same body of principles:

- **Authoring** (default) — design and write a new workflow. Follow the Process below.
- **Auditing** — review an existing workflow script against those same principles and report findings. Jump to *Auditing an existing workflow*.

The governing idea, and the reason workflows scale where a single context can't:

> **The model does the judgment; the code does the coordination.** The script's loops, filters, dedup, and branching spend zero model tokens. Only the `agent()` calls cost tokens. So the whole game is: spend tokens where judgment lives, and let plain JavaScript do everything else for free.

The shape that generalizes is **fan out → reduce → synthesize**. Everything below is in service of building that shape well — and, above all, of spending the right amount of thinking on each agent in it.

## When to invoke this skill

Trigger when the user wants to author or run a workflow, or describes work a single pass can't hold:

- "Create a workflow that...", "write a dynamic workflow", "use a workflow for..."
- "Orchestrate subagents", "fan out agents across...", "parallelize this with agents"
- "Audit every X in the repo", "codebase-wide bug hunt", "port this from A to B", "migrate all of..."
- Anything prefixed with `ultracode:` or where the user flips on the `ultracode` effort setting.
- "Audit this workflow", "review my orchestration script", "is this workflow correct?", "improve this workflow" — the **auditing** mode, over a script the user already has.

If the user wants a single specialized worker with an isolated context that reports back once, that is a **sub-agent**, not a workflow — author it as a standalone sub-agent definition instead. A workflow is for *many* agents coordinated by a script.

A hard prerequisite: **the Workflow tool only runs on explicit opt-in** (the `ultracode` keyword, the `ultracode` effort setting on for the session, or the user asking for a workflow in their own words). This skill helps you *author* the script; it does not lower that bar. If the user has not opted in, write the script and explain it, but do not invoke `Workflow` yourself.

## Process (authoring mode)

Walk these steps in order. Steps 2 and 3 are where most workflows are won or lost — the data-flow shape and the per-role thinking load.

### 1. Scope it: is a workflow even warranted?

Workflows are token-heavy by design (a real research run can burn ~2M tokens across 100+ agents). Reach for one only when the work genuinely exceeds one context: repo-wide audits, large migrations, multi-source verified research, or high-stakes work where you want adversarial agents trying to break the answer first. For a bounded task a single session or one sub-agent handles, say so and stop.

When it *is* warranted, write down the shape before any code: what fans out, what reduces it, what synthesizes. Knowing the shape before the *orchestration step* is enough — you can scout inline first (list the files, find the routes, scope the diff) to discover the work-list, then hand that list to the workflow.

### 2. Shape the data flow: `pipeline()` vs `parallel()`

This is the single decision that most affects wall-clock. Get it right before tuning anything else.

- **`pipeline(items, stage1, stage2, ...)` is the DEFAULT.** Each item flows through every stage independently, with **no barrier**: item A can be in stage 3 while item B is still in stage 1. Wall-clock equals the slowest single-item chain, not the sum of per-stage maxes.
- **`parallel(thunks)` is a BARRIER.** It awaits *all* thunks before returning. Use it **only** when stage N genuinely needs the full result set of stage N-1.

A barrier is correct only for: **dedup/merge** across all results before an expensive downstream step; **early-exit** on a zero count ("0 findings → skip verification entirely"); or when stage N's prompt references "the other findings" to compare. It is *not* justified by "I need to flatten/map/filter first" (do that inside a stage) or "it reads cleaner."

Smell test — if you wrote `parallel` → plain `transform` → `parallel`, that middle transform has no cross-item dependency and the barrier is wasted. Rewrite as one pipeline with the transform inside a stage. **When in doubt: pipeline.**

Full primitive reference (signatures, return/`null` semantics, `phase`/`log`, concurrency caps): `references/primitives.md`.

### 3. Assign the thinking load per role (the core of this skill)

A workflow is a *fleet*, not one agent — and the fleet has a characteristic shape: **many cheap, high-volume workers and a few expensive deciders.** The same discipline that calibrates any agent still governs (mechanical+small → light model+low effort; open-ended+long-horizon → heavy model+high effort), but it applies *per role inside the fan-out*, and the workflow runtime changes how you pull the two dials.

**The non-obvious part: `agent()` exposes `model` but NOT `effort`.** The signature is `agent(prompt, {label, phase, schema, model, isolation, agentType})`. There is no per-call effort knob. So thinking load inside a workflow is controlled three ways:

1. **`model` per `agent()` call** — picks the tier (`'haiku'` / `'sonnet'` / `'opus'`). Omit it to inherit the main-loop/session model.
2. **Session effort** — every agent that *inherits* effort runs at the session level. Under `ultracode` that is `xhigh`. So in an ultracode run, an `agent()` with no `model` is, by default, the **heaviest** pairing (session model at `xhigh`). The skill's real job is teaching deliberate *downshifting* of the cheap roles, not upshifting.
3. **`agentType`** — binds a pre-defined sub-agent whose frontmatter pins an exact `(model, effort)` pairing. This is the **only** way to get, say, a genuinely *low-effort Sonnet* worker, because the script can't dial Sonnet's effort down per call. When you need precise effort control the script can't express, route through a custom `agentType` (a standalone sub-agent definition whose frontmatter pins the pairing).

Note that lever 1 (`model`) and lever 2 (session effort) only give you *uniform* effort — every inheriting agent gets the session level. Lever 3 (`agentType`) is the **only** way to differentiate effort *per role*. Whether you can reach for it depends on portability — see below.

#### Effort granularity depends on portability

`agentType` resolves at **runtime, in whatever environment the workflow runs in**. Referencing an agent that isn't in that environment's registry fails. So the real question is never "do specialized sub-agents exist?" — it is "**which sub-agents are *guaranteed* where this workflow will execute?**"

You do **not** glob `.claude/agents/` to answer this: you already hold the registry of available `agentType`s in context — the `Agent` tool's list of sub-agent types and their descriptions (the same registry a workflow resolves `agentType` against). Read it from there. The one caveat is that this list reflects the **current** environment, which maps cleanly onto the destinations below: it *is* the guaranteed registry for a project/task workflow, but not for a distributed skill, nor for a plugin (where what counts is what the plugin will bundle, not what you see now). Reserve `AskUserQuestion` for the two judgment calls noted below. The answer hinges on the workflow's destination:

| Workflow is authored for... | `agentType` safely referenceable? | Effort strategy |
| --- | --- | --- |
| **A skill (esp. global)** | No — it travels to unknown environments; project agents are not guaranteed | Inline `model` + session effort only. A specialized `agentType` here is a fragile reference — avoid it. |
| **A task / the current project** | Yes — the project's own agents, since the workflow runs right here | Match a role against the loaded registry; else fall back to inline `model`. |
| **A plugin** | Yes, fully — the plugin ships its `agents/` and they travel with it | **Author specialized sub-agents with pinned `(model, effort)` and bundle them.** This workflow is distributed; invest in precise effort. |

The plugin case is special: because the artifact ships its own `agents/`, you control the registry completely, so *create* the specialized sub-agents the roles deserve rather than settling for inline tiers — a distributed workflow is exactly where granular effort pays off across every future run. Recognize that moment and act on it.

Resolve effort as a fallback chain, stopping at the first that applies:

> specialized `agentType` *guaranteed in scope* → (plugin/repeatable, worth the investment) *author and bundle* a pinned sub-agent → inline `model` + session effort → pure session inheritance.

Confirm with the user only for what discovery can't settle: (a) a **purpose-ambiguous match** — a found agent's name fits the role but its system prompt may not (e.g. a `code-reviewer` for an adversarial *verifier* slot); or (b) the **investment call** — no agent fits and you must decide between authoring a precisely-tuned one (more accuracy, more maintenance) versus accepting the inline-`model` fallback.

Map the roles you actually have onto tiers. Treat as starting points, then adjust for scope:

| Workflow role | Typical job | Model | Effort lever |
| --- | --- | --- | --- |
| Scout / finder / searcher | read-only grep, locate, retrieve | `'haiku'` | none (haiku has no effort dial — naturally cheap) |
| Extractor / classifier | pull claims, label/route items | `'haiku'` | none |
| Transformer / implementer | edit one chunk, apply one migration step | `'sonnet'` (or omit) | session, or `agentType` pinned at `medium` |
| Reviewer / auditor (per dimension) | open-ended judgment over a slice | `'sonnet'` → `'opus'` | session `high`/`xhigh`, or `agentType` |
| Skeptic / verifier (adversarial) | try to refute ONE claim | `'sonnet'` typically | session; pin via `agentType` if you need it cheap and shallow |
| Judge (panel) | score N competing attempts | `'sonnet'`/`'opus'` | session |
| Synthesizer | write the final answer from survivors | `'opus'` (or inherit) | `xhigh` under ultracode — this is where you WANT it hot |
| Completeness critic | hunt for what's missing | `'opus'` | session high |

The economic logic: the fan-out is where volume lives, so **downshift the fleet** — scouts and extractors are mechanical retrieval and belong on `haiku`. The reduce/synthesize tail is where a single miss wastes all the upstream work, so **spend there** — keep the synthesizer and any unacceptable-miss verifier on `opus` at high effort. There's a second, structural reason for Opus on the tail: it has a **1M context window** versus 200k for Haiku/Sonnet, and the synthesizer must hold the fleet's aggregated outputs in context before reasoning over them. At 200k that is not just a slowdown but a **runtime failure mode** — when the aggregated input overflows the window the agent truncates or dies and the run fails. So escalate the tail for the window as much as for capability. Pushing the whole fleet to `opus` + `xhigh` (the ultracode default if you never set `model`) quietly burns multiples of the budget on retrieval that haiku nails. Under-powering the synthesizer throws away everything the fleet found.

Worked role-by-role mapping, plus how this differs from the single-agent case: `references/thinking-load.md`.

### 4. Force structured output with `schema`

Without `schema`, `agent()` returns raw text you must parse. **With `schema` (a JSON Schema), the subagent is forced to call `StructuredOutput`, validation happens at the tool-call layer (the model retries on mismatch), and `agent()` returns the validated object.** Use it for any agent whose result the script processes — it eliminates fragile parsing and is the default for fleet work.

`agent()` returns `null` if the user skips the agent or it dies on a terminal error after retries. In `parallel()`, a thunk that throws also resolves to `null` (the call never rejects). So **`.filter(Boolean)` before using results**, always.

### 5. Layer a quality pattern

The leverage of workflows is not the fan-out — it's the repeatable patterns that make the answer trustworthy. Pick by task and compose freely (full templates in `references/quality-patterns.md`):

- **Adversarial verify** — N independent skeptics per finding, each prompted to *refute*; kill on majority refute. Stops plausible-but-wrong findings.
- **Perspective-diverse verify** — when a finding can fail several ways, give each verifier a distinct lens (correctness / security / perf / does-it-reproduce) instead of N identical skeptics.
- **Judge panel** — N attempts from different angles, scored by parallel judges, synthesized from the winner grafting runners-up's best ideas.
- **Loop-until-dry** — keep spawning finders until K consecutive rounds surface nothing new; dedup against a `seen` set (never against the confirmed set, or rejected findings reappear forever).
- **Multi-modal sweep** — parallel agents each searching a *different way* (by-container, by-content, by-entity, by-time), each blind to the others.
- **Completeness critic** — a final agent asking "what's missing — modality not run, claim unverified, source unread?"; its output is the next round.

Scale the pattern to the ask: "find any bugs" → a few finders, single-vote verify; "audit this thoroughly" → larger finder pool, 3-5 vote adversarial pass, synthesis stage.

### 6. Scale to budget, not to a default

If the user set a `+500k`-style target, use the `budget` object: `budget.total` (null if unset), `budget.spent()`, `budget.remaining()`. The target is a **hard ceiling** — `agent()` throws once `spent()` hits `total`. Guard dynamic loops on `budget.total`, because with no target `remaining()` is `Infinity` and you'd run to the 1000-agent cap:

```js
while (budget.total && budget.remaining() > 50_000) { /* spawn another round */ }
const FLEET = budget.total ? Math.floor(budget.total / 100_000) : 5  // static scaling
```

Runtime caps to respect: **up to 16 concurrent** agents — the true cap is `min(16, cores - 2)` (excess queues), **1000 total** per workflow (runaway backstop), **4096 items max** per single `pipeline`/`parallel` call.

### 7. Author the `meta` block and respect the runtime

Every script begins with `export const meta = {...}` as a **pure literal** — no variables, calls, spreads, or interpolation. Required: `name`, `description`; optionally `whenToUse` (shown in the workflow list) and `phases`. Use the **same phase titles** in `meta.phases` as in `phase()` calls (matched exactly).

Runtime constraints that bite (full list in `references/primitives.md`):

- **Plain JavaScript, not TypeScript** — type annotations, interfaces, generics fail to parse.
- **`Date.now()`, `Math.random()`, and argless `new Date()` throw** — they would break resume. Pass timestamps via `args`, stamp after the workflow returns, and vary randomness by item index.
- No filesystem or Node APIs. Standard JS built-ins (JSON, Math, Array) are fine.

### 8. Deliver, iterate, resume

- Author the script inline in the `Workflow` call (don't Write it to a file first). Every invocation persists the script and returns its path.
- To iterate, **edit that path** with Edit/Write and re-invoke with `{scriptPath}` — don't resend the whole script.
- To resume after a pause/edit, relaunch with `{scriptPath, resumeFromRunId}`: the unchanged prefix of `agent()` calls returns cached results instantly; the first edited/new call onward runs live. Same script + same args → 100% cache hit. (This is *why* `Date.now()`/`Math.random()` are banned.)
- Use `isolation: 'worktree'` only when agents mutate files in parallel and would conflict — it costs ~200-500ms + disk per agent.

## Output: minimal workflow skeleton

The canonical pipeline shape — review per dimension, verify each finding as soon as its review lands, with thinking load assigned per role:

```js
export const meta = {
  name: 'review-changes',
  description: 'Review changed files per dimension and adversarially verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const DIMENSIONS = [
  { key: 'bugs', prompt: 'Review the diff for correctness bugs. Return findings.' },
  { key: 'perf', prompt: 'Review the diff for performance regressions. Return findings.' },
]

const results = await pipeline(
  DIMENSIONS,
  // Reviewer: open-ended judgment over a slice -> Sonnet, inherits session effort (high/xhigh under ultracode)
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', model: 'sonnet', schema: FINDINGS_SCHEMA }),
  // Skeptic: refute ONE finding -> stays close to the fan-out, cheap and parallel
  review => parallel((review?.findings ?? []).map(f => () =>
    agent(`Adversarially verify this finding. Default to refuted=true if uncertain: ${f.title}`,
      { label: `verify:${f.file}`, phase: 'Verify', model: 'sonnet', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v }))
  ))
)

const confirmed = results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
return { confirmed }
// Dimension 'bugs' findings verify while 'perf' is still under review. No wasted wall-clock.
```

Define the `*_SCHEMA` objects as JSON Schema literals at the top of the script. Full worked recipes (research, migrate, exhaustive audit with loop-until-dry) live in `references/recipes.md`.

## Auditing an existing workflow

When the user brings a workflow script and asks whether it is correct, sound, or improvable, you are in **audit mode**. This is the inverse of authoring: instead of building the shape, you read a finished script and check it against the same principles, then report. Default to **read-only** — surface findings first; only rewrite if the user asks.

Proceed in three passes:

1. **Read the whole script first.** Identify the shape (what fans out, what reduces, what synthesizes), the roles behind each `agent()` call, and where the result of each call flows. You cannot judge a `parallel()` barrier or a missing `schema` without knowing what consumes the output.
2. **Walk the checklist.** Run the script against every category in `references/audit-checklist.md` — data-flow shape, thinking-load calibration, structured-output/null-safety, quality-pattern integrity, budget and caps, and runtime safety. Each item names what to look for, why it matters, and the fix. The checklist is the audit's source of truth; do not improvise the criteria from memory.
3. **Report with severity.** For each finding, assign a severity, anchor it to a `line` or stage, state the issue in one sentence, and give the concrete fix. Use this exact structure:

```
## Workflow audit: <script name or path>

**Blockers** (fails or throws at runtime)
- L<line> — <issue>. Fix: <concrete change>.

**Major** (correct but costly, fragile, or unsound)
- L<line> — <issue>. Fix: <concrete change>.

**Minor** (style, optimization, hygiene)
- L<line> — <issue>. Fix: <concrete change>.

**Verdict**: <one line — ship as-is / fix blockers first / needs rework>, plus the single highest-leverage change.
```

Severity rubric (full criteria in the checklist): a **blocker** breaks at runtime (`Date.now()`/`Math.random()`, non-literal `meta`, TypeScript syntax, a dynamic loop with no `budget.total` guard, an `agentType` absent from the target registry). A **major** runs but wastes budget or risks a wrong answer (whole fleet inheriting `xhigh`, an unjustified `parallel()` barrier, a processed `agent()` with no `schema`, a missing `.filter(Boolean)`, dedup against the confirmed set instead of `seen`, a silent coverage cap). A **minor** is hygiene (global `phase()` inside concurrent stages, weak labels, an `agent()` doing work plain code would).

If the audit clears every category, say so plainly — do not invent findings to fill the report.

## Reference files

Read these when you need depth:

- `references/primitives.md` — `agent`/`parallel`/`pipeline`/`phase`/`log`/`budget`/`workflow` signatures, `null` semantics, concurrency and total caps, the `meta` block, and every runtime constraint.
- `references/thinking-load.md` — Assigning model + effort per workflow role: why `agent()` has `model` but no `effort`, the three effort levers (model / session / `agentType`), the role→tier table, and how this differs from tuning a standalone sub-agent.
- `references/quality-patterns.md` — Full code for adversarial verify, perspective-diverse verify, judge panel, loop-until-dry, multi-modal sweep, and completeness critic, with the convergence pitfalls spelled out.
- `references/recipes.md` — End-to-end workflow templates: codebase review, multi-source research, large migration (worktree isolation), and exhaustive audit.
- `references/audit-checklist.md` — The audit-mode source of truth: every check grouped by category (data-flow shape, thinking load, structured output, quality patterns, budget, runtime safety), each with what to look for, why it matters, the fix, and its severity.

## Golden rules (do not violate)

1. **Code coordinates, agents judge.** If a step is dedup, filter, sort, or routing by a known rule, write plain JavaScript — never spend an `agent()` call on what code does for free.
2. **Pipeline by default.** Reach for a `parallel()` barrier only when stage N truly needs all of stage N-1 (dedup/merge, early-exit, cross-item comparison). When unsure, pipeline.
3. **Downshift the fleet, spend on the tail.** Scouts and extractors go on `haiku`; the synthesizer and any unacceptable-miss verifier stay on `opus` at high effort. Never leave the whole fleet on the ultracode default (`xhigh`) by forgetting to set `model`.
4. **`agent()` has no `effort`.** To control effort you set the session level, or pin it via a custom `agentType`. State this whenever someone expects a per-call effort dial.
5. **Schema, then `.filter(Boolean)`.** Force structured output for any processed result, and filter nulls before using fan-out results — skipped or dead agents resolve to `null`.
6. **No silent truncation.** If the workflow caps coverage (top-N, no retry, sampling), `log()` what was dropped — a silent cap reads as "covered everything."
7. **Resume-safe code only.** No `Date.now()` / `Math.random()` / argless `new Date()`; `meta` is a pure literal; plain JS, no TypeScript.
