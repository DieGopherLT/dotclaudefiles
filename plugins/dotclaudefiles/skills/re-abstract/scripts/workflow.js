export const meta = {
  name: 're-abstract',
  description: 'Diagnose the abstractions of mature modules through evidence lenses, design a target shape under two lenses, check every proposal against the code, and assemble one dossier per module.',
  phases: [
    { title: 'Explore', detail: 'per module: 7 evidence lenses plus one modernization researcher, in parallel' },
    { title: 'Design', detail: 'per module: two read-only architects (ideal, balanced) over the same evidence' },
    { title: 'Verify', detail: 'per module: one skeptic per design checks each proposal against the code' },
    { title: 'Assemble', detail: 'classify proposals and serialize one dossier per module (plain JS, zero tokens)' },
  ],
}

// Input (from the re-abstract skill via args)
//   args.modules:      [{ path, language, purpose }]  absolute module path, its language, and one
//                                            sentence on what the module is for
//   args.repoRoot:     string                absolute repo root; every path is made relative to it
//   args.analyzedAt:   string                ISO 8601 timestamp captured by the skill (the sandbox
//                                            forbids Date.now(), which would break resume)
//   args.verification: string                how the project proves it works, confirmed by the skill's gate

const CONFIDENCE_FLOOR = 80

// One read-only explorer per lens. Each lens is a different way of measuring the gap between what
// the module is for and the shape its code took.
const LENSES = [
  {
    key: 'responsibilities',
    brief: 'The job of each unit (file, package, class). Report units that do several jobs and packages that hold halves used by different clients. Measure lines and function count per file, name the distinct jobs, and say which client uses which half.',
  },
  {
    key: 'surface',
    brief: 'What the module exports against what its clients use. Read every call site outside the module. Report what client code has to know to use it: pieces it assembles by hand, construction order it must respect, literals and paths it supplies, internals it reaches into, exported symbols no client uses. Measure exported against used symbols and the lines of assembly per call site.',
  },
  {
    key: 'duplication',
    brief: 'One action implemented through several paths: near-copies, parallel code paths that have to change together, several helpers for the same job. Measure the number of paths with their locations, and name one difference between them that looks accidental.',
  },
  {
    key: 'data',
    brief: 'Data structures and their lifetimes. For each significant structure: who owns it, how long its entries live against how long the owner lives, how it is keyed, and whether its synchronization fits the read and write pattern. Report entries that outlive their owner, global structures that belong to one entity, keys that can collide, and cleanup passes that exist only because of the keying.',
  },
  {
    key: 'dependencies',
    brief: 'Direction of dependencies. Report import cycles and what forces them, clients that import a whole package to use a fraction of it, clients that depend on internals, and which packages are leaves. Measure the import edges, by file.',
  },
  {
    key: 'indirection',
    brief: 'Units that only relay: layers that pass calls through, queues or channels with one producer and one consumer, threads, goroutines or tasks that only forward a message, wrappers that add nothing, options nobody sets. Measure the count per kind and say what a direct call would remove.',
  },
  {
    key: 'history',
    brief: 'What the change history shows. Run git log over the module: files that change together across commits, the files with most churn, fixes that had to touch several places, and the axes along which the code has actually varied (a second implementation added, a provider swapped, a mode added). Measure commit and co-change counts and cite commit hashes.',
  },
]

// The same evidence is designed twice. Where `ideal` adds an abstraction that `balanced` declines,
// that abstraction is the candidate for speculative generality.
const DESIGN_LENSES = ['ideal', 'balanced']

const OBSERVATIONS_SCHEMA = {
  type: 'object',
  required: ['observations', 'key_files'],
  properties: {
    observations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'locations', 'measure', 'cost_of_change', 'basis', 'confidence'],
        properties: {
          claim: { type: 'string', description: 'one sentence stating the fact observed' },
          locations: { type: 'array', items: { type: 'string' }, description: 'path:line, or a commit hash for history' },
          measure: { type: 'string', description: 'the number that backs the claim' },
          cost_of_change: { type: 'string', description: 'what this makes expensive when someone changes the module' },
          basis: { type: 'string', enum: ['verified', 'inferred'] },
          confidence: { type: 'number', description: '0-100; only observations >= 80 are reported' },
        },
      },
    },
    key_files: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'why'],
        properties: { path: { type: 'string' }, why: { type: 'string' } },
      },
    },
  },
}

const MODERNIZATION_SCHEMA = {
  type: 'object',
  required: ['declared_version', 'items'],
  properties: {
    declared_version: { type: 'string', description: 'language or runtime version the manifest declares' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['construct', 'locations', 'replacement', 'kind', 'min_version', 'removes', 'source_url', 'confidence'],
        properties: {
          construct: { type: 'string', description: 'the hand-written construct in the module today' },
          locations: { type: 'array', items: { type: 'string' }, description: 'path:line' },
          replacement: { type: 'string', description: 'the language, standard library or dependency feature that replaces it' },
          kind: { type: 'string', enum: ['language', 'stdlib', 'dependency-upgrade', 'new-dependency'] },
          min_version: { type: 'string', description: 'version that introduced the replacement' },
          removes: { type: 'string', description: 'what code disappears when the replacement is adopted' },
          source_url: { type: 'string', description: 'official page that was opened and documents the replacement' },
          confidence: { type: 'number', description: '0-100; only items >= 80 are reported' },
        },
      },
    },
  },
}

const DESIGN_SCHEMA = {
  type: 'object',
  required: ['approach', 'units', 'proposals', 'order', 'costs', 'assumptions'],
  properties: {
    approach: { type: 'string', description: 'the target shape in a few sentences' },
    units: {
      type: 'array',
      description: 'the modules of the target shape',
      items: {
        type: 'object',
        required: ['name', 'job', 'exposes', 'hides', 'depends_on'],
        properties: {
          name: { type: 'string' },
          job: { type: 'string', description: 'its single job' },
          exposes: { type: 'string', description: 'its Facade: the only symbols the rest of the code sees' },
          hides: { type: 'string' },
          depends_on: { type: 'string' },
        },
      },
    },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'kind', 'where', 'problem', 'change', 'deletes', 'variation_evidence', 'behavior_change', 'client_code_after'],
        properties: {
          title: { type: 'string', description: 'names the pattern or structure by its canonical name when one applies' },
          kind: {
            type: 'string',
            enum: ['facade', 'pattern', 'data-structure', 'consolidation', 'split', 'dependency-direction', 'modernization', 'deletion'],
          },
          where: { type: 'array', items: { type: 'string' }, description: 'path:line of the code the proposal replaces' },
          problem: { type: 'string', description: 'the observation it answers' },
          change: { type: 'string', description: 'what the code looks like afterwards' },
          deletes: { type: 'array', items: { type: 'string' }, description: 'concrete things that disappear; never empty' },
          variation_evidence: { type: 'string', description: 'variation that already exists in the code or its history; empty when the proposal does not rest on variation' },
          behavior_change: { type: 'string', description: 'the defect this removes or the behavior it changes; empty when behavior is preserved' },
          client_code_after: { type: 'string', description: 'the call site after the change, in pseudo-code; empty when no client is affected' },
        },
      },
    },
    order: { type: 'array', items: { type: 'string' }, description: 'steps in execution order, each with how it is verified' },
    costs: {
      type: 'array',
      items: { type: 'string' },
      description: 'what this design makes harder, slower or rules out, and when that stops being acceptable',
    },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
}

const VERDICTS_SCHEMA = {
  type: 'object',
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'deletion_holds', 'variation', 'evidence', 'confidence'],
        properties: {
          id: { type: 'string', description: 'the proposal id, echoed exactly' },
          deletion_holds: { type: 'boolean', description: 'true only if every listed deletion exists today and the proposal makes it unnecessary' },
          variation: { type: 'string', enum: ['supported', 'unsupported', 'not_claimed'] },
          evidence: { type: 'string', description: 'what was read, with path:line or commit hash' },
          confidence: { type: 'number', description: '0-100' },
        },
      },
    },
  },
}

const input = normalizeArgs(args)
const modules = Array.isArray(input?.modules) ? input.modules.filter((m) => typeof m?.path === 'string') : []
const repoRoot = typeof input?.repoRoot === 'string' ? input.repoRoot.replace(/\/$/, '') : ''
const analyzedAt = typeof input?.analyzedAt === 'string' ? input.analyzedAt : ''
const verification = typeof input?.verification === 'string' ? input.verification : ''

if (modules.length === 0 || !repoRoot) {
  log(`Nothing to analyze: ${modules.length === 0 ? 'args.modules is empty' : 'args.repoRoot is missing'}.`)
  return { modules: [], files: [] }
}

// Modules are independent, so each one flows through the three stages without waiting for the
// others. The barriers live inside a stage, where the next stage needs every result of one module.
const analyzed = await pipeline(modules, exploreModule, designModule, verifyModule)

const dossiers = analyzed.filter(Boolean).map(assembleDossier)

return {
  modules: dossiers.map(({ module, counts, missingLenses }) => ({ module, counts, missingLenses })),
  files: dossiers.map(({ path, content }) => ({ path, content })),
}

// Stage 1. The architects need every lens of this module at once, so the barrier is required.
async function exploreModule(mod) {
  const relative = toRepoRelative(mod.path) || '.'

  const lensThunks = LENSES.map((lens) => () =>
    agent(lensPrompt(mod, lens), {
      label: `explore:${relative}:${lens.key}`,
      phase: 'Explore',
      schema: OBSERVATIONS_SCHEMA,
      agentType: 'dotclaudefiles:plan-explorer',
    }).then((result) => ({ key: lens.key, result })),
  )

  // No agentType: the researcher needs web access, which plan-explorer does not carry.
  const researchThunk = () =>
    agent(modernizationPrompt(mod), {
      label: `explore:${relative}:modernization`,
      phase: 'Explore',
      model: 'sonnet',
      schema: MODERNIZATION_SCHEMA,
    })

  const [modernization, ...lensResults] = await parallel([researchThunk, ...lensThunks])

  const reported = lensResults.filter((entry) => entry?.result)
  const missingLenses = LENSES.map((lens) => lens.key).filter((key) => !reported.some((entry) => entry.key === key))
  if (missingLenses.length > 0) log(`${relative}: lenses that did not report: ${missingLenses.join(', ')}`)
  if (!modernization) log(`${relative}: the modernization researcher did not report`)
  if (reported.length === 0) {
    log(`${relative}: no lens reported, module dropped from the run`)
    throw new Error(`exploreModule: no lens reported for ${relative}`)
  }

  const evidence = reported.map(({ key, result }) => ({
    lens: key,
    observations: (result.observations ?? []).filter((o) => (o.confidence ?? 0) >= CONFIDENCE_FLOOR),
    key_files: result.key_files ?? [],
  }))

  return { module: relative, language: mod.language ?? '', purpose: mod.purpose ?? '', evidence, modernization, missingLenses }
}

// Stage 2. Both designs feed the same dossier, so they are awaited together.
async function designModule(explored) {
  const designs = await parallel(
    DESIGN_LENSES.map((lens) => () =>
      agent(designPrompt(explored, lens), {
        label: `design:${explored.module}:${lens}`,
        phase: 'Design',
        schema: DESIGN_SCHEMA,
        agentType: 'dotclaudefiles:plan-architect',
      }).then((design) => design && withProposalIds(design, lens)),
    ),
  )

  const reported = designs.filter(Boolean)
  if (reported.length < DESIGN_LENSES.length) log(`${explored.module}: ${DESIGN_LENSES.length - reported.length} design(s) did not report`)

  return { ...explored, designs: reported }
}

// Stage 3. One skeptic per design: its proposals share the files it has to open.
async function verifyModule(designed) {
  const verified = await parallel(
    designed.designs.map((design) => () => {
      if (design.proposals.length === 0) return Promise.resolve(design)
      return agent(skepticPrompt(designed.module, design), {
        label: `verify:${designed.module}:${design.lens}`,
        phase: 'Verify',
        schema: VERDICTS_SCHEMA,
        agentType: 'dotclaudefiles:plan-explorer',
      }).then((result) => withStatuses(design, result?.verdicts ?? []))
    }),
  )

  // A skeptic that died leaves its design in the dossier with every proposal unverified.
  const designs = designed.designs.map((design, index) => verified[index] ?? withStatuses(design, []))

  return { ...designed, designs }
}

function assembleDossier(analysis) {
  const proposals = analysis.designs.flatMap((design) => design.proposals)
  const counts = countBy(proposals.map((p) => p.status ?? 'unverified'))

  const sections = [
    `# Re-abstract dossier: ${analysis.module}`,
    `Analyzed at ${analyzedAt || 'unknown'}. Language: ${analysis.language || 'not given'}. Verification: ${verification || 'not given'}.`,
    `What the module is for: ${analysis.purpose || 'not stated'}.`,
    `Observations and modernization items below ${CONFIDENCE_FLOOR} confidence were left out by their authors.`,
    analysis.missingLenses.length > 0 ? `Lenses that did not report: ${analysis.missingLenses.join(', ')}.` : '',
    '## Evidence',
    ...analysis.evidence.map(renderLens),
    renderModernization(analysis.modernization),
    '## Designs',
    analysis.designs.length === 0 ? 'No design reported.' : '',
    ...analysis.designs.map(renderDesign),
  ]

  return {
    module: analysis.module,
    counts,
    missingLenses: analysis.missingLenses,
    path: `${repoRoot}/.claude/re-abstract/${analysis.module === '.' ? 'root' : analysis.module.replace(/\//g, '-')}/dossier.md`,
    content: `${sections.filter(Boolean).join('\n\n')}\n`,
  }
}

function lensPrompt(mod, lens) {
  return [
    `Aspect: ${lens.key}. Area: the module at ${mod.path} (repo root ${repoRoot}), including the code outside it that uses it.`,
    'This is evidence for a re-abstraction: the module is mature and the question is how far the shape its code took is from what the module is for. Report what is there; do not propose a design.',
    purposeLine(mod.purpose),
    lens.brief,
    'Every observation carries a number and states what it makes expensive when someone changes the module. An observation without a measure is an opinion: leave it out.',
    'Confidence per observation: 0 = you did not read the code; 25 = seen in one place, not checked elsewhere; 50 = read, but the measure is partial; 75 = read and measured, the cost of change is inferred; 100 = read, measured, and the cost shown by a concrete call site or past change.',
    `Report only observations with confidence >= ${CONFIDENCE_FLOOR}. An empty list is a valid answer.`,
  ].join('\n\n')
}

function modernizationPrompt(mod) {
  return [
    `Find what newer language, standard library and dependency features would replace in the module at ${mod.path} (repo root ${repoRoot}). Language: ${mod.language || 'detect it from the manifest'}. Read only: do not edit or install anything.`,
    'Read the manifest for the declared language or runtime version and the dependencies the module uses. Then search the web for the official release notes of that language since the declared version, and for the current documentation of the main dependencies. Your training data is older than those pages, so the pages decide.',
    'Report each hand-written construct in the module that a newer feature replaces: where it is, what replaces it, the version that introduced the replacement, and what code disappears. Cite the official page you opened; a search snippet is not a source.',
    'Where the module hand-rolls a problem that looks standard (retry and backoff, parsing, validation, scheduling, pooling), invoke the `lib-advisor` skill of dotclaudefiles, if the Skill tool is available, to evaluate a dependency before reporting it as `new-dependency`.',
    'Confidence per item: 0 = recalled from memory, no page opened; 25 = page opened, construct not located in the module; 50 = both found, version requirement not checked against the manifest; 75 = checked, but the replacement differs in behavior in a way you could not rule out; 100 = page opened, construct located, version compatible, behavior equivalent or the difference stated.',
    `Report only items with confidence >= ${CONFIDENCE_FLOOR}. An empty list is a valid answer.`,
  ].join('\n\n')
}

function designPrompt(explored, lens) {
  return [
    `Lens: ${lens}. Objective: re-abstract the module ${explored.module} (repo root ${repoRoot}). This is not a feature: design the shape this module would have if it were written today by someone who knows everything it ended up doing. Behavior that clients rely on stays.`,
    purposeLine(explored.purpose),
    `Exploration findings, one entry per lens:\n${JSON.stringify(explored.evidence)}`,
    `Modernization research:\n${JSON.stringify(explored.modernization ?? { items: [] })}`,
    'Rules for every proposal:',
    '1. `deletes` lists the concrete things that disappear: a code path, a file, a type, a concurrency unit, a branch, a nil check, a parameter, a cleanup pass. A proposal that deletes nothing is not reported.',
    '2. A proposal justified by future variation (Strategy, Adapter, a plugin point) cites in `variation_evidence` variation that already exists: two variants in the code, or a commit that the `history` findings cite (you cannot run git, so quote the hash from the findings). Without it, leave the proposal out.',
    '3. Judge each unit from its client code. `client_code_after` shows the call site, which should read as the list of decisions the client makes, not as the assembly instructions of what it uses.',
    '4. Data lives exactly as long as its owner.',
    '5. A better design may remove a defect. State it in `behavior_change`; it is welcome, and it must be visible.',
    `6. \`order\` starts with cleaning and defect fixes inside the current shape, then moves, then new abstractions. Each step says how it is verified with: ${verification || 'the project test suite'}.`,
    'Name GoF patterns and refactorings by their canonical names. Report in the schema: your Cost and Opens-and-closes sections go in `costs`; skip the file table and the migration section.',
  ].join('\n\n')
}

function skepticPrompt(moduleName, design) {
  const claims = design.proposals.map(({ id, title, where, change, deletes, variation_evidence }) => ({ id, title, where, change, deletes, variation_evidence }))
  return [
    `Aspect: refutation. Area: the module ${moduleName} (repo root ${repoRoot}).`,
    'Each proposal below claims that adopting it deletes specific things. Try to refute each claim against the code; you are not judging whether the design is good.',
    `Proposals:\n${JSON.stringify(claims)}`,
    'For each proposal: open the code at `where` and check every item in `deletes`. `deletion_holds` is true only if every item exists today and the proposal would make it unnecessary. If `variation_evidence` is not empty, check it in the code or with git log: `supported` or `unsupported`; if it is empty, `not_claimed`. When you cannot confirm, answer false or `unsupported`.',
    'Confidence per verdict: 0 = you did not open the code; 25 = opened one location, the verdict rests on names; 50 = read the locations, did not trace their callers; 75 = read locations and callers, one deleted item left unconfirmed; 100 = every deleted item and every cited variation checked at its location.',
    'Return one verdict per proposal and echo its id exactly.',
  ].join('\n\n')
}

function purposeLine(purpose) {
  return `What the module is for: ${purpose || 'not stated; infer it from how its clients use it and say that you inferred it'}.`
}

// Ids come from the script, not from the architect: two designs would otherwise collide.
function withProposalIds(design, lens) {
  const prefix = lens[0].toUpperCase()
  const proposals = (design.proposals ?? []).map((proposal, index) => ({ ...proposal, id: `${prefix}${index + 1}` }))
  return { ...design, lens, proposals }
}

function withStatuses(design, verdicts) {
  const verdictById = new Map(verdicts.map((verdict) => [verdict.id, verdict]))
  const proposals = design.proposals.map((proposal) => {
    const verdict = verdictById.get(proposal.id)
    return { ...proposal, verdict, ...classify(verdict) }
  })
  return { ...design, proposals }
}

function classify(verdict) {
  if (!verdict) return { status: 'unverified', reason: 'no verdict returned' }
  if ((verdict.confidence ?? 0) < CONFIDENCE_FLOOR) return { status: 'contested', reason: `verdict at confidence ${verdict.confidence ?? 0}` }
  if (!verdict.deletion_holds) return { status: 'dropped', reason: 'the listed deletions do not hold in the code' }
  if (verdict.variation === 'unsupported') return { status: 'dropped', reason: 'the variation it rests on is not in the code or its history' }
  return { status: 'survives', reason: '' }
}

function renderLens({ lens, observations, key_files }) {
  const rows = observations.map((o) => [o.claim, o.measure, o.cost_of_change, locationList(o.locations), o.basis, o.confidence])
  const files = key_files.map((file) => `- \`${toRepoRelative(file.path)}\`: ${file.why}`).join('\n')
  return [
    `### ${lens}`,
    rows.length > 0 ? table(['Observation', 'Measure', 'Cost of change', 'Locations', 'Basis', 'Confidence'], rows) : 'No observation at or above the confidence floor.',
    files ? `Key files:\n${files}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function renderModernization(modernization) {
  if (!modernization) return '### modernization\n\nThe researcher did not report.'
  const rows = (modernization.items ?? [])
    .filter((item) => (item.confidence ?? 0) >= CONFIDENCE_FLOOR)
    .map((item) => [item.construct, item.replacement, item.kind, item.min_version, item.removes, locationList(item.locations), item.source_url])
  return [
    `### modernization (declared version: ${modernization.declared_version || 'unknown'})`,
    rows.length > 0 ? table(['Construct today', 'Replacement', 'Kind', 'Since', 'Removes', 'Locations', 'Source'], rows) : 'Nothing to modernize at or above the confidence floor.',
  ].join('\n\n')
}

function renderDesign(design) {
  const units = (design.units ?? []).map((unit) => [unit.name, unit.job, unit.exposes, unit.hides, unit.depends_on])
  const proposals = design.proposals.map((p) => [
    p.id,
    p.status,
    p.title,
    p.kind,
    locationList(p.where),
    p.problem,
    p.change,
    (p.deletes ?? []).join('; '),
    p.variation_evidence,
    p.behavior_change,
    [p.reason, p.verdict?.evidence].filter(Boolean).join(': '),
  ])
  const clientCode = design.proposals
    .filter((p) => p.client_code_after)
    .map((p) => `Client code after ${p.id}:\n\n\`\`\`\n${p.client_code_after}\n\`\`\``)

  return [
    `### ${design.lens}`,
    design.approach,
    units.length > 0 ? table(['Unit', 'Job', 'Exposes', 'Hides', 'Depends on'], units) : '',
    proposals.length > 0
      ? table(['Id', 'Status', 'Proposal', 'Kind', 'Where', 'Problem', 'Change', 'Deletes', 'Variation evidence', 'Behavior change', 'Skeptic'], proposals)
      : 'No proposal.',
    ...clientCode,
    (design.order ?? []).length > 0 ? `Order:\n${design.order.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '',
    (design.costs ?? []).length > 0 ? `Costs:\n${design.costs.map((c) => `- ${c}`).join('\n')}` : '',
    (design.assumptions ?? []).length > 0 ? `Assumptions:\n${design.assumptions.map((a) => `- ${a}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function table(headers, rows) {
  const line = (cells) => `| ${cells.map(cell).join(' | ')} |`
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n')
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

function locationList(locations) {
  return (locations ?? []).map(toRepoRelative).join(', ')
}

function countBy(values) {
  return values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})
}

// Agents return absolute or relative paths; the dossier keeps them relative so it carries no local path.
function toRepoRelative(filePath) {
  if (!filePath || !repoRoot) return filePath
  if (filePath === repoRoot) return ''
  return filePath.startsWith(`${repoRoot}/`) ? filePath.slice(repoRoot.length + 1) : filePath
}

// args may arrive JSON-encoded depending on how the caller serialized the Workflow input.
function normalizeArgs(raw) {
  if (typeof raw !== 'string') return raw ?? {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
