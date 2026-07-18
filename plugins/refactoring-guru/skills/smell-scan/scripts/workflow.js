export const meta = {
  name: 'smell-scan',
  description: 'Detect code smells across all 5 refactoring.guru categories, one domain at a time in a pipeline, then assign global reference codes and serialize one source-of-truth file per domain — all in plain JS.',
  phases: [
    { title: 'Detect', detail: 'per domain, 5 smell-detector agents in parallel (one per category)' },
    { title: 'Synthesize', detail: 'per domain, merge findings, rename fields, normalize paths to repo-relative, compute severity + cross_cutting (plain JS, zero tokens)' },
    { title: 'Assign & serialize', detail: 'globally assign reference codes over the aggregated set, then serialize one SoT JSON file per domain (plain JS, zero tokens)' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the smell-scan skill via args)
//   args.domains:   string[]   absolute paths, one per top-level domain to scan
//   args.repoRoot:  string     absolute repo root, used to make every path
//                              (domains and finding files) repo-relative
//   args.scannedAt: string     ISO 8601 timestamp captured by the skill; the
//                              script cannot call Date.now()/new Date() (it
//                              would break Workflow resume), so it arrives here
// args may arrive as a JSON-encoded string depending on how the caller
// serialized the Workflow input; normalize so nothing is lost.
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const domains = Array.isArray(input?.domains) ? input.domains : []
const repoRoot = typeof input?.repoRoot === 'string' ? input.repoRoot : ''
const scannedAt = typeof input?.scannedAt === 'string' ? input.scannedAt : ''

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

if (domains.length === 0) {
  log('No domains provided in args.domains — nothing to scan.')
  return { domains: [], total: 0, files: [] }
}

// ---------------------------------------------------------------------------
// The 5 refactoring.guru categories. One smell-detector sweeps each, in
// parallel, scoped to a single domain. The lowercase key drives the agent
// prompt and label; name is the human-readable category emitted in findings;
// prefix is the reference-code prefix used when codes are assigned globally.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'bloaters', name: 'Bloaters', prefix: 'B', smells: ['Long Method', 'Large Class', 'Primitive Obsession', 'Long Parameter List', 'Data Clumps'] },
  { key: 'oo-abusers', name: 'OO Abusers', prefix: 'OO', smells: ['Alternative Classes with Different Interfaces', 'Refused Bequest', 'Switch Statements', 'Temporary Field'] },
  { key: 'change-preventers', name: 'Change Preventers', prefix: 'CP', smells: ['Divergent Change', 'Parallel Inheritance Hierarchies', 'Shotgun Surgery'] },
  { key: 'dispensables', name: 'Dispensables', prefix: 'D', smells: ['Comments', 'Duplicate Code', 'Data Class', 'Dead Code', 'Lazy Class', 'Speculative Generality'] },
  { key: 'couplers', name: 'Couplers', prefix: 'C', smells: ['Feature Envy', 'Inappropriate Intimacy', 'Incomplete Library Class', 'Message Chains', 'Middle Man'] },
]

// category name -> reference-code prefix, derived from CATEGORIES so the two
// never drift. Consumed by assignGlobalCodes.
const CATEGORY_PREFIX = Object.fromEntries(CATEGORIES.map((cat) => [cat.name, cat.prefix]))

// FINDING_SCHEMA is what each detector returns. Note it has NO `code` field:
// detectors are blind to sibling findings, so `code` is injected later by
// assignGlobalCodes over the full aggregated set (see below). The `category`
// field is still requested but NOT trusted downstream — synthesizeDomain
// overrides it with the batch's authoritative category, since the code prefix
// keys on it and an LLM echo could drift.
const FINDING_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['smell', 'category', 'file', 'line_range', 'evidence', 'confidence', 'techniques', 'resolution_plan'],
        properties: {
          smell: { type: 'string', description: 'exact smell name from the catalog' },
          category: { type: 'string', description: 'human-readable category name' },
          file: { type: 'string' },
          line_range: {
            type: 'array',
            items: { type: 'number' },
            description: '[start, end] line numbers',
          },
          evidence: { type: 'string', description: 'one sentence stating what was observed, with concrete numbers' },
          confidence: { type: 'number', description: '0-100; only findings >= 80 are reported' },
          techniques: {
            type: 'array',
            items: { type: 'string' },
            description: 'mapped refactoring.guru techniques, most-direct first',
          },
          resolution_plan: {
            type: 'string',
            description: 'concrete, actionable sentence describing what to extract/move/replace and where',
          },
        },
      },
    },
  },
}

// Smells whose fix ripples across multiple sites; flagged so the report and the
// refactor skill can treat them as cross-cutting.
const CROSS_CUTTING_SMELLS = new Set(['Shotgun Surgery', 'Inappropriate Intimacy', 'Divergent Change'])

// Severity bands drive the priority-ordered report the skill presents.
function severityOf(confidence) {
  if (confidence >= 95) return 'critical'
  if (confidence >= 90) return 'high'
  if (confidence >= 85) return 'medium'
  return 'low'
}

// Detectors emit `file` as either an absolute path or a repo-relative one —
// the LLM does not guarantee a format. Collapse both to repo-relative so the
// persisted SoT never leaks an absolute path (which would break the reference
// the refactor skill later consumes).
function toRepoRelative(filePath) {
  if (!filePath || !repoRoot) return filePath
  const root = repoRoot.endsWith('/') ? repoRoot : `${repoRoot}/`
  return filePath.startsWith(root) ? filePath.slice(root.length) : filePath
}

// ---------------------------------------------------------------------------
// pipeline(domains, detectDomain, synthesizeDomain): each domain flows through
// both stages independently, with no barrier between domains (GUD-001) — a
// domain whose 5-detector batch finishes first synthesizes and is ready while
// slower domains are still detecting.
// ---------------------------------------------------------------------------

const results = await pipeline(domains, detectDomain, synthesizeDomain)

const validResults = results.filter(Boolean)

// Codes are assigned globally, over the aggregated set across every domain, so
// a code is never ambiguous within a scan. This needs all domains' findings at
// once, so it runs after the pipeline drains (not inside a per-domain stage).
const codedDomains = assignGlobalCodes(validResults).map((d) => ({ ...d, domain: toRepoRelative(d.domain) }))

const files = codedDomains.map(serializeDomain)

return {
  domains: codedDomains,
  total: codedDomains.reduce((sum, d) => sum + d.total, 0),
  files,
}

// ---------------------------------------------------------------------------
// Stage: detectDomain — inner parallel() barrier of 5 category detectors
// scoped to ONE domain. Synthesis for that domain needs all 5 results, so
// this barrier is required; it does not block sibling domains in the
// pipeline.
// ---------------------------------------------------------------------------

async function detectDomain(domain) {
  const detectorResults = await parallel(
    CATEGORIES.map((cat) => () =>
      agent(
        `Scan ${domain} for ${cat.name} smells: ${cat.smells.join(', ')}. For each finding, report the exact smell name, file, line range, a one-sentence evidence with concrete numbers, a 0-100 confidence score, the mapped refactoring techniques (most-direct first), and a concrete resolution_plan sentence. Report only findings with confidence >= 80; an empty findings array is a valid answer.`,
        {
          label: `detect:${domain}:${cat.key}`,
          phase: 'Detect',
          model: 'sonnet',
          schema: FINDING_SCHEMA,
          agentType: 'refactoring-guru:smell-detector',
        },
        // Tag each batch with its authoritative category (the one it was asked
        // to scan) so downstream code assignment never depends on the LLM
        // echoing the category name correctly.
      ).then((result) => ({ category: cat.name, findings: result?.findings ?? [] })),
    ),
  )

  return { domain, detectorResults }
}

// ---------------------------------------------------------------------------
// Stage: synthesizeDomain — plain JavaScript, no agent() calls, zero tokens.
// Merge the domain's 5 detector results, normalize `file` -> repo-relative
// `path`, derive technique from the head of techniques, compute severity and
// cross_cutting. Field order matches the SoT schema so the persisted file
// reads cleanly. Does NOT assign code — that happens globally after the
// pipeline drains, since a single domain has no visibility into sibling
// domains' counts (GUD-003).
// ---------------------------------------------------------------------------

function synthesizeDomain(detected) {
  const { domain, detectorResults } = detected

  const findings = detectorResults
    .filter(Boolean)
    .flatMap((batch) =>
      (batch.findings ?? []).map(({ file, techniques, smell, line_range, evidence, confidence, resolution_plan }) => ({
        smell,
        // Authoritative category from the detector batch, not the LLM-echoed
        // field — this is what CATEGORY_PREFIX keys on, so it must be exact.
        category: batch.category,
        path: toRepoRelative(file),
        line_range,
        evidence,
        confidence,
        severity: severityOf(confidence ?? 0),
        technique: techniques?.[0],
        resolution_plan,
        cross_cutting: CROSS_CUTTING_SMELLS.has(smell),
      })),
    )

  return { domain, total: findings.length, findings }
}

// ---------------------------------------------------------------------------
// assignGlobalCodes — stable-sort every finding across all domains by
// confidence descending (Array.prototype.sort is stable in JS, so equal
// confidences keep detector order), then hand each a `code` from a per-prefix
// counter that spans all domains. Returns the same domain shape with `code`
// prepended to each finding.
// ---------------------------------------------------------------------------

function assignGlobalCodes(domainResults) {
  const refs = domainResults.flatMap((domain, domainIndex) =>
    domain.findings.map((finding, findingIndex) => ({ finding, domainIndex, findingIndex })),
  )

  const counters = {}
  const codeByRef = new Map()
  for (const { finding, domainIndex, findingIndex } of [...refs].sort((a, b) => (b.finding.confidence ?? 0) - (a.finding.confidence ?? 0))) {
    const prefix = CATEGORY_PREFIX[finding.category] ?? '?'
    counters[prefix] = (counters[prefix] ?? 0) + 1
    codeByRef.set(`${domainIndex}:${findingIndex}`, `${prefix}${counters[prefix]}`)
  }

  return domainResults.map((domain, domainIndex) => ({
    ...domain,
    findings: domain.findings.map((finding, findingIndex) => ({
      code: codeByRef.get(`${domainIndex}:${findingIndex}`),
      ...finding,
    })),
  }))
}

// ---------------------------------------------------------------------------
// serializeDomain — turn one coded domain into a ready-to-write SoT file. The
// skill's Step 4 just writes each entry verbatim; all path/slug/JSON logic
// lives here so the skill stays free of derivation. `domain` is already
// repo-relative by the time this runs.
//
// The returned `path` is ABSOLUTE (joined under repoRoot) because the Write
// tool the skill uses requires an absolute file_path — Step 4 must not have to
// resolve it. The SoT's INTERNAL paths (its `domain` field and each finding's
// `path`) stay repo-relative so the persisted document is portable. If repoRoot
// is missing, fall back to the repo-relative path rather than emit a broken join.
// ---------------------------------------------------------------------------

function serializeDomain(domain) {
  const slug = domain.domain.replace(/\//g, '-')
  const sot = {
    domain: domain.domain,
    scanned_at: scannedAt,
    total: domain.total,
    findings: domain.findings,
  }

  const relativePath = `.claude/refactoring-guru/findings/${slug}.json`
  const root = repoRoot.replace(/\/$/, '')

  return {
    path: root ? `${root}/${relativePath}` : relativePath,
    content: JSON.stringify(sot, null, 2),
  }
}
