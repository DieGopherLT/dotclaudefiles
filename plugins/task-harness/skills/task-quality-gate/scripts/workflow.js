export const meta = {
  name: 'task-quality-gate',
  description: 'Review a changeset from up to ten independent angles in parallel, adversarially verify every candidate finding, optionally sweep for what the angles missed, and return the survivors ranked correctness-first, then by verdict and confidence.',
  phases: [
    { title: 'Review', detail: 'one read-only auditor per angle, each sweeping the same patch for its own class of defect' },
    { title: 'Verify', detail: 'one adversarial verifier per candidate finding, streaming as each angle lands' },
    { title: 'Sweep', detail: 'deeper bands only: one gap-sweeper over the deduplicated set, hunting what no angle could see' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the task-quality-gate skill via args)
//   args.effort:     string  band selected by the skill: medium | high | xhigh | max
//   args.patchPath:  string  absolute path to the .patch of base..HEAD, generated
//                            ONCE by the skill. Every agent reads this same file,
//                            which is why none of them needs Bash.
//   args.baseBranch: string  the ref the work diverged from
//   args.repoRoot:   string  absolute repo root; findings come back repo-relative
//   args.extraAuditors: string[]  optional agent names of EXTERNAL domain
//                            auditors (never this plugin's own). Each runs as
//                            one more review angle: same briefing, same output
//                            schema, same adversarial verification.
//
// args may arrive as a JSON-encoded string depending on how the caller
// serialized the Workflow input; normalize so nothing is lost.
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const patchPath = typeof input?.patchPath === 'string' ? input.patchPath : ''
const baseBranch = typeof input?.baseBranch === 'string' ? input.baseBranch : 'main'
const repoRoot = typeof input?.repoRoot === 'string' ? input.repoRoot : ''

function normalizeArgs(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw ?? {}
}

// ---------------------------------------------------------------------------
// Bands. This table is the ONLY source of variation between effort levels —
// every other line of this script runs identically at every band.
//
//   correctness  how many of the five correctness angles run. 3 activates
//                A-C; 5 adds D (language pitfalls) and E (wrapper contracts).
//                The five quality angles always run.
//   candidates   max findings ONE angle may forward to verification. A backstop
//                against a single runaway angle flooding the verify fan-out, not
//                an expected ceiling — angles normally return a handful.
//   bias         precision or recall, passed verbatim into every angle prompt.
//   threshold    the confidence cut injected into each angle. The agents carry
//                the 0-100 rubric; the cut lives here because a recall-biased
//                band needs a lower one and a fixed 80 would silence it.
//   sweep        whether the gap-sweeper phase runs at all.
//   cap          max findings in the returned report.
//   effort       reasoning-effort override passed into every agent() call.
//                null inherits each agent's frontmatter calibration; 'max'
//                is the one lever that separates the max band from xhigh.
//
// The built-in reviewer's minimum-findings floor is deliberately NOT ported: it
// is an antidote to one inline pass going lazy, and eight-to-ten independent
// agents satisfy it structurally.
// ---------------------------------------------------------------------------

const BANDS = {
  medium: { correctness: 3, candidates: 6, bias: 'precision', threshold: 80, sweep: false, cap: 8, effort: null },
  high: { correctness: 3, candidates: 6, bias: 'recall', threshold: 50, sweep: false, cap: 10, effort: null },
  xhigh: { correctness: 5, candidates: 8, bias: 'recall', threshold: 50, sweep: true, cap: 15, effort: null },
  max: { correctness: 5, candidates: 8, bias: 'recall', threshold: 50, sweep: true, cap: 15, effort: 'max' },
}

const DEFAULT_BAND = 'high'

function resolveBand(effort) {
  const key = typeof effort === 'string' ? effort.toLowerCase() : ''
  if (BANDS[key]) return { name: key, ...BANDS[key] }
  log(`Unknown or missing effort band "${effort}" — falling back to ${DEFAULT_BAND}.`)
  return { name: DEFAULT_BAND, ...BANDS[DEFAULT_BAND] }
}

// Resolved here, after BANDS exists: resolveBand reads the table at call time,
// and const bindings are TDZ-locked until their declaration runs.
const band = resolveBand(input?.effort)

// ---------------------------------------------------------------------------
// The angles. Order matters only for display; every angle is independent and
// blind to the others — that independence is what makes the union worth more
// than any single deeper pass.
//
// `model` mirrors each agent's own frontmatter so the calibration is auditable
// from one table. Effort lives in each agent's frontmatter; the max band
// overrides it per call through agent()'s `effort` option — see BANDS.
// ---------------------------------------------------------------------------

const CORRECTNESS_ANGLES = [
  { key: 'diff-lines', agent: 'diff-line-scanner', model: 'sonnet', focus: 'every changed line, tested against the catalog of common failure modes: boundaries, inverted conditions, absence handling, error paths, missing awaits, copy-paste residue' },
  { key: 'removed-behavior', agent: 'removed-behavior-auditor', model: 'opus', focus: 'only what the changeset deleted or replaced: name the invariant each removal enforced, then prove where the new code re-establishes it or report it lost' },
  { key: 'cross-file', agent: 'cross-file-tracer', model: 'opus', focus: 'every contract the diff changed, traced outward to its call sites and consumers, reporting the ones left stale or incompatible' },
  { key: 'language-pitfalls', agent: 'language-pitfall-auditor', model: 'sonnet', focus: "the language's own footguns in the changed code: constructs that read correctly and behave otherwise" },
  { key: 'wrapper-contracts', agent: 'wrapper-contract-auditor', model: 'sonnet', focus: 'every wrapper, adapter, or middleware the diff added or altered, checked for fidelity to the contract it delegates to' },
]

const QUALITY_ANGLES = [
  { key: 'reuse', agent: 'reuse-auditor', model: 'sonnet', focus: 'new code that duplicates something the repository or an existing dependency already provides, cited as path::symbol' },
  { key: 'simplification', agent: 'simplification-auditor', model: 'sonnet', focus: 'added machinery the task did not require: unreachable branches, redundant state, indirection with one caller, conditionals that collapse' },
  { key: 'efficiency', agent: 'efficiency-auditor', model: 'sonnet', focus: 'work done more times or over more data than needed, judged at the scale the code will actually run' },
  { key: 'altitude', agent: 'altitude-auditor', model: 'opus', focus: 'the shape of the change above the line: concerns landing at the wrong layer, coupling introduced, special cases that should be a mechanism' },
  { key: 'conventions', agent: 'conventions-auditor', model: 'sonnet', focus: "deviations from rules the project itself states, each quoted from the file that states it" },
]

const AGENT_NAMESPACE = 'task-harness'

// Rank tables live above the main flow on purpose: rank() and outranks() are
// called mid-pipeline, before the tail of this script has initialized.
const VERDICT_RANK = { CONFIRMED: 2, PLAUSIBLE: 1 }
const CLASS_RANK = { correctness: 1, quality: 0 }

// External domain auditors arrive by name and run as additional angles. Their
// agentType is the name verbatim (no namespace prefix), their model and effort
// come from their own frontmatter, and their focus defers to their own system
// prompt. Anything from this plugin's namespace is dropped: the built-in
// angles above already cover it, and doubling them would double the fan-out.
const EXTRA_ANGLES = (Array.isArray(input?.extraAuditors) ? input.extraAuditors : [])
  .filter((name) => typeof name === 'string' && name.length > 0)
  .filter((name) => {
    const isOwnNamespace = name.startsWith(`${AGENT_NAMESPACE}:`)
    if (isOwnNamespace) log(`Ignoring extra auditor "${name}" — the built-in angles already run this plugin's agents.`)
    return !isOwnNamespace
  })
  .map((name) => ({
    key: `extra:${name}`,
    agent: name,
    external: true,
    focus: 'the specialty defined in your own instructions, applied to this changeset only',
  }))

const angles = [...CORRECTNESS_ANGLES.slice(0, band.correctness), ...QUALITY_ANGLES, ...EXTRA_ANGLES]

// ---------------------------------------------------------------------------
// Schemas. FINDING_SCHEMA is deliberately shaped to the host's ReportFindings
// tool so the skill can hand findings over without remapping fields: file,
// line, summary, short_summary, failure_scenario, category. `confidence` is
// this pipeline's own, used for ranking and the cap; `verdict` is grafted on
// from the verifier, not requested from the angles.
// ---------------------------------------------------------------------------

const FINDING_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'category', 'short_summary', 'summary', 'failure_scenario', 'confidence'],
        properties: {
          file: { type: 'string', description: 'repo-relative path of the file the finding is in' },
          line: { type: 'number', description: '1-indexed line in the file current state' },
          category: { type: 'string', description: 'short kebab-case slug of the finding type' },
          short_summary: { type: 'string', description: 'at most 60 characters: the claim alone, no rationale' },
          summary: { type: 'string', description: 'one sentence stating the defect' },
          failure_scenario: { type: 'string', description: 'concrete inputs or state, then the wrong output or crash' },
          confidence: { type: 'number', description: '0-100 against the rubric in the agent definition' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'reasoning'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['CONFIRMED', 'PLAUSIBLE', 'REFUTED', 'PRE_EXISTING'],
      description: 'REFUTED requires naming the blocker; CONFIRMED requires tracing the failure path; PRE_EXISTING marks a real defect that predates the changeset',
    },
    reasoning: { type: 'string', description: 'two to four sentences naming the specific line that decided the verdict' },
    corrected_file: { type: 'string', description: 'only when the finding is real but anchored at the wrong file' },
    corrected_line: { type: 'number', description: 'only when the finding is real but anchored at the wrong line' },
  },
}

// ---------------------------------------------------------------------------
// Guard the one input without which nothing downstream can work. Every agent
// reads the patch; with no path there is no review to run.
// ---------------------------------------------------------------------------

if (!patchPath) {
  log('No args.patchPath provided — the gate cannot review a changeset it cannot read.')
  return { band: band.name, findings: [], preExisting: [], counts: { raw: 0, deduped: 0, verified: 0, swept: 0, preExisting: 0 } }
}

log(`Band ${band.name}: ${angles.length} angles, bias ${band.bias}, confidence cut ${band.threshold}, sweep ${band.sweep ? 'on' : 'off'}.`)

// ---------------------------------------------------------------------------
// Review -> Verify, as a pipeline with NO barrier between the stages. An angle
// that lands early has its findings under verification while slower angles are
// still reading, so wall-clock is the slowest single angle-plus-verify chain
// rather than slowest-review plus slowest-verify.
// ---------------------------------------------------------------------------

const reviewed = await pipeline(angles, reviewAngle, verifyAngleFindings)

// Barrier reached: every angle has reviewed and every candidate has been
// verified. THIS is where the whole set is genuinely needed at once — dedup
// compares findings across angles, and the sweeper below must receive the
// complete list to know what NOT to report.
const verifiedFindings = reviewed.filter(Boolean).flat().filter(Boolean)

// PRE_EXISTING survivors are real defects the verifier dated before the
// branch. They never enter the report — the skill dispatches them to
// base-branch worktrees — but silently dropping them would starve that
// dispatch, which is why they ride a channel of their own.
const rawCount = verifiedFindings.length
const inScope = verifiedFindings.filter((finding) => finding.verdict !== 'PRE_EXISTING')
const preExistingRaw = verifiedFindings.filter((finding) => finding.verdict === 'PRE_EXISTING')
const deduped = dedupe(inScope)

log(`${rawCount} verified findings across ${angles.length} angles, ${deduped.length} in scope after dedup, ${preExistingRaw.length} pre-existing.`)

const sweptFindings = band.sweep ? await runSweep(deduped) : []
const sweptInScope = sweptFindings.filter((finding) => finding.verdict !== 'PRE_EXISTING')

const preExisting = rank(dedupe([...preExistingRaw, ...sweptFindings.filter((finding) => finding.verdict === 'PRE_EXISTING')]))
const merged = dedupe([...deduped, ...sweptInScope])
const ranked = rank(merged)
const capped = applyCap(ranked)

return {
  band: band.name,
  findings: capped,
  preExisting,
  counts: {
    raw: rawCount,
    deduped: deduped.length,
    verified: merged.length,
    swept: sweptInScope.length,
    preExisting: preExisting.length,
  },
}

// ---------------------------------------------------------------------------
// Stage 1: reviewAngle — one auditor sweeps the patch for its own class of
// defect. Every angle receives the same patch path, the same scope, and the
// band's threshold and bias; nothing else distinguishes them but their own
// system prompt.
// ---------------------------------------------------------------------------

async function reviewAngle(angle) {
  const result = await agent(buildAnglePrompt(angle), {
    label: `review:${angle.key}`,
    phase: 'Review',
    ...(angle.model ? { model: angle.model } : {}),
    ...(band.effort ? { effort: band.effort } : {}),
    schema: FINDING_SCHEMA,
    agentType: angle.external ? angle.agent : `${AGENT_NAMESPACE}:${angle.agent}`,
  })

  // The class drives the ranking rule downstream: a correctness bug always
  // outranks a quality finding when the cap forces a cut. It is stamped from
  // the angle's own list membership, never trusted from the agent's free-form
  // category slug. External domain auditors hunt defects in their domain, not
  // style, so they rank as correctness.
  const angleClass = CORRECTNESS_ANGLES.includes(angle) || angle.external ? 'correctness' : 'quality'
  const found = (result?.findings ?? [])
    .filter((finding) => isReportable(finding))
    .map((finding) => ({ ...finding, class: angleClass }))

  if (found.length > band.candidates) {
    log(`Angle ${angle.key} returned ${found.length} findings; forwarding the ${band.candidates} highest-confidence and dropping ${found.length - band.candidates}.`)
  }

  return { angle, findings: rank(found).slice(0, band.candidates) }
}

function buildAnglePrompt(angle) {
  return [
    `Review the changeset in the patch at ${patchPath} — a unified diff of ${baseBranch}..HEAD.`,
    repoRoot ? `The repository root is ${repoRoot}; emit every file path repo-relative to it.` : '',
    `Your angle: ${angle.focus}.`,
    `Confidence threshold: ${band.threshold}. Bias: ${band.bias}.`,
    `Report every finding you score at or above ${band.threshold} and discard the rest. Score against the rubric in your instructions first, then filter — never re-tune a score to clear the cut.`,
    band.bias === 'recall'
      ? 'Under recall bias, an uncertain finding is worth reporting: an adversarial verifier will refute what does not hold, so a miss costs more than a refutation.'
      : 'Under precision bias, report only what you are confident in. A short list of actionable findings beats a padded one.',
    'Anchor every finding at a 1-indexed line in the file current state, not at the patch line numbering. An empty findings array is a valid, correct answer.',
  ]
    .filter(Boolean)
    .join(' ')
}

// A finding with no location or no failure scenario cannot be acted on, and
// cannot be rendered by the host's findings UI. Drop it here rather than let it
// consume a verifier.
function isReportable(finding) {
  return Boolean(finding && finding.file && Number.isFinite(finding.line) && finding.summary && finding.failure_scenario)
}

// ---------------------------------------------------------------------------
// Stage 2: verifyAngleFindings — one adversarial verifier per candidate, all
// concurrent. This inner barrier is scoped to a single angle's findings, so it
// never blocks a sibling angle still in stage 1.
//
// REFUTED findings are dropped here and never reach the caller. PLAUSIBLE ones
// survive: they are what a recall-biased band exists to surface, and the skill
// arbitrates them with context this pipeline does not have.
// ---------------------------------------------------------------------------

async function verifyAngleFindings(reviewResult) {
  if (!reviewResult || reviewResult.findings.length === 0) return []

  const verdicts = await parallel(
    reviewResult.findings.map((finding, index) => () =>
      agent(buildVerifyPrompt(finding), {
        label: `verify:${reviewResult.angle.key}:${index + 1}`,
        phase: 'Verify',
        model: 'opus',
        ...(band.effort ? { effort: band.effort } : {}),
        schema: VERDICT_SCHEMA,
        agentType: `${AGENT_NAMESPACE}:finding-verifier`,
      }).then((verdict) => applyVerdict(finding, verdict)),
    ),
  )

  return verdicts.filter(Boolean)
}

function buildVerifyPrompt(finding) {
  return [
    'Adversarially verify ONE candidate finding. Your default posture is refutation: open the cited code and hunt for the guard, type, caller, or configuration that makes the claimed failure impossible.',
    `Patch: ${patchPath} (unified diff of ${baseBranch}..HEAD).`,
    repoRoot ? `Repository root: ${repoRoot}.` : '',
    `Finding location: ${finding.file}:${finding.line}`,
    `Category: ${finding.category}`,
    `Claim: ${finding.summary}`,
    `Failure scenario asserted: ${finding.failure_scenario}`,
    `The auditor scored this ${finding.confidence}. Treat that as context, never as evidence.`,
    'Return REFUTED only if you found the specific blocker; PRE_EXISTING if the defect is real but predates this changeset; CONFIRMED only if you traced the failure path end to end; PLAUSIBLE when it survives refutation but you could not close the trace. Cite the line that decided it.',
  ]
    .filter(Boolean)
    .join(' ')
}

// A verifier that died or was skipped returns null. Treat that as "unverified"
// rather than silently promoting or dropping the finding: keep it as PLAUSIBLE
// so the arbiter still sees it, and say so in the log. PRE_EXISTING survives
// this function too — the main flow partitions it into its own channel. The
// verifier's reasoning rides along because arbitration is exactly where it is
// needed.
function applyVerdict(finding, verdict) {
  if (!verdict) {
    log(`Verifier did not return for ${finding.file}:${finding.line} — carrying the finding as PLAUSIBLE.`)
    return { ...finding, verdict: 'PLAUSIBLE', verdict_reasoning: 'The verifier did not return; the finding is carried unverified.' }
  }

  if (verdict.verdict === 'REFUTED') return null

  return {
    ...finding,
    file: verdict.corrected_file ?? finding.file,
    line: Number.isFinite(verdict.corrected_line) ? verdict.corrected_line : finding.line,
    verdict: verdict.verdict,
    verdict_reasoning: verdict.reasoning,
  }
}

// ---------------------------------------------------------------------------
// Sweep — deeper bands only. The gap-sweeper is the one agent in this review
// that sees what the others found, and it sees it in order to EXCLUDE it. Its
// own findings go through the same adversarial verification as everyone else's.
// ---------------------------------------------------------------------------

async function runSweep(knownFindings) {
  const result = await agent(buildSweepPrompt(knownFindings), {
    label: 'sweep:gaps',
    phase: 'Sweep',
    model: 'opus',
    ...(band.effort ? { effort: band.effort } : {}),
    schema: FINDING_SCHEMA,
    agentType: `${AGENT_NAMESPACE}:gap-sweeper`,
  })

  // The sweeper hunts defects, not cleanup, so its findings rank as correctness.
  const candidates = rank(
    (result?.findings ?? [])
      .filter((finding) => isReportable(finding))
      .map((finding) => ({ ...finding, class: 'correctness' })),
  ).slice(0, band.candidates)

  if (candidates.length === 0) {
    log('Sweep found no gaps — the angles covered the changeset.')
    return []
  }

  const verdicts = await parallel(
    candidates.map((finding, index) => () =>
      agent(buildVerifyPrompt(finding), {
        label: `verify:sweep:${index + 1}`,
        phase: 'Sweep',
        model: 'opus',
        ...(band.effort ? { effort: band.effort } : {}),
        schema: VERDICT_SCHEMA,
        agentType: `${AGENT_NAMESPACE}:finding-verifier`,
      }).then((verdict) => applyVerdict(finding, verdict)),
    ),
  )

  const survivors = verdicts.filter(Boolean)
  log(`Sweep surfaced ${candidates.length} gap candidates, ${survivors.length} survived verification.`)
  return survivors
}

function buildSweepPrompt(knownFindings) {
  const known = knownFindings.length
    ? knownFindings.map((f) => `- ${f.file}:${f.line} [${f.category}] ${f.summary}`).join('\n')
    : '(none — the angles reported nothing)'

  return [
    `Sweep the changeset in the patch at ${patchPath} — a unified diff of ${baseBranch}..HEAD — for what the review angles could NOT see.`,
    repoRoot ? `The repository root is ${repoRoot}; emit every file path repo-relative to it.` : '',
    `Confidence threshold: ${band.threshold}. Bias: ${band.bias}.`,
    'The findings below are your EXCLUSION list. Never re-report one, not in a different category and not in different words. Hunt only the gaps between the angles: interactions between separately-correct changes, second-order consequences, assumptions nobody checked, and changes the diff should have made and did not.',
    'An empty findings array is the expected result on a well-covered changeset.',
    '',
    'Known findings:',
    known,
  ]
    .filter((part) => part !== undefined)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Dedup. Angles run blind to each other, so the same defect can surface from
// two of them under different categories. Collapse by location plus normalized
// claim, and keep the strongest survivor: a CONFIRMED verdict outranks a
// PLAUSIBLE one, and confidence breaks the tie.
// ---------------------------------------------------------------------------

function dedupe(findings) {
  const byKey = new Map()

  for (const finding of findings) {
    const key = dedupeKey(finding)
    const incumbent = byKey.get(key)
    if (!incumbent || outranks(finding, incumbent)) byKey.set(key, finding)
  }

  return [...byKey.values()]
}

// Two angles rarely agree on the exact line of the same defect, so the key
// buckets lines into groups of five. The normalized claim keeps two genuinely
// different findings inside one bucket from collapsing into each other.
function dedupeKey(finding) {
  const lineBucket = Math.floor((finding.line ?? 0) / 5)
  return `${finding.file}:${lineBucket}:${normalizeClaim(finding.short_summary ?? finding.summary ?? '')}`
}

function normalizeClaim(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
}


function outranks(candidate, incumbent) {
  const candidateVerdict = VERDICT_RANK[candidate.verdict] ?? 0
  const incumbentVerdict = VERDICT_RANK[incumbent.verdict] ?? 0
  if (candidateVerdict !== incumbentVerdict) return candidateVerdict > incumbentVerdict
  return (candidate.confidence ?? 0) > (incumbent.confidence ?? 0)
}

// ---------------------------------------------------------------------------
// Rank and cap. Most-severe first is what the host's findings UI expects, and
// what the skill needs to dispatch fixes in a sensible order. Class comes
// first: a correctness bug always outranks a quality finding when the cap
// forces a cut, so a high-confidence conventions nit can never evict a
// plausible race. Array sort is stable in JS, so equal-ranked findings keep
// the order the angles produced.
// ---------------------------------------------------------------------------


function rank(findings) {
  return [...findings].sort((a, b) => {
    const classDelta = (CLASS_RANK[b.class] ?? 0) - (CLASS_RANK[a.class] ?? 0)
    if (classDelta !== 0) return classDelta
    const verdictDelta = (VERDICT_RANK[b.verdict] ?? 0) - (VERDICT_RANK[a.verdict] ?? 0)
    if (verdictDelta !== 0) return verdictDelta
    return (b.confidence ?? 0) - (a.confidence ?? 0)
  })
}

function applyCap(findings) {
  if (findings.length <= band.cap) return findings
  log(`${findings.length} findings survived; reporting the ${band.cap} highest-ranked and dropping ${findings.length - band.cap}.`)
  return findings.slice(0, band.cap)
}
