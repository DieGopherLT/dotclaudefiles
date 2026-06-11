# Workflow Primitives Reference

Every hook available inside a workflow script, its exact semantics, and the runtime constraints. Read this when you need to know precisely what a primitive returns or where it can fail.

## Table of contents

- The `meta` block (required header)
- `agent()` — spawn one subagent
- `pipeline()` — streaming multi-stage, no barrier
- `parallel()` — barrier fan-out
- `phase()` / `log()` — progress display
- `budget` — token target
- `args` — parameterization
- `workflow()` — nested workflow
- Concurrency and total caps
- Runtime constraints (the things that throw)
- Iteration and resume

## The `meta` block

Every script begins with `export const meta = {...}` and it must be a **pure literal** — no variables, function calls, spreads, or template interpolation.

```js
export const meta = {
  name: 'find-flaky-tests',                 // required
  description: 'Find flaky tests and fix',  // required — shown in the permission dialog
  whenToUse: 'when CI is intermittently red',   // optional — shown in the workflow list
  phases: [                                  // optional — one entry per phase() call
    { title: 'Scan', detail: 'grep test logs for retries' },
    { title: 'Fix', detail: 'one agent per flaky test' },
  ],
}
```

Use the **same phase titles** in `meta.phases` as in `phase()` calls — they are matched exactly. A `phase()` with no matching meta entry just gets its own progress group. Add `model` to a phase entry when that phase uses a specific model override (display only).

## `agent()`

```js
agent(prompt: string, opts?: {
  label?: string,        // overrides the display label
  phase?: string,        // assigns this agent to a progress group (use inside pipeline/parallel stages
                         //   to avoid racing on global phase() state)
  schema?: object,       // JSON Schema -> forces StructuredOutput, returns the validated object
  model?: string,        // 'haiku' | 'sonnet' | 'opus' — overrides the inherited session model
  isolation?: 'worktree',// fresh git worktree for this agent — EXPENSIVE, only for parallel file mutation
  agentType?: string,    // custom subagent type (e.g. 'chunk-typer', 'code-reviewer') from the Agent registry —
                         //   binds a pre-authored agent whose frontmatter pins its own (model, effort)
}): Promise<any>
```

- **Without `schema`** it returns the agent's final text as a string.
- **With `schema`** it returns the validated object — validation is at the tool-call layer, so the model retries on mismatch. No parsing needed.
- Returns **`null`** if the user skips the agent mid-run or the subagent dies on a terminal API error after retries. Filter with `.filter(Boolean)`.
- There is **no `effort` field** — see `thinking-load.md`. Effort comes from the session or a pinned `agentType`.
- `opts.model` default is to **omit** it: the agent inherits the main-loop model, which is usually correct. Set it to downshift cheap roles.
- `opts.isolation: 'worktree'` costs ~200-500ms + disk per agent; the worktree auto-removes if unchanged. Use ONLY when agents mutate files in parallel and would conflict.
- `opts.agentType` composes with `schema` (the StructuredOutput instruction is appended to the custom agent's system prompt).

## `pipeline()`

```js
pipeline(items, stage1, stage2, ...): Promise<any[]>
```

Runs each item through all stages **independently, with NO barrier between stages.** Item A can be in stage 3 while item B is still in stage 1. This is the **default** for multi-stage work; wall-clock equals the slowest single-item chain, not the sum of per-stage maxes.

- Every stage callback receives `(prevResult, originalItem, index)`. Use `originalItem`/`index` in later stages to label work without threading context through stage 1's return value.
- A stage that **throws** drops that item to `null` and skips its remaining stages.
- At most **4096 items** per call.

```js
const out = await pipeline(
  files,
  (f) => agent(`Analyze ${f}`, { schema: ANALYSIS }),
  (analysis, f, i) => agent(`Fix ${f} (#${i})`, { label: `fix:${f}`, schema: FIX }),
)
```

## `parallel()`

```js
parallel(thunks: Array<() => Promise<any>>): Promise<any[]>
```

Runs tasks concurrently and **awaits all of them** (a barrier). A thunk that throws (or whose agent errors) resolves to **`null`** in the result array — the call itself never rejects, so `.filter(Boolean)` before using results.

Use **only** when you genuinely need all results together: dedup/merge across the full set, early-exit on zero count, or cross-item comparison. Otherwise prefer `pipeline()`.

```js
const all = await parallel(DIMENSIONS.map(d => () => agent(d.prompt, { schema: FINDINGS })))
const deduped = dedupeByFileAndLine(all.filter(Boolean).flatMap(r => r.findings))  // genuinely needs ALL at once
```

## `phase()` and `log()`

```js
phase(title: string): void   // start a phase; later agent() calls group under it in /workflows
log(message: string): void    // emit a narrator line above the progress tree
```

Inside `pipeline()`/`parallel()` stages, prefer passing `phase` as an `agent()` opt rather than calling the global `phase()` — concurrent stages race on the global state. Use `log()` to narrate anything the aggregate stats would hide, especially dropped coverage (see golden rule on silent truncation).

## `budget`

```js
budget.total       // number | null — the turn's token target ("+500k"), null if unset
budget.spent()     // output tokens spent this turn across the main loop AND all workflows (shared pool)
budget.remaining() // max(0, total - spent()), or Infinity if no target
```

The target is a **hard ceiling**: once `spent()` reaches `total`, further `agent()` calls throw. Guard dynamic loops on `budget.total` — with no target, `remaining()` is `Infinity` and the loop runs to the 1000-agent cap.

```js
while (budget.total && budget.remaining() > 50_000) { /* another round */ }
const FLEET = budget.total ? Math.floor(budget.total / 100_000) : 5
```

## `args`

The value passed as `Workflow`'s `args` input, verbatim (`undefined` if not provided). Pass arrays/objects as **actual JSON values**, not a JSON-encoded string — a stringified list reaches the script as one string, so `args.filter`/`args.map` throw. Use it to parameterize named/saved workflows (a research question, a target path, a config object).

## `workflow()`

```js
workflow(nameOrRef: string | { scriptPath: string }, args?: any): Promise<any>
```

Runs another workflow inline as a sub-step. Shares this run's concurrency cap, agent counter, abort signal, and token budget; its agents appear under a `> name` group in `/workflows`. **Nesting is one level only** — `workflow()` inside a child throws. Throws on unknown name / unreadable scriptPath / child syntax error; catch to handle gracefully.

## Concurrency and total caps

- **Concurrent `agent()` calls: `min(16, cpu cores - 2)`** per workflow. Excess queues and runs as slots free. You can still pass 100 items to `parallel()`/`pipeline()` — only ~10-16 run at any moment.
- **Total agents per workflow lifetime: 1000** — a runaway-loop backstop far above any real workflow.
- **Per single `pipeline`/`parallel` call: 4096 items max** — passing more is an explicit error, not silent truncation.

## Runtime constraints (the things that throw)

- **Plain JavaScript, NOT TypeScript.** Type annotations (`: string[]`), interfaces, and generics fail to parse.
- **`Date.now()`, `Math.random()`, and argless `new Date()` THROW** — they would break resume. Pass timestamps via `args`, stamp results after the workflow returns, and for randomness vary the agent prompt/label by index.
- **No filesystem or Node.js APIs.** Standard JS built-ins (JSON, Math, Array, etc.) are available.
- The script body runs in an **async context** — use `await` directly.
- MCP tools are reachable via `ToolSearch` (schemas load on demand per agent). Caveat: interactively-authenticated MCP servers may be absent in headless/cron runs.

## Iteration and resume

- Author the script **inline** in the `Workflow` call (don't Write it first). Every invocation persists the script to a file under the session directory and returns the path.
- To iterate: **edit that path** with Edit/Write and re-invoke `Workflow({ scriptPath })` — don't resend the full script.
- To resume after a pause/kill/edit: `Workflow({ scriptPath, resumeFromRunId })`. The longest unchanged **prefix** of `agent()` calls returns cached results instantly; the first edited/new call and everything after runs live. Same script + same args -> 100% cache hit. Same-session only; stop the prior run (`TaskStop`) before resuming.
- This determinism is exactly **why** `Date.now()`/`Math.random()` are banned — they would make a replay diverge.
