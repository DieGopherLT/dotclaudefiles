export const meta = {
  name: 'retrofit-testing',
  description: 'Autonomous retrofit testing pipeline: measure testability, break dependencies with seams, write characterization + behavior tests, audit quality, document. Runs inside the caller\'s dedicated worktree.',
  phases: [
    { title: 'Measure', detail: 'testability-auditor scores each module 1-10' },
    { title: 'Prepare', detail: 'testing-deps-investigator (once) + testing-code-adapter per low-score module' },
    { title: 'Scaffold', detail: 'testing-scaffolder builds shared test utilities once across all modules' },
    { title: 'Test', detail: 'test-implementer + test-input-auditor loop per module until coverage and quality are met (scoped, concurrency-safe)' },
    { title: 'Build', detail: 'one reconciliation pass runs the whole-project build + full suite at the quiescent barrier — authoritative compile gate' },
    { title: 'Document', detail: 'write project testing rules from the template' },
  ],
}

// ---------------------------------------------------------------------------
// Inputs (from the retrofit-testing skill via args)
//   args.modules: string[]      paths to put under test
//   args.language: 'go' | 'typescript' | 'csharp'
//   args.threshold: number      coverage target as a fraction (e.g. 0.80)
//   args.needsDeps: boolean      whether testing infra must be set up first
//   args.existingPattern: string|null  established test pattern to match, if any
// ---------------------------------------------------------------------------

// args may arrive as a JSON-encoded string depending on how the caller serialized
// the Workflow input; normalize to an object so the work-list is never silently empty.
const input = normalizeArgs(args)
const modules = Array.isArray(input.modules) ? input.modules : []
const language = input.language ?? 'unknown'
const threshold = typeof input.threshold === 'number' ? input.threshold : 0.8
const existingPattern = input.existingPattern ?? null

// React component/hook targets need a different seam model (vi.mock/props/providers/MSW,
// not constructor DI) and RTL assertions. Detect them so the agents switch to frontend
// mode; a directory target that hides .tsx files is still caught by each agent inspecting
// its own module, this flag just makes the common case explicit in the prompt.
const isFrontend = modules.some((m) => /\.(tsx|jsx)$/.test(m))

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

// A module that scores below this needs seams before it can be tested cleanly.
const ADAPT_BELOW = 7
// The test-quality bar (aligned with the auditors' >=80 confidence threshold).
const QUALITY_BAR = 80
// Cap the write/audit loop so a stubborn module cannot run forever.
const MAX_ROUNDS = 3

// Test-file globs per language for the generated rule's `paths` frontmatter,
// so .claude/rules/testing.md loads on-demand only when working on tests.
const TEST_GLOBS = {
  go: ['**/*_test.go'],
  typescript: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx'],
  csharp: ['**/*Tests.cs', '**/*Test.cs', '**/*Spec.cs'],
}

if (modules.length === 0) {
  log('No modules provided in args.modules — nothing to do.')
  return { ok: false, reason: 'empty work-list', modules: [] }
}

// ---------------------------------------------------------------------------
// Structured-output schemas
// ---------------------------------------------------------------------------

const TESTABILITY_SCHEMA = {
  type: 'object',
  required: ['module', 'score', 'needsAdaptation'],
  properties: {
    module: { type: 'string' },
    score: { type: 'number', description: 'testability 1-10' },
    needsAdaptation: { type: 'boolean' },
    obstacles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description', 'confidence'],
        properties: {
          description: { type: 'string' },
          confidence: { type: 'number', description: '0-100; only obstacles at >= 80 are reported' },
          severity: { type: 'string', enum: ['critical', 'important'] },
        },
      },
    },
  },
}

const DEPS_SCHEMA = {
  type: 'object',
  required: ['installed', 'runCommand', 'coverageCommand'],
  properties: {
    installed: { type: 'array', items: { type: 'string' } },
    runCommand: { type: 'string' },
    coverageCommand: { type: 'string' },
    notes: { type: 'string' },
  },
}

const ADAPT_SCHEMA = {
  type: 'object',
  required: ['module', 'behaviorPreserved'],
  properties: {
    module: { type: 'string' },
    behaviorPreserved: { type: 'boolean' },
    seams: { type: 'array', items: { type: 'string' } },
    remainingObstacles: { type: 'array', items: { type: 'string' } },
  },
}

const COVERAGE_SCHEMA = {
  type: 'object',
  required: ['module', 'coverage', 'scopedTestsPass'],
  properties: {
    module: { type: 'string' },
    coverage: { type: 'number', description: 'line coverage as a fraction 0-1, measured from the final state of this module' },
    scopedTestsPass: { type: 'boolean', description: 'this module\'s OWN test files compile and run green in a scoped run (not the whole-project build, which the Build phase owns)' },
    testFiles: { type: 'array', items: { type: 'string' } },
    bugsFound: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          expectedFailureTest: { type: 'string' },
        },
      },
    },
  },
}

const QUALITY_SCHEMA = {
  type: 'object',
  required: ['module', 'quality'],
  properties: {
    module: { type: 'string' },
    quality: { type: 'number', description: 'test-quality 0-100' },
    weakTests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['test', 'smell', 'confidence'],
        properties: {
          test: { type: 'string', description: 'file:line or test name' },
          smell: { type: 'string', description: 'SMELL_TOKEN from the catalog' },
          confidence: { type: 'number', description: '0-100; only smells at >= 80 are reported' },
        },
      },
    },
  },
}

const SCAFFOLD_SCHEMA = {
  type: 'object',
  required: ['location', 'utilities'],
  properties: {
    location: { type: 'string', description: 'directory where the shared test utilities live' },
    utilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          kind: { type: 'string', description: 'builder | mock | fake | helper | custom-assertion' },
          usage: { type: 'string', description: 'how a test imports and uses it' },
        },
      },
    },
    notes: { type: 'string' },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['buildPasses', 'suitePasses'],
  properties: {
    buildPasses: { type: 'boolean', description: 'the whole-project typecheck/build is green at the quiescent barrier' },
    suitePasses: { type: 'boolean', description: 'the full test suite passes when run together' },
    fixes: { type: 'array', items: { type: 'string' }, description: 'compile/type errors reconciled across modules' },
    residualErrors: { type: 'array', items: { type: 'string' }, description: 'errors that could not be fixed without changing behavior' },
  },
}

const RULES_SCHEMA = {
  type: 'object',
  required: ['path'],
  properties: {
    path: { type: 'string', description: 'absolute path to the written .claude/rules/testing.md file' },
  },
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const patternLine = existingPattern
  ? `Match the established test pattern in this project: ${existingPattern}.`
  : 'No tests exist yet; follow idiomatic conventions for the language.'

// Flips the agents' frontend mode; the patterns live in their bodies.
const frontendLine = isFrontend
  ? ' Some targets are React components or custom hooks (.tsx/.jsx): apply your frontend testing mode.'
  : ''

function measurePrompt(m) {
  return `Audit the testability of the ${language} code at "${m}". Score it 1-10, list the concrete obstacles that would force infrastructure or global state into a unit test, and set needsAdaptation=true if the score is below ${ADAPT_BELOW}.${frontendLine}`
}

function depsPrompt() {
  return `This ${language} project has no testing infrastructure. Detect the stack and recommend the testing dependencies to install (framework, assertions, mocking, coverage). Return the exact run command and coverage command.${frontendLine}`
}

function adaptPrompt(m, measure) {
  return `Make the ${language} code at "${m}" testable WITHOUT changing observable behavior, using seams and dependency-breaking (Feathers). Obstacles found by the auditor: ${JSON.stringify(measure.obstacles ?? [])}. Verify the build/tests stay green after each change. Report the seams you introduced and whether behavior was preserved.${frontendLine}`
}

function scaffoldPrompt(prepared) {
  const survey = prepared.map((p) => ({
    module: p.module,
    obstacles: p.measure?.obstacles ?? [],
    seams: p.adapt?.seams ?? [],
  }))
  return [
    `Scaffold the SHARED test utilities for these ${language} modules BEFORE any per-module tests are written, so every module imports one canonical, type-correct helper instead of re-creating divergent stubs.`,
    `${patternLine}`,
    `Survey of modules, their testability obstacles, and the seams already introduced by the adapter: ${JSON.stringify(survey)}.`,
    'Identify the infrastructure dependencies that recur across modules and build ONE reusable utility for each: test data builders, mocks/fakes that match the seam contracts exactly, helpers, and custom assertions.',
    'Reuse before you create: if the project already has test utilities, extend them rather than duplicating.',
    `Place everything in a single conventional location for the language. The utilities MUST compile under the project typecheck/build. Do not write any tests here — only the shared utilities. Return each utility with its path, kind, and usage.${frontendLine}`,
  ].join(' ')
}

function implementPrompt(m, round, adapt, scaffold) {
  const retry = round > 0
    ? ` This is retry #${round}: previous tests fell below coverage ${threshold} or quality ${QUALITY_BAR}, or your own test files did not run green; strengthen assertions, cover the missing input categories and branches, and fix any type/compile errors in YOUR files.`
    : ''
  const seamLine = adapt?.seams?.length
    ? ` The code was already adapted for testing — consume these seams exactly as the adapter built them; do NOT reassign read-only exports or re-create your own variant: ${JSON.stringify(adapt.seams)}.`
    : ''
  const utilsLine = scaffold?.utilities?.length
    ? ` Shared test utilities already exist at "${scaffold.location}" — import and reuse them, do NOT re-create your own variants of mocks/builders that already exist there: ${JSON.stringify(scaffold.utilities.map((u) => ({ name: u.name, path: u.path, usage: u.usage })))}.`
    : ''
  return `Write characterization + behavior tests for the ${language} code at "${m}". ${patternLine}${seamLine}${utilsLine}${frontendLine} Cover degenerate/simple/general/edge/error input categories. Mode 1 (per-module writing): you run concurrently with other implementers mutating sibling modules in this same worktree, so validate only your own test files in a scoped run and never the whole-project build. Report line coverage as a fraction measured from the final state of your module. Target coverage >= ${threshold}.${retry}`
}

function buildReconcilePrompt(summary) {
  const testFiles = summary.flatMap((r) => r.testFiles ?? [])
  const tsconfigLine = language === 'typescript'
    ? ` Test globs to exclude from the production build if a tsconfig.build.json is needed: ${JSON.stringify(TEST_GLOBS.typescript)}.`
    : ''
  return [
    `Mode 2 (build reconciliation): all per-module implementers have finished and the worktree is quiescent. Run the whole-project ${language} typecheck/build and the full suite, and reconcile the cross-module errors the parallel phase could not see.${tsconfigLine}`,
    `Test files written this run: ${JSON.stringify(testFiles)}.`,
  ].join(' ')
}

function auditPrompt(m) {
  return `Audit the quality of the tests just written for "${m}". Apply mutation-thinking (would each test fail if the production code were broken?) plus the test-smell catalog weighted by severity. Return a 0-100 quality score and the weak tests.`
}

function documentPrompt(summary, deps, scaffold) {
  const cmds = deps
    ? `run: ${deps.runCommand}, coverage: ${deps.coverageCommand}`
    : 'pre-existing (detect from the project)'
  const utils = scaffold?.utilities?.length
    ? `location=${scaffold.location}, utilities=${JSON.stringify(scaffold.utilities.map((u) => ({ name: u.name, kind: u.kind, usage: u.usage })))}`
    : 'none scaffolded'
  const globs = TEST_GLOBS[language] ?? ['**/*test*']
  return [
    'Write a path-scoped Claude Code rule at .claude/rules/testing.md from the bundled template and return its path.',
    `Frontmatter paths for this language: ${JSON.stringify(globs)}.`,
    '',
    `Run facts: language=${language}, commands=(${cmds}), threshold=${threshold}.`,
    `Shared test utilities: ${utils}.`,
    `Per-module results: ${JSON.stringify(summary)}.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Phase: Prepare (project-level deps, once)
// ---------------------------------------------------------------------------

let deps = null
if (input.needsDeps) {
  deps = await agent(depsPrompt(), {
    agentType: 'testing:testing-deps-investigator',
    schema: DEPS_SCHEMA,
    label: 'deps:setup',
    phase: 'Prepare',
  })
}

// ---------------------------------------------------------------------------
// Phase: Measure → Prepare (pipeline per module)
// Each module is measured and — if flagged — adapted before the next module
// starts measuring. The scaffolder gets the full, quiescent survey because it
// awaits the pipeline result, but adapts can begin as soon as a module's own
// measure completes rather than waiting for the whole fleet.
// ---------------------------------------------------------------------------

const prepared = await pipeline(
  modules,
  (m) =>
    agent(measurePrompt(m), {
      agentType: 'testing:testability-auditor',
      schema: TESTABILITY_SCHEMA,
      label: `measure:${m}`,
      phase: 'Measure',
    }).then((measure) => ({ module: m, measure })),
  (entry) => {
    if (!entry) return null
    const { module: m, measure } = entry
    if (!measure || (measure.score >= ADAPT_BELOW && !measure.needsAdaptation)) {
      return Promise.resolve({ module: m, measure, adapt: null })
    }
    return agent(adaptPrompt(m, measure), {
      agentType: 'testing:testing-code-adapter',
      schema: ADAPT_SCHEMA,
      label: `adapt:${m}`,
      phase: 'Prepare',
    }).then((adapt) => ({ module: m, measure, adapt }))
  },
)

const preparedModules = prepared.filter(Boolean)

// ---------------------------------------------------------------------------
// Phase: Scaffold (once) — build shared, type-correct test utilities across all
// modules so per-module implementers reuse one canonical helper (DRY cross-file),
// instead of each fabricating its own divergent mock/builder.
// ---------------------------------------------------------------------------

phase('Scaffold')
const scaffold = await agent(scaffoldPrompt(preparedModules), {
  agentType: 'testing:testing-scaffolder',
  schema: SCAFFOLD_SCHEMA,
  label: 'scaffold:test-utils',
  phase: 'Scaffold',
})

// ---------------------------------------------------------------------------
// Phase: Test — per-module write + audit loop, consuming the shared utilities
// and each module's own seam. Modules run independently.
// ---------------------------------------------------------------------------

const results = await parallel(
  preparedModules.map((entry) => () => testModule(entry)),
)

async function testModule(entry) {
  const { module: m, measure, adapt } = entry
  let round = 0
  let coverage = 0
  let quality = 0
  let scopedTestsPass = false
  let testFiles = []
  let bugsFound = []

  while (round < MAX_ROUNDS) {
    const impl = await agent(implementPrompt(m, round, adapt, scaffold), {
      agentType: 'testing:test-implementer',
      schema: COVERAGE_SCHEMA,
      label: `test:${m}#${round + 1}`,
      phase: 'Test',
    })
    const audit = await agent(auditPrompt(m), {
      agentType: 'testing:test-input-auditor',
      schema: QUALITY_SCHEMA,
      label: `audit:${m}#${round + 1}`,
      phase: 'Test',
    })

    coverage = impl?.coverage ?? 0
    quality = audit?.quality ?? 0
    scopedTestsPass = impl?.scopedTestsPass ?? false
    testFiles = impl?.testFiles ?? []
    bugsFound = impl?.bugsFound ?? []

    // Gate the per-module loop on what is measurable under concurrency: coverage,
    // quality, and this module's own scoped run. The whole-project build is NOT
    // checked here — siblings are still mutating the worktree; the Build phase
    // owns the authoritative compile gate once everything is quiescent.
    if (coverage >= threshold && quality >= QUALITY_BAR && scopedTestsPass) break
    round++
  }

  const passed = coverage >= threshold && quality >= QUALITY_BAR && scopedTestsPass
  if (!passed) {
    log(`Module "${m}" capped at ${MAX_ROUNDS} rounds: coverage ${coverage} (target ${threshold}), quality ${quality} (target ${QUALITY_BAR}), scopedTestsPass ${scopedTestsPass}. Flagging for manual review.`)
  }

  return {
    module: m,
    testability: measure?.score ?? null,
    adapted: Boolean(adapt),
    coverage,
    quality,
    scopedTestsPass,
    rounds: round + 1,
    passed,
    testFiles,
    bugsFound,
  }
}

const summary = results.filter(Boolean)

// ---------------------------------------------------------------------------
// Phase: Build — the single quiescent point where a whole-project build is valid.
// One agent runs the full typecheck/build + full suite, reconciles cross-module
// compile errors the parallel phase could not see, and produces the authoritative
// buildPasses/suitePasses for the merge verdict.
// ---------------------------------------------------------------------------

phase('Build')
const build = await agent(buildReconcilePrompt(summary), {
  agentType: 'testing:test-implementer',
  schema: BUILD_SCHEMA,
  label: 'build:reconcile',
  phase: 'Build',
})
const buildPasses = Boolean(build?.buildPasses)
const suitePasses = Boolean(build?.suitePasses)
if (!buildPasses || !suitePasses) {
  log(`Build reconciliation: buildPasses ${buildPasses}, suitePasses ${suitePasses}. Worktree is NOT mergeable as-is. Residual: ${JSON.stringify(build?.residualErrors ?? [])}.`)
}

// ---------------------------------------------------------------------------
// Phase: Document
// ---------------------------------------------------------------------------

phase('Document')
const rulesResult = await agent(documentPrompt(summary, deps, scaffold), {
  agentType: 'testing:testing-rules-writer',
  schema: RULES_SCHEMA,
  label: 'document:rules',
  phase: 'Document',
})
const rulesPath = rulesResult?.path ?? null

const bugs = summary.flatMap((r) => (r.bugsFound ?? []).map((b) => ({ module: r.module, ...b })))
const modulesShort = summary.filter((r) => !r.passed).map((r) => ({
  module: r.module,
  coverage: r.coverage,
  quality: r.quality,
  scopedTestsPass: r.scopedTestsPass,
}))

// The worktree is mergeable only when every module met coverage AND quality in its
// scoped run, AND the whole-project build + full suite are green at the barrier.
const mergeable = modulesShort.length === 0 && buildPasses && suitePasses

return {
  ok: true,
  // Lead with the merge verdict, not the coverage number.
  mergeable,
  buildPasses,
  suitePasses,
  passedAll: summary.every((r) => r.passed),
  modulesShort,
  residualErrors: build?.residualErrors ?? [],
  language,
  threshold,
  modules: summary,
  bugsFound: bugs,
  scaffold,
  build,
  rulesPath,
  deps,
}
