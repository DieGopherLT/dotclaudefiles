# Quality Patterns

The fan-out is not the leverage of a workflow — these patterns are. They turn a pile of parallel agents into a trustworthy answer. Pick by task and compose freely; the section ends with a composed example that stacks several.

Each pattern below notes the **thinking load** for its roles, since calibration is where most of the cost lives (see `thinking-load.md`).

## Adversarial verify

Spawn N independent skeptics per finding, each prompted to **refute**, not to confirm. Kill the finding if a majority refute. This stops plausible-but-wrong findings from surviving on a single agent's say-so.

```js
const votes = await parallel(Array.from({ length: 3 }, () => () =>
  agent(`Try to refute this claim: ${claim}. Default to refuted=true if uncertain.`,
    { model: 'sonnet', schema: VERDICT })))
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```

Thinking load: skeptics are narrow (one claim each) and run in parallel, so cost adds up — keep them on `sonnet`, or pin a shallow `agentType` if the session runs hot. The bias toward `refuted=true` on uncertainty is deliberate: it's cheaper to re-find a wrongly-killed real bug than to ship a false positive.

## Perspective-diverse verify

When a finding can fail in more than one way, give each verifier a **distinct lens** instead of N identical skeptics. Diversity catches failure modes that redundancy cannot.

```js
const lenses = ['correctness', 'security', 'does-it-reproduce']
const checks = await parallel(lenses.map(lens => () =>
  agent(`Judge "${finding.desc}" through the ${lens} lens. Is it real?`,
    { label: `verify:${lens}`, model: 'sonnet', schema: VERDICT })))
const real = checks.filter(Boolean).filter(v => v.real).length >= 2
```

Use this over plain adversarial verify when the claim is multi-dimensional (a perf finding might be correct but irreproducible, or reproducible but a security non-issue).

## Judge panel

Generate N independent attempts from different angles, score them with parallel judges, then synthesize from the winner while grafting the best ideas from the runners-up. Beats one-attempt-iterated when the solution space is wide.

```js
const ANGLES = ['MVP-first', 'risk-first', 'user-first']
const attempts = await parallel(ANGLES.map(a => () =>
  agent(`Design the solution, ${a}.`, { label: `design:${a}`, model: 'opus', schema: DESIGN })))
const scored = await parallel(attempts.filter(Boolean).map(d => () =>
  agent(`Score this design 1-10 on feasibility and coverage: ${JSON.stringify(d)}`,
    { model: 'sonnet', schema: SCORE })))
const winner = pickHighest(attempts, scored)
const final = await agent(
  `Write the final design from the winner, grafting the best ideas from the others: ${JSON.stringify({ winner, attempts })}`,
  { model: 'opus', schema: DESIGN })
```

Thinking load: attempts and synthesis are open-ended → `opus`; the judges are bounded scoring → `sonnet`.

## Loop-until-dry

For unknown-size discovery (bugs, edge cases, issues), keep spawning finders until **K consecutive rounds** surface nothing new. Simple counters (`while count < N`) miss the tail.

```js
const seen = new Set(), confirmed = []
let dry = 0
while (dry < 2) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: 'Find', model: 'sonnet', schema: BUGS }))))
    .filter(Boolean).flatMap(r => r.bugs)
  const fresh = found.filter(b => !seen.has(key(b)))   // dedup is plain code, not an agent
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach(b => seen.add(key(b)))
  confirmed.push(...fresh)
}
```

**The convergence pitfall:** dedup against `seen` (everything ever found), **not** against `confirmed`. If you dedup against the confirmed set, a finding the judge rejected is "not confirmed", so it looks fresh again next round, gets re-judged, rejected again — and the loop never converges. `seen` must accumulate *every* candidate, accepted or not.

## Multi-modal sweep

Parallel agents each searching a **different way** — by-container, by-content, by-entity, by-time. Each is blind to what the others surface; useful when no single search angle finds everything.

```js
const MODES = [
  'Search by file/module structure',
  'Search by string/content grep',
  'Search by entity/symbol references',
  'Search by recent git history',
]
const hits = (await parallel(MODES.map(m => () =>
  agent(`${m}. Return matches for: ${target}`, { model: 'haiku', schema: MATCHES }))))
  .filter(Boolean).flatMap(r => r.matches)
const unique = dedupe(hits)
```

Thinking load: sweep agents are mechanical retrieval → `haiku`. This is the canonical cheap fan-out base.

## Completeness critic

A final agent whose only job is to ask "what's missing — a modality not run, a claim unverified, a source unread?" What it finds becomes the next round of work. This is the antidote to a fan-out that confidently reports a partial answer.

```js
const gaps = await agent(
  `Here is everything gathered: ${JSON.stringify(results)}. ` +
  `What is missing? Name modalities not run, claims unverified, sources unread.`,
  { model: 'opus', schema: GAPS })
if (gaps.items.length) { /* spawn another targeted round on gaps.items */ }
```

Thinking load: it must reason over the entire result set → `opus`, high effort.

## Composed example: exhaustive review

Find -> dedup vs seen -> diverse-lens panel -> loop-until-dry, stacking four patterns:

```js
const seen = new Set(), confirmed = []
let dry = 0
while (dry < 2) {
  // barrier: collect all finders this round (cheap fleet on sonnet)
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: 'Find', model: 'sonnet', schema: BUGS })))).filter(Boolean).flatMap(r => r.bugs)

  const fresh = found.filter(b => !seen.has(key(b)))   // dedup vs ALL seen — plain code
  if (!fresh.length) { dry++; continue }
  dry = 0
  fresh.forEach(b => seen.add(key(b)))

  // every fresh bug judged by 3 distinct lenses, all concurrent
  const judged = await parallel(fresh.map(b => () =>
    parallel(['correctness', 'security', 'repro'].map(lens => () =>
      agent(`Judge "${b.desc}" via the ${lens} lens — real?`, { phase: 'Verify', model: 'sonnet', schema: VERDICT })))
      .then(vs => ({ b, real: vs.filter(Boolean).filter(v => v.real).length >= 2 }))))

  confirmed.push(...judged.filter(v => v.real).map(v => v.b))
}
return confirmed
// dedup vs `seen`, NOT `confirmed` — else judge-rejected findings reappear every round and it never converges.
```

## Choosing and scaling

- "find any bugs" → a few finders, single-vote verify.
- "audit this thoroughly" / "be comprehensive" → larger finder pool, 3-5 vote adversarial or perspective-diverse pass, a synthesis stage, and a completeness critic.
- Always `log()` anything you cap (top-N, no-retry, sampling) — a silent cap reads as full coverage when it isn't.

These are not exhaustive. Compose novel harnesses when the task calls for it — tournament brackets, self-repair loops, staged escalation — the primitives support any control flow plain JavaScript can express.
