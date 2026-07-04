export const meta = {
  name: 'refactor',
  description: 'Apply refactoring.guru techniques across two or more domains: intra-domain fan-out in parallel, cross-cutting findings reconciled serially with a whole-project build gate.',
  phases: [
    { title: 'Plan', detail: 'bucket findings into intra-domain, cross-cutting, and skipped (plain JS, no fs)' },
    { title: 'Apply', detail: 'one refactoring-applier per domain, serial within a domain, parallel across domains' },
    { title: 'Mark', detail: 'refactoring-reconciler stages the quiescent tree and makes the rollback commit' },
    { title: 'Reconcile', detail: 'cross-cutting findings applied serially, then a whole-project build gate' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the refactor skill via args) — the skill pre-loads everything;
// this script touches no filesystem.
//   args.sotContents:  object[]  per-domain SoT objects, already parsed
//   args.buildCmd:     string    whole-project build/test gate
//   args.testCmd:      string    scoped safe-cycle test command
//   args.projectRoot:  string    absolute path inside the dedicated worktree
//   args.preWorkBase:  string    SHA captured before EnterWorktree (unused
//                                here — the skill uses it after this Workflow
//                                returns, to collapse history)
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const sotContents = Array.isArray(input?.sotContents) ? input.sotContents : []
const buildCmd = input?.buildCmd
const testCmd = input?.testCmd
const projectRoot = input?.projectRoot

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

// Fixed set from CON-004 — findings whose smell is one of these are
// cross-cutting by name and deferred to Reconcile, never applied in the
// parallel intra-domain lane.
const CROSS_CUTTING_SMELLS = new Set(['Shotgun Surgery', 'Inappropriate Intimacy', 'Divergent Change'])

const APPLIER_SCHEMA = {
  type: 'object',
  required: ['applied', 'skipped', 'reason', 'behaviorPreserved', 'technique', 'domain'],
  properties: {
    applied: { type: 'boolean' },
    skipped: { type: 'boolean' },
    reason: { type: ['string', 'null'] },
    behaviorPreserved: { type: 'boolean' },
    technique: { type: 'string' },
    domain: { type: 'string' },
  },
}

const RECONCILER_MARK_SCHEMA = {
  type: 'object',
  required: ['rollbackSha'],
  properties: { rollbackSha: { type: 'string' } },
}

const RECONCILER_RECONCILE_SCHEMA = {
  type: 'object',
  required: ['buildPasses', 'intraDomainHealthy', 'crossCuttingApplied'],
  properties: {
    buildPasses: { type: 'boolean' },
    intraDomainHealthy: { type: 'boolean' },
    crossCuttingApplied: { type: 'boolean' },
    output: { type: 'string' },
  },
}

// ---------------------------------------------------------------------------
// Phase: Plan — pure JS, no agent() calls, no filesystem access (the sandbox
// has none). Flatten every domain's SoT findings into one array, tag each
// with its parent domain, then bucket by resolution shape.
//
// A finding's cross_cutting flag (assigned by smell-scan's synthesis) is
// authoritative for the cross-cutting bucket. Everything else is checked
// against a cheap heuristic: does resolution_plan mention a path outside
// this finding's own domain? This regex is only a pre-filter — it trims the
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
  return tokens.some((token) => !token.startsWith(finding.domain))
}

const crossCutting = []
const skipped = []
const intraDomainByDomain = {}

for (const finding of allFindings) {
  if (CROSS_CUTTING_SMELLS.has(finding.smell)) {
    crossCutting.push(finding)
    continue
  }
  if (resolutionSpansDomain(finding)) {
    skipped.push({ ...finding, reason: 'resolution spans domains, not in cross-cutting set — manual follow-up' })
    continue
  }
  intraDomainByDomain[finding.domain] ??= []
  intraDomainByDomain[finding.domain].push(finding)
}

log(`Plan: ${allFindings.length} findings — ${Object.values(intraDomainByDomain).flat().length} intra-domain, ${crossCutting.length} cross-cutting, ${skipped.length} skipped (spanning-but-unnamed).`)

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

const domainsWithWork = Object.keys(intraDomainByDomain)

const applyResults = await parallel(
  domainsWithWork.map((domain) => () => applyDomain(domain, intraDomainByDomain[domain])),
)

async function applyDomain(domain, findings) {
  const outcomes = []
  for (const finding of findings) {
    const outcome = await agent(applyPrompt(finding), {
      label: `apply:${domain}:${finding.code}`,
      phase: 'Apply',
      schema: APPLIER_SCHEMA,
      agentType: 'refactoring-guru:refactoring-applier',
    })
    outcomes.push({
      ...(outcome ?? { applied: false, skipped: true, reason: 'agent call failed', behaviorPreserved: false, technique: finding.technique, domain }),
      code: finding.code,
    })
  }
  return { domain, outcomes }
}

function applyPrompt(finding) {
  return `Apply the technique "${finding.technique}" to address the "${finding.smell}" smell at ${finding.path}:${finding.line_range[0]}-${finding.line_range[1]}.
Evidence: ${finding.evidence}
Resolution plan: ${finding.resolution_plan}
Run the scoped safe cycle with: ${testCmd}

Two hard constraints for this autonomous run, overriding your default interactive behavior:
- If no test covers this location, do NOT proceed with the smallest-steps fallback described in your own instructions. Instead report { skipped: true, reason: "no safety net" } and stop.
- Only edit files under ${finding.domain}. If completing the resolution plan requires touching a file outside that domain, stop and report { skipped: true, reason: "spans domains" } instead of making the edit.

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
// Workflow returns, per REQ-010).
// ---------------------------------------------------------------------------

phase('Mark')

const mark = await agent(
  `Stage every change under ${projectRoot} with git add -A and make an internal commit capturing this intra-domain-green state. Return the resulting SHA.`,
  {
    label: 'mark:rollback-point',
    phase: 'Mark',
    schema: RECONCILER_MARK_SCHEMA,
    agentType: 'refactoring-guru:refactoring-reconciler',
  },
)
const rollbackSha = mark?.rollbackSha ?? null

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
for (const finding of crossCutting) {
  const outcome = await agent(applyCrossCuttingPrompt(finding), {
    label: `reconcile:${finding.domain}:${finding.code}`,
    phase: 'Reconcile',
    schema: APPLIER_SCHEMA,
    agentType: 'refactoring-guru:refactoring-applier',
  })
  crossCuttingOutcomes.push({
    ...(outcome ?? { applied: false, skipped: true, reason: 'agent call failed', behaviorPreserved: false, technique: finding.technique, domain: finding.domain }),
    code: finding.code,
  })
}

function applyCrossCuttingPrompt(finding) {
  return `Apply the technique "${finding.technique}" to address the "${finding.smell}" smell at ${finding.path}:${finding.line_range[0]}-${finding.line_range[1]}.
Evidence: ${finding.evidence}
Resolution plan: ${finding.resolution_plan}
This finding is cross-cutting (${finding.smell}) — its resolution is explicitly allowed to touch files outside a single domain.
Run the scoped safe cycle with: ${testCmd}
If no test covers this location, report { skipped: true, reason: "no safety net" } and stop rather than proceeding without a safety net.
Do not perform any git operation — staging and committing are handled elsewhere.`
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
const crossCuttingApplied = crossCutting.length > 0 && Boolean(reconcile?.crossCuttingApplied)
const intraDomainHealthy = crossCutting.length === 0 ? buildPasses : Boolean(reconcile?.intraDomainHealthy)

const mergeable = intraDomainBehaviorPreserved && intraDomainHealthy

return {
  mergeable,
  applied: appliedFromApply.map((o) => ({ domain: o.domain, code: o.code, technique: o.technique, behaviorPreserved: o.behaviorPreserved })),
  buildPasses,
  crossCuttingApplied,
  rollbackSha,
  skipped: [
    ...skipped.map((f) => ({ domain: f.domain, code: f.code, reason: f.reason })),
    ...skippedFromApply.map((o) => ({ domain: o.domain, technique: o.technique, reason: o.reason })),
    ...(crossCutting.length > 0 && !crossCuttingApplied
      ? crossCutting.map((f) => ({ domain: f.domain, code: f.code, reason: 'cross-cutting reconciliation rolled back' }))
      : []),
  ],
}
