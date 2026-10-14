import type { Hook, ModelCompleteRequest } from 'claude-code'
import type { ObservedRow } from '../../types'
import { appendPending, findingKey, selectNew } from './deliver'
import { OBSERVER_SYSTEM } from './prompt'

export const SWEEP_EVERY_TURNS = 5
export const SWEEP_PERIOD_MS = 5000

// State references must be literals in the file that uses them.
const TURN = { plugin: 'claude-management', key: 'turn' } as const
const TURNS_SINCE_SWEEP = { plugin: 'claude-management', key: 'turnsSinceSweep' } as const
const BUFFER = { plugin: 'claude-management', key: 'buffer' } as const
const USER_FOLLOW_UPS = { plugin: 'claude-management', key: 'userFollowUps' } as const
const DELIVERED = { plugin: 'claude-management', key: 'delivered' } as const
const INBOX_OFFSET = { plugin: 'claude-management', key: 'inboxOffset' } as const
const PENDING = { plugin: 'claude-management', key: 'pending' } as const

const FINDING_KINDS = ['gotcha', 'correction', 'module', 'knowledge'] as const
const FINDING_SKILLS = ['remember', 'claudify', 'rulify'] as const

type Api = Parameters<Hook<'session.start'>>[0]

export type Finding = {
  kind: (typeof FINDING_KINDS)[number]
  summary: string
  evidence: string
  destination: string
  skill: (typeof FINDING_SKILLS)[number]
}

export type SweepSignal = { inbox: string; turnsSinceSweep: number; userFollowUps: number }

// A turn of plain chat without candidates costs no model call.
export function shouldSweep({ inbox, turnsSinceSweep, userFollowUps }: SweepSignal): boolean {
  if (inbox.trim() !== '') return true

  return turnsSinceSweep >= SWEEP_EVERY_TURNS && userFollowUps > 0
}

export function buildRequest(
  buffer: readonly ObservedRow[],
  turn: number,
  inbox: string,
  delivered: readonly string[],
): ModelCompleteRequest {
  const previous = buffer.filter(row => row.turn < turn)
  const current = buffer.filter(row => row.turn >= turn)
  const tail = [
    `Current turn:\n${formatRows(current)}`,
    inbox.trim() === '' ? '' : `Inbox (candidates from deterministic hooks):\n${inbox.trim()}`,
    `Already delivered keys:\n${delivered.join('\n') || '(none)'}`,
  ]
    .filter(part => part !== '')
    .join('\n\n')

  // The earlier rows are the stable prefix, so they ride the prompt cache.
  const prompt: ModelCompleteRequest['prompt'] =
    previous.length === 0 ? tail : [{ text: `Earlier turns:\n${formatRows(previous)}`, cache: true }, { text: tail }]

  return {
    model: 'claude-haiku-5-5',
    effort: 'low',
    maxTokens: 2000,
    timeoutMs: 30000,
    system: [{ text: OBSERVER_SYSTEM, cache: true }],
    prompt,
  }
}

// Anything that is not the expected shape yields no findings, never an error.
export function parseFindings(text: string): Finding[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return []

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    const findings = (parsed as { findings?: unknown }).findings
    return Array.isArray(findings) ? findings.flatMap(toFinding) : []
  } catch {
    return []
  }
}

export async function runSweep($: Api, inboxPath: string): Promise<void> {
  const { value: turn = 0 } = await $.state.get(TURN)
  const { value: turnsSinceSweep = 0 } = await $.state.get(TURNS_SINCE_SWEEP)
  const { value: userFollowUps = 0 } = await $.state.get(USER_FOLLOW_UPS)
  const { value: offset = 0 } = await $.state.get(INBOX_OFFSET)

  // shortcut: offset counts characters, not bytes; hook text is mostly ASCII, upgrade if paths with accents drift it.
  const inboxText = await $.fs.read(inboxPath).catch(() => '')
  const inbox = inboxText.slice(offset)
  if (!shouldSweep({ inbox, turnsSinceSweep, userFollowUps })) return

  const { value: buffer = [] } = await $.state.get(BUFFER)
  const { value: delivered = [] } = await $.state.get(DELIVERED)

  // Counters reset before the call: a failed sweep is not retried every period.
  await $.state.set(TURNS_SINCE_SWEEP, 0)
  await $.state.set(USER_FOLLOW_UPS, 0)
  await $.state.set(INBOX_OFFSET, inboxText.length)

  const reply = await $.model.complete(buildRequest(buffer, turn, inbox, delivered))
  if (!reply.isAnswered) return

  const fresh = selectNew(parseFindings(reply.text), delivered)
  if (fresh.length === 0) return

  const { value: pending = null } = await $.state.get(PENDING)
  await $.state.set(PENDING, appendPending(pending, fresh))
  await $.state.set(DELIVERED, [...delivered, ...fresh.map(findingKey)])
}

function formatRows(rows: readonly ObservedRow[]): string {
  return rows.length === 0 ? '(none)' : rows.map(row => `[${row.kind}] ${row.text}`).join('\n')
}

function toFinding(candidate: unknown): Finding[] {
  const item = candidate as Partial<Record<keyof Finding, unknown>> | null
  if (item === null || typeof item !== 'object') return []

  const { kind, summary, evidence, destination, skill } = item
  const isKnownKind = FINDING_KINDS.some(k => k === kind)
  const isKnownSkill = FINDING_SKILLS.some(s => s === skill)
  if (!isKnownKind || !isKnownSkill || typeof summary !== 'string' || summary.trim() === '') return []

  return [
    {
      kind: kind as Finding['kind'],
      skill: skill as Finding['skill'],
      summary: summary.trim(),
      evidence: typeof evidence === 'string' ? evidence.trim() : '',
      destination: typeof destination === 'string' ? destination : 'memory',
    },
  ]
}
