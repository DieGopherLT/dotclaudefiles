export const meta = {
  name: 'smell-scan',
  description: 'Detect code smells across all 5 refactoring.guru categories, one domain at a time in a pipeline, synthesizing each domain as soon as its detector batch finishes.',
  phases: [
    { title: 'Detect', detail: 'per domain, 5 smell-detector agents in parallel (one per category)' },
    { title: 'Synthesize', detail: 'per domain, merge findings, rename fields, compute severity + cross_cutting (plain JS, zero tokens)' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the smell-scan skill via args)
//   args.domains: string[]   absolute paths, one per top-level domain to scan
// args may arrive as a JSON-encoded string depending on how the caller
// serialized the Workflow input; normalize so domains are never lost.
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const domains = Array.isArray(input?.domains) ? input.domains : []

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
  return { domains: [], total: 0 }
}

// ---------------------------------------------------------------------------
// The 5 refactoring.guru categories. One smell-detector sweeps each, in
// parallel, scoped to a single domain. The lowercase key drives the agent
// prompt and label; the name is the human-readable category emitted in
// findings.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'bloaters', name: 'Bloaters', smells: ['Long Method', 'Large Class', 'Primitive Obsession', 'Long Parameter List', 'Data Clumps'] },
  { key: 'oo-abusers', name: 'OO Abusers', smells: ['Alternative Classes with Different Interfaces', 'Refused Bequest', 'Switch Statements', 'Temporary Field'] },
  { key: 'change-preventers', name: 'Change Preventers', smells: ['Divergent Change', 'Parallel Inheritance Hierarchies', 'Shotgun Surgery'] },
  { key: 'dispensables', name: 'Dispensables', smells: ['Comments', 'Duplicate Code', 'Data Class', 'Dead Code', 'Lazy Class', 'Speculative Generality'] },
  { key: 'couplers', name: 'Couplers', smells: ['Feature Envy', 'Inappropriate Intimacy', 'Incomplete Library Class', 'Message Chains', 'Middle Man'] },
]

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

// Reference-code prefix per category, matching smell-catalog.md. Used only to
// classify severity bands here — global code assignment happens in the skill
// over the aggregated set across all domains (GUD-003).
const CROSS_CUTTING_SMELLS = new Set(['Shotgun Surgery', 'Inappropriate Intimacy', 'Divergent Change'])

// Severity bands drive the priority-ordered report the skill presents.
function severityOf(confidence) {
  if (confidence >= 95) return 'critical'
  if (confidence >= 90) return 'high'
  if (confidence >= 85) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// pipeline(domains, detectDomain, synthesizeDomain): each domain flows through
// both stages independently, with no barrier between domains (GUD-001) — a
// domain whose 5-detector batch finishes first synthesizes and is ready while
// slower domains are still detecting.
// ---------------------------------------------------------------------------

const results = await pipeline(domains, detectDomain, synthesizeDomain)

return {
  domains: results.filter(Boolean),
  total: results.filter(Boolean).reduce((sum, d) => sum + d.total, 0),
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
      ),
    ),
  )

  return { domain, detectorResults }
}

// ---------------------------------------------------------------------------
// Stage: synthesizeDomain — plain JavaScript, no agent() calls, zero tokens.
// Merge the domain's 5 detector results, rename file -> path, derive
// technique from the head of techniques, compute severity and cross_cutting.
// Does NOT assign code — the skill assigns codes globally after the Workflow
// returns, since a single domain has no visibility into sibling domains'
// counts (GUD-003).
// ---------------------------------------------------------------------------

function synthesizeDomain(detected) {
  const { domain, detectorResults } = detected

  const findings = detectorResults
    .filter(Boolean)
    .flatMap((r) => r.findings ?? [])
    .map(({ file, techniques, ...rest }) => ({
      ...rest,
      path: file,
      severity: severityOf(rest.confidence ?? 0),
      technique: techniques?.[0],
      cross_cutting: CROSS_CUTTING_SMELLS.has(rest.smell),
    }))

  return { domain, total: findings.length, findings }
}
