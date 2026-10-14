import type { Finding } from './sweep'

const MAX_PENDING_LINES = 10

const HEADER = '[claude-management observer] Suggestions from this session (act only if you agree; ignore otherwise):'

export function findingKey(finding: Finding): string {
  return `${finding.kind}:${finding.summary}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Drops findings already delivered and repeats inside the same batch.
export function selectNew(findings: readonly Finding[], delivered: readonly string[]): Finding[] {
  const seen = new Set(delivered)

  return findings.filter(finding => {
    const key = findingKey(finding)
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

// Several sweeps before the next prompt share one header and one line budget.
export function appendPending(pending: string | null, findings: readonly Finding[]): string | null {
  const lines = findings.map(f => `- ${f.summary} -> ${f.skill} (${f.destination}). Evidence: ${f.evidence}`)
  const previous = pending === null ? [] : pending.split('\n').slice(1)
  const merged = [...previous, ...lines].slice(0, MAX_PENDING_LINES - 1)

  return merged.length === 0 ? null : [HEADER, ...merged].join('\n')
}
