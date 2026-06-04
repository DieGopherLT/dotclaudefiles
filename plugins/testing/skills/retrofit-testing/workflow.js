export const meta = {
  name: 'retrofit-testing',
  description: 'Autonomous retrofit testing pipeline: measure testability, break dependencies with seams, write characterization + behavior tests, audit quality, document. Runs inside the caller\'s dedicated worktree.',
  phases: [
    { title: 'Measure', detail: 'testability-auditor scores each module 1-10' },
    { title: 'Prepare', detail: 'testing-deps-investigator (once) + testing-code-adapter per low-score module' },
    { title: 'Test', detail: 'test-implementer + test-input-auditor loop until coverage and quality thresholds are met' },
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

const modules = Array.isArray(args?.modules) ? args.modules : []
const language = args?.language ?? 'unknown'
const threshold = typeof args?.threshold === 'number' ? args.threshold : 0.8
const existingPattern = args?.existingPattern ?? null

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
    obstacles: { type: 'array', items: { type: 'string' } },
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
  required: ['module', 'coverage'],
  properties: {
    module: { type: 'string' },
    coverage: { type: 'number', description: 'line coverage as a fraction 0-1' },
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
  required: ['module', 'quality', 'needsRegeneration'],
  properties: {
    module: { type: 'string' },
    quality: { type: 'number', description: 'test-quality 0-100' },
    needsRegeneration: { type: 'boolean' },
    weakTests: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const patternLine = existingPattern
  ? `Match the established test pattern in this project: ${existingPattern}.`
  : 'No tests exist yet; follow idiomatic conventions for the language.'

function measurePrompt(m) {
  return `Audit the testability of the ${language} code at "${m}". Score it 1-10, list the concrete obstacles that would force infrastructure or global state into a unit test, and set needsAdaptation=true if the score is below ${ADAPT_BELOW}.`
}

function depsPrompt() {
  return `This ${language} project has no testing infrastructure. Detect the stack and recommend the testing dependencies to install (framework, assertions, mocking, coverage). Return the exact run command and coverage command. Do not install anything.`
}

function adaptPrompt(m, measure) {
  return `Make the ${language} code at "${m}" testable WITHOUT changing observable behavior, using seams and dependency-breaking (Feathers). Obstacles found by the auditor: ${JSON.stringify(measure.obstacles ?? [])}. Verify the build/tests stay green after each change. Report the seams you introduced and whether behavior was preserved.`
}

function implementPrompt(m, round) {
  const retry = round > 0
    ? ` This is retry #${round}: previous tests fell below coverage ${threshold} or quality ${QUALITY_BAR}; strengthen assertions and cover the missing input categories and branches.`
    : ''
  return `Write characterization + behavior tests for the ${language} code at "${m}". ${patternLine} Cover degenerate/simple/general/edge/error input categories. Reuse existing test utilities, and when two or more tests share setup, extract a reusable builder/helper/custom assertion instead of duplicating it. Run the tests for real and report line coverage as a fraction. Target coverage >= ${threshold}. If current behavior contradicts the documented contract, pin current behavior and add a labeled expected-failure test for the intended behavior, and report it in bugsFound.${retry}`
}

function auditPrompt(m) {
  return `Audit the quality of the tests just written for "${m}". Apply mutation-thinking (would each test fail if the production code were broken?) plus the test-smell catalog weighted by severity. Return a 0-100 quality score and set needsRegeneration=true if quality < ${QUALITY_BAR}.`
}

function documentPrompt(summary, deps) {
  const cmds = deps
    ? `run: ${deps.runCommand}, coverage: ${deps.coverageCommand}`
    : 'pre-existing (detect from the project)'
  const globs = TEST_GLOBS[language] ?? ['**/*test*']
  return [
    'Write a path-scoped Claude Code rule at .claude/rules/testing.md (create the directory if needed) and return its path.',
    `Begin the file with YAML frontmatter holding a paths: list, so the rule loads on-demand only when working on tests: ${JSON.stringify(globs)}.`,
    'After the frontmatter, use exactly these sections, filled from the run. Keep it token-efficient and specific to what was actually done — leave no placeholder unfilled:',
    '# Testing',
    '## How to Run Tests — run command, coverage command, watch mode if any.',
    '## Test Organization — location (co-located vs separate dir), file naming convention, structure (table-driven / describe-it / Fact+Theory).',
    '## Test Utilities — where shared builders/helpers/custom assertions live, what was created, and the reuse-before-create convention.',
    '## Coverage — target threshold, coverage report command, exclusions (generated code, DTOs, bootstrapping).',
    '## Patterns Established — the patterns implemented during this pipeline.',
    '## What to Test and ## What NOT to Test — priorities and exclusions.',
    '',
    `Run facts: language=${language}, commands=(${cmds}), threshold=${threshold}.`,
    `Per-module results: ${JSON.stringify(summary)}.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Phase: Prepare (project-level deps, once)
// ---------------------------------------------------------------------------

let deps = null
if (args?.needsDeps) {
  deps = await agent(depsPrompt(), {
    agentType: 'testing-deps-investigator',
    schema: DEPS_SCHEMA,
    label: 'deps:setup',
    phase: 'Prepare',
  })
}

// ---------------------------------------------------------------------------
// Per-module pipeline: Measure -> (adapt if needed) -> Test loop
// Each module flows independently; no barrier between stages.
// ---------------------------------------------------------------------------

const results = await pipeline(
  modules,

  // Stage 1 — Measure
  (m) => agent(measurePrompt(m), {
    agentType: 'testability-auditor',
    schema: TESTABILITY_SCHEMA,
    label: `measure:${m}`,
    phase: 'Measure',
  }),

  // Stage 2 — Adapt only if the module scored below the bar
  (measure, m) => {
    if (!measure || (measure.score >= ADAPT_BELOW && !measure.needsAdaptation)) {
      return { measure, adapt: null }
    }
    return agent(adaptPrompt(m, measure), {
      agentType: 'testing-code-adapter',
      schema: ADAPT_SCHEMA,
      label: `adapt:${m}`,
      phase: 'Prepare',
    }).then((adapt) => ({ measure, adapt }))
  },

  // Stage 3 — Write tests + audit quality, loop until both thresholds are met
  async (prev, m) => {
    let round = 0
    let coverage = 0
    let quality = 0
    let testFiles = []
    let bugsFound = []

    while (round < MAX_ROUNDS) {
      const impl = await agent(implementPrompt(m, round), {
        agentType: 'test-implementer',
        schema: COVERAGE_SCHEMA,
        label: `test:${m}#${round + 1}`,
        phase: 'Test',
      })
      const audit = await agent(auditPrompt(m), {
        agentType: 'test-input-auditor',
        schema: QUALITY_SCHEMA,
        label: `audit:${m}#${round + 1}`,
        phase: 'Test',
      })

      coverage = impl?.coverage ?? 0
      quality = audit?.quality ?? 0
      testFiles = impl?.testFiles ?? []
      bugsFound = impl?.bugsFound ?? []

      if (coverage >= threshold && quality >= QUALITY_BAR) break
      round++
    }

    const passed = coverage >= threshold && quality >= QUALITY_BAR
    if (!passed) {
      log(`Module "${m}" capped at ${MAX_ROUNDS} rounds: coverage ${coverage} (target ${threshold}), quality ${quality} (target ${QUALITY_BAR}). Flagging for manual review.`)
    }

    return {
      module: m,
      testability: prev?.measure?.score ?? null,
      adapted: Boolean(prev?.adapt),
      coverage,
      quality,
      rounds: round + 1,
      passed,
      testFiles,
      bugsFound,
    }
  },
)

const summary = results.filter(Boolean)

// ---------------------------------------------------------------------------
// Phase: Document
// ---------------------------------------------------------------------------

phase('Document')
const rulesPath = await agent(documentPrompt(summary, deps), {
  label: 'document:rules',
  phase: 'Document',
})

const bugs = summary.flatMap((r) => (r.bugsFound ?? []).map((b) => ({ module: r.module, ...b })))

return {
  ok: true,
  language,
  threshold,
  modules: summary,
  passedAll: summary.every((r) => r.passed),
  bugsFound: bugs,
  rulesPath,
  deps,
}
