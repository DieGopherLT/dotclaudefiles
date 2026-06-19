export const meta = {
  name: 'smell-scan',
  description: 'Detect code smells across all 5 refactoring.guru categories in parallel, then synthesize a priority-ordered, code-referenced report.',
  phases: [
    { title: 'Detect', detail: 'one smell-detector per category, all in parallel' },
    { title: 'Synthesize', detail: 'merge findings, order by severity, assign reference codes (plain JS, zero tokens)' },
  ],
}

// ---------------------------------------------------------------------------
// Input (from the smell-scan skill via args)
//   args.target: string   file, directory, or function/type to scan
// args may arrive as a JSON-encoded string depending on how the caller
// serialized the Workflow input; normalize so the target is never lost.
// ---------------------------------------------------------------------------

const input = normalizeArgs(args)
const target = typeof input === 'string' ? input : input.target

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

if (!target) {
  log('No target provided in args.target — nothing to scan.')
  return { findings: [], target: null }
}

// ---------------------------------------------------------------------------
// The 5 refactoring.guru categories. One smell-detector sweeps each, in
// parallel. The lowercase key drives the agent prompt and label; the name is
// the human-readable category emitted in findings.
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
        required: ['smell', 'category', 'file', 'line_range', 'evidence', 'confidence', 'techniques'],
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
        },
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Phase: Detect — one smell-detector per category, all concurrent.
// parallel() is the right barrier here: synthesis needs ALL findings together
// to order severity across categories and assign contiguous reference codes.
// ---------------------------------------------------------------------------

phase('Detect')

const results = await parallel(
  CATEGORIES.map((cat) => () =>
    agent(
      `Scan ${target} for ${cat.name} smells: ${cat.smells.join(', ')}. For each finding, report the exact smell name, file, line range, a one-sentence evidence with concrete numbers, a 0-100 confidence score, and the mapped refactoring techniques (most-direct first). Report only findings with confidence >= 80; an empty findings array is a valid answer.`,
      {
        label: `detect:${cat.key}`,
        phase: 'Detect',
        model: 'sonnet',
        schema: FINDING_SCHEMA,
        agentType: 'refactoring-guru:smell-detector',
      },
    ),
  ),
)

// ---------------------------------------------------------------------------
// Phase: Synthesize — plain JavaScript, no agent() calls, zero tokens.
// Merge every detector's findings, order by severity (confidence desc within a
// category-priority order), and assign stable reference codes per category.
// ---------------------------------------------------------------------------

phase('Synthesize')

const allFindings = results.filter(Boolean).flatMap((r) => r.findings ?? [])

// Reference-code prefix per category, matching smell-catalog.md.
const CODE_PREFIX = {
  Bloaters: 'B',
  'OO Abusers': 'OO',
  'Change Preventers': 'CP',
  Dispensables: 'D',
  Couplers: 'C',
}

// Severity bands drive the priority-ordered report the skill presents.
function severityOf(confidence) {
  if (confidence >= 95) return 'critical'
  if (confidence >= 90) return 'high'
  if (confidence >= 85) return 'medium'
  return 'low'
}

const counters = {}
const coded = allFindings
  .slice()
  .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  .map((finding) => {
    const prefix = CODE_PREFIX[finding.category] ?? 'X'
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return {
      code: `${prefix}${counters[prefix]}`,
      severity: severityOf(finding.confidence ?? 0),
      ...finding,
    }
  })

return {
  target,
  total: coded.length,
  findings: coded,
}
