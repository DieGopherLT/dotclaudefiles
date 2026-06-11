# Recipes

End-to-end workflow templates. Each is a complete, runnable shape — adapt the prompts and schemas to the task. Every recipe annotates its thinking load per role; that calibration is the difference between a workflow that nails the job and one that burns budget on retrieval.

Define the `*_SCHEMA` objects as JSON Schema literals at the top of each script. They are elided here for brevity.

## Recipe 1: Codebase review (pipeline, verify-as-you-go)

The canonical multi-stage shape. Each dimension verifies as soon as its review lands — `bugs` findings verify while `perf` is still under review, so no wall-clock is wasted on a barrier.

```js
export const meta = {
  name: 'review-changes',
  description: 'Review changed files per dimension and adversarially verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const DIMENSIONS = [
  { key: 'bugs', prompt: 'Review the diff for correctness bugs. Return findings.' },
  { key: 'perf', prompt: 'Review the diff for performance regressions. Return findings.' },
  { key: 'security', prompt: 'Review the diff for security issues. Return findings.' },
]

const results = await pipeline(
  DIMENSIONS,
  // Reviewer: open-ended judgment over a slice -> sonnet, inherits session effort
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', model: 'sonnet', schema: FINDINGS_SCHEMA }),
  // Skeptic: refute one finding -> cheap, parallel, close to the fan-out
  review => parallel((review?.findings ?? []).map(f => () =>
    agent(`Adversarially verify. Default to refuted=true if uncertain: ${f.title}`,
      { label: `verify:${f.file}`, phase: 'Verify', model: 'sonnet', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v })))),
)

return { confirmed: results.flat().filter(Boolean).filter(f => f.verdict?.isReal) }
```

When a **barrier is genuinely needed** — dedup across all dimensions before expensive verification:

```js
const all = await parallel(DIMENSIONS.map(d => () => agent(d.prompt, { model: 'sonnet', schema: FINDINGS_SCHEMA })))
const deduped = dedupeByFileAndLine(all.filter(Boolean).flatMap(r => r.findings))  // needs ALL at once
const verified = await parallel(deduped.map(f => () => agent(verifyPrompt(f), { model: 'sonnet', schema: VERDICT_SCHEMA })))
```

## Recipe 2: Multi-source research (scope -> sweep -> fetch -> verify -> synthesize)

Five phases. The fan-out (scope, search, fetch) is mechanical retrieval on `haiku`; the verify is adversarial; only the final synthesis pays for `opus`.

```js
export const meta = {
  name: 'deep-research',
  description: 'Fan out web searches, verify claims adversarially, synthesize a cited report',
  phases: [{ title: 'Scope' }, { title: 'Search' }, { title: 'Verify' }, { title: 'Synthesize' }],
}

const question = args?.question ?? 'state the research question via args'

// Scope: split into distinct angles so searches don't chase the same wording. One open-ended call -> opus.
const { angles } = await agent(
  `Decompose this question into 5 distinct search angles: ${question}`,
  { phase: 'Scope', model: 'opus', schema: ANGLES_SCHEMA })

// Search + fetch per angle, streaming. Mechanical retrieval -> haiku.
const claims = await pipeline(
  angles,
  a => agent(`Web-search this angle and return top sources: ${a}`, { phase: 'Search', model: 'haiku', schema: SOURCES_SCHEMA }),
  (sources) => agent(`Fetch these sources and extract atomic claims: ${JSON.stringify(sources)}`,
    { phase: 'Search', model: 'haiku', schema: CLAIMS_SCHEMA }),
)

// pipeline() has resolved all items; dedup over the full array in plain code (no agent needed)
const unique = dedupeClaims(claims.filter(Boolean).flatMap(c => c.claims))

// Adversarial 3-vote verify per claim. Survivors only.
const verified = await parallel(unique.map(c => () =>
  parallel(Array.from({ length: 3 }, () => () =>
    agent(`Try to refute this claim against its source. Default refuted=true if uncertain: ${c.text}`,
      { phase: 'Verify', model: 'sonnet', schema: VERDICT_SCHEMA })))
    .then(votes => ({ claim: c, kept: votes.filter(Boolean).filter(v => !v.refuted).length >= 2 }))))

const survivors = verified.filter(v => v.kept).map(v => v.claim)
log(`${survivors.length}/${unique.length} claims survived verification`)

// Synthesis: long-horizon writing from survivors -> opus, hot.
return await agent(`Write a cited report answering "${question}" from these verified claims: ${JSON.stringify(survivors)}`,
  { phase: 'Synthesize', model: 'opus', schema: REPORT_SCHEMA })
```

## Recipe 3: Large migration / language port (discover -> transform in worktrees -> verify)

The one place `isolation: 'worktree'` earns its cost: many agents mutating files in parallel would otherwise conflict. Discover the work-list inline first, then pipeline over it.

```js
export const meta = {
  name: 'migrate-modules',
  description: 'Transform each module in an isolated worktree, then verify it compiles',
  phases: [{ title: 'Transform' }, { title: 'Verify' }],
}

const modules = args?.modules ?? []   // discovered inline before launching the workflow

const results = await pipeline(
  modules,
  // Transformer: bounded edit per module. Pin model+effort via agentType so a hot session doesn't inflate it.
  m => agent(`Migrate module ${m.path} from ${m.from} to ${m.to}.`,
    { label: `migrate:${m.path}`, phase: 'Transform', agentType: 'chunk-typer', isolation: 'worktree', schema: MIGRATION_SCHEMA }),
  // Verifier: compile/test gate per module.
  (res, m) => agent(`Verify module ${m.path} compiles and its tests pass. Report failures.`,
    { label: `verify:${m.path}`, phase: 'Verify', model: 'sonnet', schema: GATE_SCHEMA })
    .then(gate => ({ module: m.path, ...gate })),
)

const failures = results.filter(Boolean).filter(r => !r.passed)
if (failures.length) log(`${failures.length} modules failed the gate: ${failures.map(f => f.module).join(', ')}`)
return { results: results.filter(Boolean) }
```

`chunk-typer` is a custom sub-agent definition with `model: sonnet` + `effort: medium` pinned in its frontmatter — the script can't express that effort directly (see `thinking-load.md`).

## Recipe 4: Exhaustive audit (loop-until-budget or loop-until-dry)

Scale depth to the user's token target, or to convergence. Guard the loop on `budget.total` so it terminates when no target is set.

```js
export const meta = {
  name: 'exhaustive-audit',
  description: 'Hunt findings until the budget or convergence is exhausted, verifying each',
  phases: [{ title: 'Hunt' }, { title: 'Verify' }],
}

const seen = new Set(), confirmed = []
let dry = 0

// Loop until two dry rounds OR budget exhausted.
while (dry < 2 && (!budget.total || budget.remaining() > 80_000)) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: 'Hunt', model: 'sonnet', schema: FINDINGS_SCHEMA }))))
    .filter(Boolean).flatMap(r => r.findings)

  const fresh = found.filter(x => !seen.has(key(x)))   // dedup vs seen — plain code
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach(x => seen.add(key(x)))

  const judged = await parallel(fresh.map(x => () =>
    agent(`Verify this finding. Default refuted=true if uncertain: ${x.title}`,
      { phase: 'Verify', model: 'opus', schema: VERDICT_SCHEMA })   // opus: a missed real issue is the failure mode
      .then(v => ({ x, real: !v.refuted }))))

  confirmed.push(...judged.filter(j => j.real).map(j => j.x))
  log(`${confirmed.length} confirmed, ${seen.size} seen, ${budget.total ? Math.round(budget.remaining() / 1000) + 'k left' : 'no budget cap'}`)
}
return { confirmed }
```

## Cross-cutting reminders

- **Dedup, filter, sort, route → plain code.** Never spend an `agent()` on what JavaScript does for free.
- **`.filter(Boolean)`** every fan-out result before use — skipped/dead agents are `null`.
- **`log()` every cap** (top-N, no-retry, sampling, budget exit) so a partial run never reads as complete.
- **Stamp timestamps after the workflow returns** — `Date.now()` throws inside the script.
