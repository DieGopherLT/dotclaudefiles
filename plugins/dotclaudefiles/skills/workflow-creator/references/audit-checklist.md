# Audit Checklist

The source of truth for **audit mode**. Walk an existing workflow script against every category below. Each check names **what to look for**, **why it matters**, and **the fix**, plus a default **severity**. Severity is a default, not a verdict — adjust for the script's context (a silent cap in a throwaway run is minor; in a compliance audit it is major).

## Table of contents

1. Data-flow shape (`pipeline` vs `parallel`)
2. Thinking-load calibration
3. Structured output and null-safety
4. Quality-pattern integrity
5. Budget and caps
6. Runtime safety
7. Coordination hygiene
8. Severity rubric

## Severity at a glance

- **Blocker** — fails or throws at runtime, or silently produces no work. The script cannot ship.
- **Major** — runs, but wastes significant budget or risks a wrong/incomplete answer.
- **Minor** — style, hygiene, or small optimization; safe to ship without.

---

## 1. Data-flow shape (`pipeline` vs `parallel`)

- **Unjustified `parallel()` barrier.** Look for `parallel()` whose results feed the next stage without any cross-item dependency — especially the pattern `parallel(...)` → plain `transform` → `parallel(...)`. Why it matters: a barrier stalls every item until the slowest finishes, wasting wall-clock the fan-out didn't need. Fix: rewrite as one `pipeline()` with the transform inside a stage. **Major.**
- **Barrier that IS justified but reads as waste.** Confirm a retained `parallel()` is doing dedup/merge across the full set, an early-exit on zero count, or cross-item comparison. If so, it's correct — note it as sound, not a finding. Why it matters: don't flag a necessary barrier.
- **Pipeline stage doing cross-item work.** A `pipeline()` stage that references other items' results is wrong — stages are independent. Why it matters: it will see only its own item. Fix: hoist that step to a `parallel()` barrier or post-pipeline plain-code reduce. **Major.**
- **`> 4096` items into one `pipeline`/`parallel` call.** Why it matters: it's an explicit runtime error, not silent truncation. Fix: chunk the work-list. **Blocker.**

## 2. Thinking-load calibration

- **Whole fleet inheriting the session model.** Look for high-volume `agent()` calls (scouts, extractors, per-item skeptics) with **no `model`**. Under `ultracode` they inherit the session pairing — `xhigh` — so the cheap fan-out runs on the heaviest, costliest tier. Why it matters: this is the single most expensive mistake in a workflow; it multiplies budget across the whole fleet. Fix: set `model: 'haiku'` on mechanical retrieval roles. **Major.**
- **Under-powered tail.** The synthesizer, completeness critic, or an unacceptable-miss verifier on `haiku` or a deliberately low tier. Why it matters: two reasons converge here — a miss discards everything the fleet produced, and the tail must hold the fleet's aggregated outputs in context to reason over them. Haiku/Sonnet cap at 200k; a synthesizer fed by dozens of sub-agents hits that ceiling, while Opus's 1M window does not. Fix: `model: 'opus'` (or inherit) at high effort — for the window as much as the capability. **Major** by default — but a **Blocker** when the aggregated input will predictably overflow 200k (a large fan-out feeding a Sonnet/Haiku tail), because the agent then truncates or dies and the run fails outright, not merely degrades.
- **`effort` passed to `agent()`.** Any `agent(prompt, { effort: ... })`. Why it matters: `agent()` has no `effort` field — it is silently ignored, so the author's intent is not applied. Fix: move the effort decision to the session level, or pin it via a custom `agentType`. **Major.**
- **`xhigh` expected from a Sonnet worker.** A role meant to run hot but pinned/inherited as `sonnet`. Why it matters: Sonnet does not support `xhigh` — it's silently ignored. Fix: use `opus` for `xhigh`, or accept Sonnet's `high`/`max`. **Minor → Major** depending on how much the role needs the depth.
- **Fragile `agentType` reference.** An `agentType` that won't exist in the environment where this workflow runs (e.g. a project agent referenced by a workflow meant to ship inside a skill or plugin). Why it matters: it throws at runtime when unresolved. Fix: confirm the agent is guaranteed in the target registry; for distributed artifacts, bundle the agent or fall back to inline `model`. **Blocker** if the target registry is known to lack it; **Major** if uncertain.

## 3. Structured output and null-safety

- **Processed `agent()` with no `schema`.** An `agent()` whose return value is destructured, indexed, or fed into code, but called without `schema`. Why it matters: it returns raw text; the downstream code parses fragile strings or silently breaks. Fix: add a JSON-Schema `schema` so the call returns a validated object. **Major.**
- **Missing `.filter(Boolean)`.** Results of `parallel()`/`pipeline()` (or any `agent()` that can be skipped) used via `.map`/`.flatMap`/spread without filtering nulls first. Why it matters: skipped or dead agents resolve to `null`; the next line throws on `null.foo` or pollutes the result set. Fix: `.filter(Boolean)` before use. **Major** (often a latent **Blocker** — it throws the first time an agent is skipped).

## 4. Quality-pattern integrity

- **Findings with no verification.** A fan-out that surfaces claims/bugs/issues and returns them with no adversarial or perspective-diverse check. Why it matters: plausible-but-wrong findings reach the user unfiltered. Fix: add a verify stage (N skeptics, majority-refute) before the result. **Major** (severity scales with stakes).
- **Convergence pitfall: dedup against the wrong set.** A loop-until-dry that dedups fresh findings against the **confirmed** set instead of a **`seen`** set. Why it matters: a judge-rejected finding is "not confirmed", so it looks fresh again next round, gets re-judged, rejected again — the loop never converges. Fix: accumulate every candidate (accepted or not) in `seen`, dedup against that. **Blocker** (non-termination, or runs to the agent cap).
- **Loop-until-dry with no dry-round counter.** A discovery loop bounded by a fixed count (`while count < N`) rather than K consecutive empty rounds. Why it matters: it misses the tail or stops arbitrarily. Fix: track consecutive dry rounds; stop after K. **Minor → Major.**
- **Single-angle sweep presented as exhaustive.** One search modality reported as full coverage. Why it matters: one angle never finds everything. Fix: multi-modal sweep, or `log()` the limited scope. **Minor.**

## 5. Budget and caps

- **Dynamic loop with no `budget.total` guard.** A `while`/recursion that spawns agents based on `budget.remaining()` without first checking `budget.total`. Why it matters: with no target, `remaining()` is `Infinity`, so the loop runs to the **1000-agent backstop** before stopping. Fix: guard on `budget.total &&` first. **Blocker.**
- **Silent coverage cap.** A `top-N`, no-retry, or sampling decision that bounds coverage with no `log()`. Why it matters: a silent cap reads as "covered everything" when it didn't. Fix: `log()` what was dropped. **Major.**
- **Budget treated as advisory.** Code assuming `agent()` past the target just degrades. Why it matters: the target is a hard ceiling — `agent()` throws once `spent()` hits `total`. Fix: design the loop to stop with headroom (e.g. `remaining() > 50_000`). **Minor → Major.**

## 6. Runtime safety

- **`Date.now()` / `Math.random()` / argless `new Date()`.** Anywhere in the script. Why it matters: they throw — they'd break resume determinism. Fix: pass timestamps via `args` and stamp after the run; vary randomness by item index. **Blocker.**
- **Non-literal `meta`.** `meta` built with variables, function calls, spreads, or template interpolation. Why it matters: `meta` must be a pure literal or the script won't load. Fix: inline literal values. **Blocker.**
- **TypeScript syntax.** Type annotations (`: string[]`), interfaces, generics. Why it matters: the script is plain JS; these fail to parse. Fix: strip the types. **Blocker.**
- **Filesystem or Node APIs.** `fs`, `process`, `require`, etc. Why it matters: unavailable in the sandbox. Fix: pass data via `args`; use only standard JS built-ins. **Blocker.**
- **Unnecessary `isolation: 'worktree'`.** Worktree isolation on agents that don't mutate files in parallel. Why it matters: it costs ~200-500ms + disk per agent for nothing. Fix: drop it unless parallel file mutation would conflict. **Minor.**

## 7. Coordination hygiene

- **An `agent()` doing plain-code work.** A subagent spawned to dedup, filter, sort, or route by a known rule. Why it matters: it spends model tokens on what JavaScript does for free. Fix: replace with plain code. **Major** (cost) or **Minor** (if tiny).
- **Global `phase()` inside concurrent stages.** `phase()` called from within `pipeline()`/`parallel()` stages instead of passing `phase` as an `agent()` opt. Why it matters: concurrent stages race on the global phase state, scrambling the progress display. Fix: pass `{ phase: '...' }` per `agent()` call. **Minor.**
- **Weak or missing labels on a large fan-out.** Why it matters: an unlabeled 100-agent run is unreadable in `/workflows`. Fix: set a descriptive `label`. **Minor.**

## 8. Severity rubric (for the report)

| Severity | Definition | Examples |
| --- | --- | --- |
| **Blocker** | Fails/throws at runtime, never terminates, or produces no work | `Date.now()`, non-literal `meta`, TS syntax, `>4096` items, unguarded dynamic loop, dedup-vs-confirmed non-termination, unresolved `agentType` |
| **Major** | Runs, but wastes significant budget or risks a wrong/incomplete answer | Fleet inheriting `xhigh`, unjustified barrier, processed `agent()` without `schema`, missing `.filter(Boolean)`, silent cap, unverified findings |
| **Minor** | Style, hygiene, or small optimization | Global `phase()` in stages, weak labels, needless worktree, tiny plain-code-as-agent |

When a finding could sit in two tiers, place it by **blast radius**: does it break the run (blocker), corrupt the answer or burn the budget (major), or merely read poorly (minor)?
