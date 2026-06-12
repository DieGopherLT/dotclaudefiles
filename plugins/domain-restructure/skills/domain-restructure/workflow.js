export const meta = {
  name: 'domain-restructure',
  description: 'Autonomous structural refactor from layer-first to feature-first: audit the migration contract, scan bounded contexts via ubiquitous language, group files per domain, reconcile into a global move plan, move files in parallel fixing intra-domain imports, then consolidate cross-cutting imports and gate on the build.',
  phases: [
    { title: 'Contract', detail: 'contract-auditor detects stack, layer taxonomy, import strategy, build gate' },
    { title: 'Scan', detail: 'domain-scanner identifies bounded contexts and names them with the ubiquitous language' },
    { title: 'Group', detail: 'domain-grouper buckets each domain\'s files by layer, one agent per domain' },
    { title: 'Reconcile', detail: 'reconciler classifies subdomains and emits the move plan, path map, and membership map' },
    { title: 'Move', detail: 'domain-mover relocates files and fixes intra-domain imports, one agent per domain' },
    { title: 'Consolidate', detail: 'consolidator fixes cross-cutting imports, runs the build gate loop, asserts a pure-refactor diff' },
  ],
}

// ---------------------------------------------------------------------------
// Inputs (from the domain-restructure skill via args)
//   args.projectRoot: string      absolute path to the project inside the worktree
//   args.scopePath:   string|null  subdirectory to restrict the restructure, or null
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const projectRoot = input.projectRoot ?? '.'
const scopePath = input.scopePath ?? null

function normalizeArgs(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw ?? {}
}

if (!projectRoot) {
  log('No projectRoot provided in args — nothing to do.')
  return { ok: false, reason: 'missing projectRoot' }
}

// ---------------------------------------------------------------------------
// Structured-output schemas
// ---------------------------------------------------------------------------

const CONTRACT_SCHEMA = {
  type: 'object',
  required: ['stack', 'layerTaxonomy', 'currentAxis', 'targetConvention', 'importStrategy', 'buildGate', 'codeRoot'],
  properties: {
    stack: { type: 'string', description: 'e.g. express-node | react-vite | nextjs | go | generic' },
    layerTaxonomy: { type: 'array', items: { type: 'string' }, description: 'technical roles present, e.g. [controllers, services, models, routes, middlewares]' },
    currentAxis: { type: 'string', description: 'layer-first | feature-first | flat | mixed' },
    targetConvention: { type: 'string', description: 'domain directory prefix, e.g. src/modules | src/features | internal' },
    importStrategy: { type: 'string', description: 'relative | alias' },
    aliasRoot: { type: 'string', description: 'alias prefix if importStrategy=alias, e.g. @/ (else empty)' },
    buildGate: { type: 'string', description: 'exact shell command to verify build/typecheck/test' },
    codeRoot: { type: 'string', description: 'relative path of the code root to restructure, e.g. src' },
    nonCodePathRefs: { type: 'array', items: { type: 'string' }, description: 'config files referencing paths that may need updating' },
  },
}

const DOMAIN_SCAN_SCHEMA = {
  type: 'object',
  required: ['domains'],
  properties: {
    domains: {
      type: 'array',
      items: {
        type: 'object',
        required: ['domain', 'examples'],
        properties: {
          domain: { type: 'string', description: 'ubiquitous-language business term, kebab-case' },
          examples: { type: 'array', items: { type: 'string' }, description: '2-3 representative file paths' },
          namingConfidence: { type: 'number', description: '0-1; low = cluster hard to name, suspect grouping' },
        },
      },
    },
  },
}

const DOMAIN_GROUP_SCHEMA = {
  type: 'object',
  required: ['domain', 'layers'],
  properties: {
    domain: { type: 'string' },
    layers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['layer', 'files'],
        properties: {
          layer: { type: 'string', description: 'one of the contract layerTaxonomy values' },
          files: { type: 'array', items: { type: 'string', description: 'current file path' } },
        },
      },
    },
  },
}

const RECONCILE_SCHEMA = {
  type: 'object',
  required: ['movePlan', 'pathMap', 'membershipMap', 'subdomainClass'],
  properties: {
    subdomainClass: {
      type: 'array',
      items: {
        type: 'object',
        required: ['domain', 'classification', 'targetDir'],
        properties: {
          domain: { type: 'string' },
          classification: { type: 'string', description: 'core | supporting | generic' },
          targetDir: { type: 'string', description: 'destination dir, e.g. src/modules/credits or src/modules/core' },
        },
      },
    },
    pathMap: {
      type: 'array',
      items: {
        type: 'object',
        required: ['oldPath', 'newPath', 'domain'],
        properties: {
          oldPath: { type: 'string' },
          newPath: { type: 'string' },
          domain: { type: 'string', description: 'owning domain (or core/shared)' },
        },
      },
    },
    membershipMap: { type: 'object', description: 'map of file path -> owning domain', additionalProperties: { type: 'string' } },
    movePlan: {
      type: 'array',
      items: {
        type: 'object',
        required: ['domain', 'moves'],
        properties: {
          domain: { type: 'string' },
          moves: { type: 'array', items: { type: 'object', required: ['oldPath', 'newPath'], properties: { oldPath: { type: 'string' }, newPath: { type: 'string' } } } },
        },
      },
    },
    collisions: { type: 'array', items: { type: 'string' }, description: 'resolved path collisions (renamed)' },
    orphans: { type: 'array', items: { type: 'string' }, description: 'files assigned to no domain; flagged' },
  },
}

const MOVE_SCHEMA = {
  type: 'object',
  required: ['domain', 'movedCount', 'intraDomainEdgesFixed', 'pathMapSlice'],
  properties: {
    domain: { type: 'string' },
    movedCount: { type: 'number', description: 'files moved for this domain' },
    intraDomainEdgesFixed: { type: 'number' },
    pathMapSlice: { type: 'array', items: { type: 'object', required: ['oldPath', 'newPath'], properties: { oldPath: { type: 'string' }, newPath: { type: 'string' } } } },
    deferredEdges: { type: 'array', items: { type: 'string' }, description: 'cross-cutting imports left for the consolidator' },
  },
}

const CONSOLIDATE_SCHEMA = {
  type: 'object',
  required: ['buildPasses', 'crossCuttingEdgesFixed', 'diffIsPureRefactor'],
  properties: {
    buildPasses: { type: 'boolean', description: 'build gate exits zero' },
    crossCuttingEdgesFixed: { type: 'number' },
    barrelsUpdated: { type: 'array', items: { type: 'string' } },
    configRefsUpdated: { type: 'array', items: { type: 'string' } },
    diffIsPureRefactor: { type: 'boolean', description: 'git diff touches only file locations and import statements' },
    behaviorChangeViolations: { type: 'array', items: { type: 'string' }, description: 'non-import content changes detected; must be empty for a clean run' },
    residualErrors: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const scopeNote = scopePath ? ` Restrict the analysis to the subdirectory "${scopePath}".` : ''

function contractPrompt() {
  return `Audit the project at "${projectRoot}" and produce the migration contract that drives a layer-first to feature-first restructure.${scopeNote} Detect the stack and package manager, derive the layer taxonomy actually present (controllers/services/models/routes/etc.), classify the current organizational axis (layer-first | feature-first | flat | mixed), choose the target convention (src/modules by default when src/ exists), determine the import strategy (relative vs path alias, reporting the alias root if any), find the exact build gate command that verifies the project, and list non-code files that reference paths. Return the contract in structured output. Be honest about the axis — a false layer-first claim would restructure an already-good project.`
}

function scanPrompt(contract) {
  return `Scan the project at "${projectRoot}" to identify its business domains (bounded contexts) using strategic DDD and the ubiquitous language.${scopeNote} The layer taxonomy is ${JSON.stringify(contract.layerTaxonomy)} and the code root is "${contract.codeRoot}". Cluster files by the business concept they serve (a controller, service, and model about "credits" are one domain even though they live in different layer directories), and name each domain with a single business term a domain expert would recognize. For each domain return 2-3 representative example file paths. If a cluster cannot be named with a clean business term, emit it with a low namingConfidence rather than inventing a technical name. Do NOT propose any tactical-DDD changes (entities/aggregates/events) — you only decide where files belong.`
}

function groupPrompt(domain, contract, allDomains) {
  return `Group the files belonging to the domain "${domain.domain}" in the project at "${projectRoot}".${scopeNote} Anchor on these example files: ${JSON.stringify(domain.examples)}. The layer taxonomy is ${JSON.stringify(contract.layerTaxonomy)}; the other domains are ${JSON.stringify(allDomains.map((d) => d.domain))}. Find every file tied to this domain's business concept across all layer directories, and bucket each into exactly one layer from the taxonomy (controller.* -> controllers, service.* -> services, etc.). Files shared with other domains are fine — list them anyway; the reconciler resolves shared files. Return your domain's per-layer grouping in structured output. Read-only: do not move or edit anything.`
}

function reconcilePrompt(groups, contract) {
  return `Reconcile the per-domain groupings for the project at "${projectRoot}" into a single conflict-free move plan. The target convention is "${contract.targetConvention}". Here are all the domain groupings: ${JSON.stringify(groups)}. Do the following: (1) classify each domain as core, supporting, or generic — generic/cross-cutting concerns (auth, email, config, logging, generic utils) route into ${contract.targetConvention}/core instead of their own module; (2) assign every file claimed by more than one domain exactly once to core/shared; (3) assign orphan files (claimed by none) to core and record them; (4) resolve path collisions by renaming deterministically; (5) compute newPath as <targetDir>/<layer>/<basename>, preserving the layer subdirectory. Emit the subdomain classification, the full pathMap ({oldPath,newPath,domain}), the membershipMap (file -> owning domain, complete for every moved file), the movePlan grouped by domain, plus collisions and orphans. Every in-scope file must appear exactly once. Read-only on code — you plan, you do not move.`
}

function movePrompt(domainPlan, membershipMap, contract) {
  return `Move the files for the domain "${domainPlan.domain}" in the project at "${projectRoot}". You run in parallel with other movers in a shared git worktree. Your moves: ${JSON.stringify(domainPlan.moves)}. The full membership map (file -> owning domain) is ${JSON.stringify(membershipMap)}. Import strategy: ${contract.importStrategy}${contract.aliasRoot ? ` (alias root ${contract.aliasRoot})` : ''}. Steps: (1) for each move, mkdir -p the destination and use plain filesystem "mv" — NEVER "git mv" (concurrent git mv contends on .git/index.lock) and never delete+recreate; (2) fix ONLY import edges whose both endpoints belong to your domain per the membership map — recompute relative paths or rewrite the alias suffix; leave every cross-cutting edge (target in another domain, in core/shared, a barrel, or a config file) untouched and record it under deferredEdges; (3) if fixing imports would change more than ~50% of a small file's lines, skip that file's content edit and defer it, to preserve git rename detection. Use LSP findReferences to locate import sites precisely. Return your movedCount, intraDomainEdgesFixed, pathMapSlice, and deferredEdges. Change no logic, signatures, or symbols.`
}

function consolidatePrompt(pathMap, moves, contract) {
  const deferred = moves.flatMap((m) => m?.deferredEdges ?? [])
  return `Consolidate the restructure for the project at "${projectRoot}". All movers have finished: files are relocated via plain mv and intra-domain imports are fixed, but cross-cutting imports are still broken. Steps in order: (1) run a single "git add -A" from the project root so git's rename detection records every move with history preserved — verify with git status that files show as renamed, not delete+add; (2) using this pathMap as the oldPath->newPath lookup ${JSON.stringify(pathMap)}, fix every cross-cutting import the movers deferred (these were flagged: ${JSON.stringify(deferred)}) — recompute relative paths or rewrite alias suffixes, using LSP findReferences to catch re-exports and aliased names; (3) update barrel files (index.ts re-exports) and these non-code path references ${JSON.stringify(contract.nonCodePathRefs ?? [])} (tsconfig paths, vitest/jest config, bundler config, package.json main/exports), and grep for string-literal dynamic imports the static analyzers miss; (4) run the build gate "${contract.buildGate}" in a loop, fixing import/path errors until it exits clean or remaining errors cannot be fixed without changing behavior; (5) inspect the staged git diff and assert it is a pure refactor — every changed line is a file relocation or an import/path edit, with no logic/signature/symbol change. Never make a logic change to force a green build. Return buildPasses, crossCuttingEdgesFixed, barrelsUpdated, configRefsUpdated, diffIsPureRefactor, behaviorChangeViolations (must be empty), and residualErrors.`
}

function summarize(plan, moves, result) {
  return {
    buildPasses: Boolean(result?.buildPasses),
    diffIsPureRefactor: Boolean(result?.diffIsPureRefactor),
    domainsCreated: (plan?.subdomainClass ?? []).length,
    filesMoved: moves.reduce((sum, m) => sum + (m?.movedCount ?? 0), 0),
    crossCuttingEdgesFixed: result?.crossCuttingEdgesFixed ?? 0,
    subdomainClass: plan?.subdomainClass ?? [],
    orphans: plan?.orphans ?? [],
    collisions: plan?.collisions ?? [],
    residualErrors: result?.residualErrors ?? [],
    behaviorChangeViolations: result?.behaviorChangeViolations ?? [],
  }
}

// ---------------------------------------------------------------------------
// Phase: Contract (sequential — frames every later phase)
// ---------------------------------------------------------------------------

phase('Contract')
const contract = await agent(contractPrompt(), {
  agentType: 'domain-restructure:contract-auditor',
  schema: CONTRACT_SCHEMA,
  label: 'contract',
  phase: 'Contract',
})

if (!contract) {
  log('Contract auditor failed — cannot proceed.')
  return { ok: false, reason: 'contract audit failed' }
}

if (contract.currentAxis === 'feature-first') {
  log('Project is already feature-first — nothing to restructure.')
  return { ok: false, reason: 'already feature-first', currentAxis: contract.currentAxis }
}

log(`Contract: ${contract.stack} project, axis ${contract.currentAxis}, target ${contract.targetConvention}, imports ${contract.importStrategy}, gate "${contract.buildGate}"`)

// ---------------------------------------------------------------------------
// Phase: Scan (sequential — domains are what the groupers fan out over)
// ---------------------------------------------------------------------------

phase('Scan')
const scan = await agent(scanPrompt(contract), {
  agentType: 'domain-restructure:domain-scanner',
  schema: DOMAIN_SCAN_SCHEMA,
  label: 'scan',
  phase: 'Scan',
})

const domains = scan?.domains ?? []
if (domains.length === 0) {
  log('Scanner found no domains — nothing to restructure.')
  return { ok: false, reason: 'no domains found' }
}

const lowConfidence = domains.filter((d) => typeof d.namingConfidence === 'number' && d.namingConfidence < 0.4)
log(`Scan: ${domains.length} domains (${domains.map((d) => d.domain).join(', ')})${lowConfidence.length ? ` — ${lowConfidence.length} low-confidence` : ''}`)

// ---------------------------------------------------------------------------
// Phase: Group (parallel fan-out; barrier into Reconcile — it needs all groups)
// ---------------------------------------------------------------------------

phase('Group')
const groups = (await parallel(domains.map((d) => () =>
  agent(groupPrompt(d, contract, domains), {
    agentType: 'domain-restructure:domain-grouper',
    schema: DOMAIN_GROUP_SCHEMA,
    label: `group:${d.domain}`,
    phase: 'Group',
  })
))).filter(Boolean)

if (groups.length === 0) {
  log('No domain groupings produced — aborting.')
  return { ok: false, reason: 'grouping failed' }
}

log(`Group: ${groups.length}/${domains.length} domains grouped`)

// ---------------------------------------------------------------------------
// Phase: Reconcile (single — needs ALL groupings to dedup/merge globally)
// ---------------------------------------------------------------------------

phase('Reconcile')
const plan = await agent(reconcilePrompt(groups, contract), {
  agentType: 'domain-restructure:reconciler',
  schema: RECONCILE_SCHEMA,
  label: 'reconcile',
  phase: 'Reconcile',
})

if (!plan || !plan.movePlan || plan.movePlan.length === 0) {
  log('Reconciliation produced no moves — aborting.')
  return { ok: false, reason: 'reconciliation produced no moves', plan }
}

const plannedFiles = plan.movePlan.reduce((sum, mp) => sum + (mp.moves?.length ?? 0), 0)
log(`Reconcile: ${plan.subdomainClass?.length ?? 0} domains, ${plannedFiles} files planned, ${plan.orphans?.length ?? 0} orphans, ${plan.collisions?.length ?? 0} collisions resolved`)

// ---------------------------------------------------------------------------
// Phase: Move (parallel fan-out; plain mv + intra-domain imports; barrier into Consolidate)
// ---------------------------------------------------------------------------

phase('Move')
const moves = (await parallel(plan.movePlan.map((mp) => () =>
  agent(movePrompt(mp, plan.membershipMap, contract), {
    agentType: 'domain-restructure:domain-mover',
    schema: MOVE_SCHEMA,
    label: `move:${mp.domain}`,
    phase: 'Move',
  })
))).filter(Boolean)

const filesMoved = moves.reduce((sum, m) => sum + (m?.movedCount ?? 0), 0)
log(`Move: ${moves.length}/${plan.movePlan.length} domains moved, ${filesMoved} files relocated`)

// ---------------------------------------------------------------------------
// Phase: Consolidate (single — git add -A, global import fix, build gate loop)
// ---------------------------------------------------------------------------

phase('Consolidate')
let result = null
try {
  result = await agent(consolidatePrompt(plan.pathMap, moves, contract), {
    agentType: 'domain-restructure:consolidator',
    schema: CONSOLIDATE_SCHEMA,
    label: 'consolidate',
    phase: 'Consolidate',
  })
} catch (consolidateError) {
  log(`Consolidator error: ${consolidateError.message}. Returning partial result.`)
  result = { buildPasses: false, crossCuttingEdgesFixed: 0, diffIsPureRefactor: false, behaviorChangeViolations: [], residualErrors: [consolidateError.message] }
}

const buildPasses = Boolean(result?.buildPasses)
const diffIsPureRefactor = Boolean(result?.diffIsPureRefactor)
const noViolations = (result?.behaviorChangeViolations ?? []).length === 0
const noOrphansLeft = (plan?.orphans ?? []).length === 0
const mergeable = buildPasses && diffIsPureRefactor && noViolations && noOrphansLeft

if (!buildPasses) {
  log(`Consolidate: build gate FAILS. Residual errors: ${JSON.stringify(result?.residualErrors ?? [])}.`)
} else if (!mergeable) {
  log(`Consolidate: build passes but not mergeable (pure-refactor: ${diffIsPureRefactor}, violations: ${(result?.behaviorChangeViolations ?? []).length}, orphans: ${(plan?.orphans ?? []).length}).`)
}

return {
  ok: true,
  mergeable,
  ...summarize(plan, moves, result),
  contract,
  result,
}
