export const meta = {
  name: 'refactor',
  description: 'Apply refactoring.guru techniques: intra-domain fan-out in parallel, cross-cutting findings reconciled serially with a whole-project build gate.',
  phases: [
    { title: 'Plan', detail: 'split findings into intra-domain, cross-cutting, and skipped batches (plain JS, no fs)' },
    { title: 'Apply', detail: 'one refactoring-applier per domain, serial within a domain, parallel across domains' },
    { title: 'Mark', detail: 'refactoring-reconciler stages the quiescent tree and makes the rollback commit' },
    { title: 'Reconcile', detail: 'cross-cutting findings applied serially, then a whole-project build gate' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the refactor skill via args) — the skill pre-loads everything;
// this script touches no filesystem.
//   args.sotContents:   object[]  per-domain SoT objects, already parsed
//   args.sotFilePaths:  object    domain -> absolute SoT file path, so Apply
//                                 can point each applier at its finding's
//                                 file instead of re-embedding every field
//   args.buildCmd:      string    whole-project build/test gate
//   args.testCmd:       string    scoped safe-cycle test command
//   args.projectRoot:   string    absolute path inside the dedicated worktree
//   args.baseRef:       string    SHA captured before entering (or already
//                                 inside) the dedicated worktree — used as
//                                 the rollback point when the intra-domain
//                                 lane makes no changes to stage
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const sotContents = Array.isArray(input?.sotContents) ? input.sotContents : []
const sotFilePaths = input?.sotFilePaths ?? {}
const buildCmd = input?.buildCmd
const testCmd = input?.testCmd
const projectRoot = input?.projectRoot
const baseRef = input?.baseRef

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

// The applier is frozen (CON-001) and reports in its own Markdown voice — it
// has no grounding for "domain" (it only ever sees one file/location) and no
// instruction to reason about a "technique" field distinct from the prose it
// already writes. Rather than trust an echoed value it was never told to
// produce faithfully, the schema only asks it for what it CAN judge — whether
// the edit happened, was skipped, and preserved behavior — and this script
// fills in domain/technique/code itself from the finding it already knows.
const APPLIER_SCHEMA = {
  type: 'object',
  required: ['applied', 'skipped', 'reason', 'behaviorPreserved'],
  properties: {
    applied: { type: 'boolean' },
    skipped: { type: 'boolean' },
    reason: { type: ['string', 'null'] },
    behaviorPreserved: { type: 'boolean' },
  },
}

const RECONCILER_MARK_SCHEMA = {
  type: 'object',
  required: ['rollbackSha'],
  properties: { rollbackSha: { type: 'string' } },
}

const RECONCILER_RECONCILE_SCHEMA = {
  type: 'object',
  required: ['buildPasses', 'intraDomainHealthy', 'crossCuttingApplied', 'output'],
  properties: {
    buildPasses: { type: 'boolean' },
    intraDomainHealthy: { type: 'boolean' },
    crossCuttingApplied: { type: 'boolean' },
    output: { type: 'string', description: 'captured command output/exit code evidence for the build gate(s) actually run' },
  },
}

// ---------------------------------------------------------------------------
// Phase: Plan — pure JS, no agent() calls, no filesystem access (the sandbox
// has none). Flatten every domain's SoT findings into one array, tag each
// with its parent domain, then bucket by resolution shape.
//
// A finding's cross_cutting flag is already computed by smell-scan's
// synthesis (CON-004's fixed smell-name set) and persisted in the SoT — it
// is authoritative here, not recomputed, so the two skills can never drift
// on what counts as cross-cutting. Everything else is checked against a
// cheap heuristic: does resolution_plan mention a path outside this
// finding's own domain? This regex is only a pre-filter — it trims the
// obvious cases before spending an applier call. It is NOT the single-owner
// guarantee: that enforcement happens inside the Apply-phase applier prompt
// itself (the domain-boundary instruction below), since the sandbox here
// cannot run tests, check coverage, or judge what a resolution plan touches.
// ---------------------------------------------------------------------------

phase('Plan')

const allFindings = sotContents.flatMap((sot) =>
  (sot.findings ?? []).map((finding) => ({ ...finding, domain: sot.domain })),
)

const PATH_TOKEN = /[\w.-]+(?:\/[\w.-]+)+/g

function resolutionSpansDomain(finding) {
  const tokens = finding.resolution_plan?.match(PATH_TOKEN) ?? []
  return tokens.some((token) => token !== finding.domain && !token.startsWith(`${finding.domain}/`))
}

const crossCuttingBatch = allFindings.filter((finding) => finding.cross_cutting)

const skippedBatch = allFindings
  .filter((finding) => !finding.cross_cutting && resolutionSpansDomain(finding))
  .map((finding) => ({
    ...finding,
    reason: 'resolution spans domains, not in cross-cutting set — manual follow-up',
  }))

const intraDomainBatches = allFindings
  .filter((finding) => !finding.cross_cutting && !resolutionSpansDomain(finding))
  .reduce((batches, finding) => {
    batches[finding.domain] ??= []
    batches[finding.domain].push(finding)
    return batches
  }, {})

log(`Plan: ${allFindings.length} findings — ${Object.values(intraDomainBatches).flat().length} intra-domain, ${crossCuttingBatch.length} cross-cutting, ${skippedBatch.length} skipped (spanning-but-unnamed).`)

// ---------------------------------------------------------------------------
// Phase: Apply — parallel() across domains that have intra-domain findings;
// within a domain, findings are processed serially (one refactoring-applier
// call per finding), mirroring the per-module serial pattern used elsewhere
// in this repo's Workflow scripts. Appliers are edit-only: the domain-
// boundary and no-safety-net instructions ride in the prompt because
// CON-001 freezes the applier's own .md body — this is where they compose
// at runtime instead.
// ---------------------------------------------------------------------------

phase('Apply')

const domainsWithWork = Object.keys(intraDomainBatches)

const applyResults = await parallel(
  domainsWithWork.map((domain) => () => applyDomain(domain, intraDomainBatches[domain])),
)

async function applyDomain(domain, findings) {
  const outcomes = []
  for (const finding of findings) {
    const outcome = await agent(applyPrompt(finding, { crossCutting: false }), {
      label: `apply:${domain}:${finding.code}`,
      phase: 'Apply',
      schema: APPLIER_SCHEMA,
      agentType: 'refactoring-guru:refactoring-applier',
    })
    outcomes.push(toOutcome(outcome, finding, domain))
  }
  return { domain, outcomes }
}

// Builds the outcome this script reports for one finding, regardless of what
// the applier echoed. domain/technique/code are always known from the
// finding itself — the applier is never trusted to restate them (see
// APPLIER_SCHEMA above).
function toOutcome(outcome, finding, domain) {
  return {
    applied: Boolean(outcome?.applied),
    skipped: outcome ? Boolean(outcome.skipped) : true,
    reason: outcome?.reason ?? (outcome ? null : 'agent call failed'),
    behaviorPreserved: Boolean(outcome?.behaviorPreserved),
    technique: finding.technique,
    domain,
    code: finding.code,
  }
}

function applyPrompt(finding, { crossCutting }) {
  const sotFilePath = sotFilePaths[finding.domain]
  const boundaryConstraint = crossCutting
    ? `This finding is cross-cutting — its resolution is explicitly allowed to touch files outside a single domain.`
    : `Only edit files under ${finding.domain}. If completing the resolution plan requires touching a file outside that domain, stop and report { skipped: true, reason: "spans domains" } instead of making the edit.`

  return `Read finding "${finding.code}" from ${sotFilePath} — it is the source of truth for the technique, file, location, smell context, and resolution plan to apply.
Run the scoped safe cycle with: ${testCmd}

Two hard constraints for this autonomous run, overriding your default interactive behavior:
- If no test covers this location, do NOT proceed with the smallest-steps fallback described in your own instructions. Instead report { skipped: true, reason: "no safety net" } and stop.
- ${boundaryConstraint}

Do not perform any git operation — staging and committing are handled elsewhere.`
}

const applyOutcomes = applyResults.filter(Boolean).flatMap((r) => r.outcomes)
const skippedFromApply = applyOutcomes.filter((o) => o.skipped)
const appliedFromApply = applyOutcomes.filter((o) => o.applied)
const intraDomainBehaviorPreserved = applyOutcomes.every((o) => o.skipped || o.behaviorPreserved)

// ---------------------------------------------------------------------------
// Phase: Mark — single reconciliation agent call at the Apply barrier. Stages
// the quiescent intra-domain tree and makes an ephemeral internal commit
// (never surfaced to reviewed history — the skill collapses it after this
// Workflow returns, per REQ-010). Skipped when the intra-domain lane made no
// actual changes (every finding was skipped, or there was nothing to apply):
// `git add -A` + commit would fail with nothing staged, so `baseRef` — the
// tree's state at worktree entry (or already-in-worktree capture) — is
// already the correct rollback point.
// ---------------------------------------------------------------------------

phase('Mark')

const anyIntraDomainApplied = applyOutcomes.some((o) => o.applied)

let rollbackSha = baseRef ?? null
if (anyIntraDomainApplied) {
  const mark = await agent(
    `Stage every change under ${projectRoot} with git add -A and make an internal commit capturing this intra-domain-green state. Return the resulting SHA.`,
    {
      label: 'mark:rollback-point',
      phase: 'Mark',
      schema: RECONCILER_MARK_SCHEMA,
      agentType: 'refactoring-guru:refactoring-reconciler',
    },
  )
  rollbackSha = mark?.rollbackSha ?? rollbackSha
} else {
  log('Mark: no intra-domain changes were applied — using baseRef as the rollback point instead of an empty commit.')
}

// ---------------------------------------------------------------------------
// Phase: Reconcile — cross-cutting findings applied serially on the quiescent
// tree (they are explicitly allowed to span domains), then a whole-project
// build gate. On failure the reconciler resets to rollbackSha and re-runs
// the gate on the reset tree to isolate whether the intra-domain lane itself
// stayed sound (DG-011/AC-007) — a cross-cutting failure must never taint an
// otherwise-green intra-domain result.
// ---------------------------------------------------------------------------

phase('Reconcile')

const crossCuttingOutcomes = []
for (const finding of crossCuttingBatch) {
  const outcome = await agent(applyPrompt(finding, { crossCutting: true }), {
    label: `reconcile:${finding.domain}:${finding.code}`,
    phase: 'Reconcile',
    schema: APPLIER_SCHEMA,
    agentType: 'refactoring-guru:refactoring-applier',
  })
  crossCuttingOutcomes.push(toOutcome(outcome, finding, finding.domain))
}

const reconcile = await agent(
  `Run the whole-project build gate with: ${buildCmd}\nThe rollback point from the Mark phase is ${rollbackSha}. If the gate fails, reset to it and re-run the gate on the reset tree to determine whether the intra-domain work is independently sound.`,
  {
    label: 'reconcile:build-gate',
    phase: 'Reconcile',
    schema: RECONCILER_RECONCILE_SCHEMA,
    agentType: 'refactoring-guru:refactoring-reconciler',
  },
)

const buildPasses = Boolean(reconcile?.buildPasses)
const crossCuttingApplied = crossCuttingBatch.length > 0 && Boolean(reconcile?.crossCuttingApplied)
const intraDomainHealthy = crossCuttingBatch.length === 0 ? buildPasses : Boolean(reconcile?.intraDomainHealthy)

const mergeable = intraDomainBehaviorPreserved && intraDomainHealthy

// When the cross-cutting bucket survived the build gate, its individual
// applier outcomes are real (each may itself be applied or skipped, e.g. "no
// safety net") — report them. When it was rolled back, none of those edits
// survived in the tree, so every cross-cutting finding is reported skipped
// with the rollback reason instead of its (now-reverted) per-finding outcome.
const appliedFromCrossCutting = crossCuttingApplied ? crossCuttingOutcomes.filter((o) => o.applied) : []
const skippedFromCrossCutting = crossCuttingApplied
  ? crossCuttingOutcomes.filter((o) => o.skipped)
  : crossCuttingBatch.map((f) => ({ domain: f.domain, code: f.code, technique: f.technique, reason: 'cross-cutting reconciliation rolled back' }))

return {
  mergeable,
  applied: [...appliedFromApply, ...appliedFromCrossCutting].map((o) => ({ domain: o.domain, code: o.code, technique: o.technique, behaviorPreserved: o.behaviorPreserved })),
  buildPasses,
  crossCuttingApplied,
  rollbackSha,
  skipped: [
    ...skippedBatch.map((f) => ({ domain: f.domain, code: f.code, reason: f.reason })),
    ...skippedFromApply.map((o) => ({ domain: o.domain, code: o.code, technique: o.technique, reason: o.reason })),
    ...skippedFromCrossCutting.map((o) => ({ domain: o.domain, code: o.code, technique: o.technique, reason: o.reason })),
  ],
}
