export const meta = {
  name: 'typescript-migration',
  description: 'Autonomous TypeScript migration pipeline: audit project, install tooling and rename files, extract shared types, type chunks in parallel, consolidate with progressive strict mode and final build gate.',
  phases: [
    { title: 'Audit', detail: 'migration-auditor maps dependency graph, plans chunks, selects fixture' },
    { title: 'Setup', detail: 'migration-setup installs tooling, applies tsconfig, git mv all JS files, verifies base compile' },
    { title: 'Extract', detail: 'shared-types-extractor defines cross-chunk interfaces in src/types/ before typers start' },
    { title: 'Type', detail: 'typer agents run per chunk in parallel, each with a scoped compile gate' },
    { title: 'Consolidate', detail: 'migration-consolidator fixes cross-chunk errors, enables strict progressively, final build gate' },
  ],
}

// ---------------------------------------------------------------------------
// Inputs (from the typescript-migration skill via args)
//   args.projectRoot: string    absolute path to the project inside the worktree
//   args.entryPoint:  string|null  value of main/module from package.json, or null
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const projectRoot = input.projectRoot ?? '.'
const entryPoint = input.entryPoint ?? null

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

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['projectType', 'fixture', 'packageManager', 'toolingToInstall', 'chunks', 'sharedEntities', 'jsFileCount', 'tsFileCount'],
  properties: {
    projectType: { type: 'string', description: 'nextjs | react-vite | node | generic' },
    fixture: { type: 'string', description: 'tsconfig fixture filename to use' },
    packageManager: { type: 'string', description: 'npm | yarn | pnpm' },
    toolingToInstall: { type: 'array', items: { type: 'string' }, description: 'devDependencies to install' },
    chunks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'files'],
        properties: {
          name: { type: 'string' },
          files: { type: 'array', items: { type: 'string' }, description: 'files ordered leaf-first' },
        },
      },
    },
    sharedEntities: { type: 'array', items: { type: 'string' }, description: 'entity names that cross chunk boundaries' },
    jsFileCount: { type: 'number' },
    tsFileCount: { type: 'number' },
    allFilesOrdered: { type: 'array', items: { type: 'string' }, description: 'all JS files ordered leaf-first across all chunks, for git mv in Setup' },
  },
}

const SETUP_SCHEMA = {
  type: 'object',
  required: ['depsInstalled', 'configFiles', 'renamedCount', 'compilesClean'],
  properties: {
    depsInstalled: { type: 'array', items: { type: 'string' } },
    configFiles: { type: 'array', items: { type: 'string' }, description: 'config files written (tsconfig.json, etc.)' },
    renamedCount: { type: 'number', description: 'total files renamed from .js/.jsx to .ts/.tsx' },
    compilesClean: { type: 'boolean', description: 'base compile (allowJs, strict:false) exits with zero errors' },
    residualErrors: { type: 'array', items: { type: 'string' }, description: 'compile errors that could not be fixed at setup time' },
  },
}

const EXTRACT_SCHEMA = {
  type: 'object',
  required: ['typesFile', 'interfaceCount', 'typeAliasCount', 'importsUpdated'],
  properties: {
    typesFile: { type: 'string', description: 'path to the created/updated types file' },
    interfaceCount: { type: 'number' },
    typeAliasCount: { type: 'number' },
    entities: { type: 'array', items: { type: 'string' } },
    importsUpdated: { type: 'number', description: 'number of files that received a new import from the types file' },
    compileClean: { type: 'boolean', description: 'the types file itself compiles without errors' },
  },
}

const CHUNK_SCHEMA = {
  type: 'object',
  required: ['chunkName', 'files', 'compilesClean'],
  properties: {
    chunkName: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    compilesClean: { type: 'boolean', description: 'scoped typecheck of this chunk passes' },
    unknownUsages: { type: 'array', items: { type: 'string' }, description: 'unknown usages that need narrowing in Consolidate' },
    missingAtTypes: { type: 'array', items: { type: 'string' }, description: '@types packages not yet installed' },
  },
}

const CONSOLIDATE_SCHEMA = {
  type: 'object',
  required: ['buildPasses', 'strictLevelReached'],
  properties: {
    buildPasses: { type: 'boolean', description: 'whole-project build exits with zero errors' },
    strictLevelReached: { type: 'string', description: 'permissive | strictNullChecks | noImplicitAny | strict' },
    crossChunkErrorsFixed: { type: 'number' },
    atTypesInstalled: { type: 'array', items: { type: 'string' } },
    residualErrors: { type: 'array', items: { type: 'string' }, description: 'errors that could not be fixed without changing behavior' },
  },
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function auditPrompt() {
  return `Audit the JavaScript project at "${projectRoot}". Detect the project type (nextjs, react-vite, node, or generic), map the full dependency graph for all .js/.jsx files under src/ (or project root), compute topological depth for each file, group files into cohesive migration chunks of 3-10 files ordered leaf-first, select the correct tsconfig fixture, identify shared entities that cross chunk boundaries, and report what TypeScript tooling must be installed. Return the full migration plan in structured output.`
}

function setupPrompt(audit) {
  return `Set up the TypeScript migration for the project at "${projectRoot}". Project type: ${audit.projectType}. Fixture to apply: ${audit.fixture}. Package manager: ${audit.packageManager}. Install these devDependencies: ${JSON.stringify(audit.toolingToInstall)}. Then rename every file in this list from .js/.jsx to .ts/.tsx using git mv, in this exact leaf-first order: ${JSON.stringify(audit.allFilesOrdered ?? [])}. Finally verify the project compiles with allowJs=true and strict=false (permissive mode). Report renamed count, compile result, and any residual errors.`
}

function extractPrompt(audit) {
  return `Extract shared TypeScript types for the project at "${projectRoot}". The migration-auditor identified these entities as shared across multiple migration chunks: ${JSON.stringify(audit.sharedEntities)}. The chunks are: ${JSON.stringify(audit.chunks.map((c) => ({ name: c.name, files: c.files })))}. Create or update src/types/index.ts with interfaces and type aliases for every shared entity. Add import statements to the files that reference them. Verify the types file compiles cleanly. Return the path, counts, entities defined, and number of files updated.`
}

function typeChunkPrompt(chunk, sharedTypesPath) {
  return `Type the TypeScript migration chunk "${chunk.name}" in the project at "${projectRoot}". Add explicit parameter and return types to all exported functions in these files (process in order, leaf-first): ${JSON.stringify(chunk.files)}. Import shared types from "${sharedTypesPath}" — never redefine cross-chunk interfaces. Use ctx7 to look up types for any third-party library you encounter. After typing all files, run a scoped typecheck on your chunk's files only (not the whole project — other chunks are being typed concurrently). Report whether the chunk compiles cleanly, any unknown usages needing narrowing, and any missing @types packages.`
}

function consolidatePrompt(audit, chunkResults) {
  const unknownUsages = chunkResults.flatMap((r) => r?.unknownUsages ?? [])
  const missingAtTypes = chunkResults.flatMap((r) => r?.missingAtTypes ?? [])
  return `Consolidate the TypeScript migration for the project at "${projectRoot}". Project type: ${audit.projectType}. Package manager: ${audit.packageManager}. All per-chunk typers have finished — run the full whole-project build to find and fix cross-chunk type errors. Then enable strict TypeScript checks progressively: first strictNullChecks, then noImplicitAny, then strict — fixing errors at each level before advancing. Stop if an error cannot be fixed without changing production behavior. These unknown usages were flagged by typers as needing narrowing: ${JSON.stringify(unknownUsages)}. These @types packages were reported missing: ${JSON.stringify(missingAtTypes)} — install them now if needed. Return the build result, strict level reached, cross-chunk errors fixed, and any residual errors.`
}

// ---------------------------------------------------------------------------
// Phase: Audit
// ---------------------------------------------------------------------------

phase('Audit')
const audit = await agent(auditPrompt(), {
  agentType: 'typescript-migration:migration-auditor',
  schema: AUDIT_SCHEMA,
  label: 'audit:project',
  phase: 'Audit',
})

if (!audit || !audit.chunks || audit.chunks.length === 0) {
  log('Auditor returned no chunks — nothing to migrate.')
  return { ok: false, reason: 'no JS files found or auditor failed', audit }
}

log(`Audit complete: ${audit.projectType} project, ${audit.jsFileCount} JS files, ${audit.chunks.length} chunks, fixture: ${audit.fixture}`)

// ---------------------------------------------------------------------------
// Phase: Setup (sequential — must complete before Extract and Type)
// ---------------------------------------------------------------------------

phase('Setup')
const setup = await agent(setupPrompt(audit), {
  agentType: 'typescript-migration:migration-setup',
  schema: SETUP_SCHEMA,
  label: 'setup:tooling-and-rename',
  phase: 'Setup',
})

log(`Setup complete: ${setup?.renamedCount ?? 0} files renamed, base compile: ${setup?.compilesClean ? 'clean' : 'errors'}`)

// ---------------------------------------------------------------------------
// Phase: Extract (barrier — shared types must exist before parallel typers start)
// ---------------------------------------------------------------------------

phase('Extract')

const sharedTypesPath = `${projectRoot}/src/types/index.ts`

const extract = await agent(extractPrompt(audit), {
  agentType: 'typescript-migration:shared-types-extractor',
  schema: EXTRACT_SCHEMA,
  label: 'extract:shared-types',
  phase: 'Extract',
})

log(`Extraction complete: ${extract?.interfaceCount ?? 0} interfaces, ${extract?.typeAliasCount ?? 0} type aliases, ${extract?.importsUpdated ?? 0} files updated`)

// ---------------------------------------------------------------------------
// Phase: Type (parallel per chunk — scoped compile gate per chunk)
// ---------------------------------------------------------------------------

phase('Type')

const chunkResults = await parallel(
  audit.chunks.map((chunk) => () =>
    agent(typeChunkPrompt(chunk, extract?.typesFile ?? sharedTypesPath), {
      agentType: 'typescript-migration:typer',
      schema: CHUNK_SCHEMA,
      label: `type:${chunk.name}`,
      phase: 'Type',
    }),
  ),
)

const typedChunks = chunkResults.filter(Boolean)
const chunksClean = typedChunks.filter((r) => r.compilesClean).length
log(`Type phase complete: ${chunksClean}/${audit.chunks.length} chunks compile cleanly`)

// ---------------------------------------------------------------------------
// Phase: Consolidate (sequential — the one quiescent point for whole-project build)
// ---------------------------------------------------------------------------

phase('Consolidate')

const consolidation = await agent(consolidatePrompt(audit, typedChunks), {
  agentType: 'typescript-migration:migration-consolidator',
  schema: CONSOLIDATE_SCHEMA,
  label: 'consolidate:strict-and-build',
  phase: 'Consolidate',
})

const buildPasses = Boolean(consolidation?.buildPasses)
const strictLevelReached = consolidation?.strictLevelReached ?? 'permissive'

if (!buildPasses) {
  log(`Consolidation: build does NOT pass. Strict level reached: ${strictLevelReached}. Residual errors: ${JSON.stringify(consolidation?.residualErrors ?? [])}.`)
}

const mergeable = buildPasses && chunksClean === audit.chunks.length

return {
  ok: true,
  mergeable,
  buildPasses,
  strictLevelReached,
  jsFilesFound: audit.jsFileCount,
  filesRenamed: setup?.renamedCount ?? 0,
  chunksTotal: audit.chunks.length,
  chunksClean,
  sharedTypesFile: extract?.typesFile ?? null,
  interfacesDefined: extract?.interfaceCount ?? 0,
  crossChunkErrorsFixed: consolidation?.crossChunkErrorsFixed ?? 0,
  atTypesInstalled: consolidation?.atTypesInstalled ?? [],
  residualErrors: consolidation?.residualErrors ?? [],
  setupResidualErrors: setup?.residualErrors ?? [],
  audit,
  chunkResults: typedChunks,
  consolidation,
}
