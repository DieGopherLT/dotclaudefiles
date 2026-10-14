import type { SessionAppendInput } from 'claude-code'
import type { ObservedRow } from '../../types'

export const MAX_TURNS = 8
export const MAX_ROWS = 60

const TEXT_CHARS = 600
const TOOL_INPUT_CHARS = 200
const TOOL_ERROR_CHARS = 300

// Doors that carry the conversation itself. Everything else (reminders, hook
// context, compaction, the observer's own notes) is noise or a feedback loop.
const OBSERVED_DOORS: readonly SessionAppendInput['door'][] = ['prompt', 'response', 'tool-result']

// The prompt door also carries task notifications, schedules and peer or
// channel messages; only the user's own input counts as a user row.
const HUMAN_ORIGINS: readonly string[] = ['composer', 'bridge', 'sdk']

export function isObservable(e: SessionAppendInput): boolean {
  if (!OBSERVED_DOORS.includes(e.door)) return false
  if (e.agentId !== undefined) return false
  if (e.message.isMeta) return false

  if (e.door === 'prompt') return HUMAN_ORIGINS.includes(e.origin.kind)

  return e.origin.kind !== 'plugin'
}

export function toObservedRows(e: SessionAppendInput, turn: number): ObservedRow[] {
  switch (e.door) {
    case 'prompt':
      return textRows(e, turn, 'user')
    case 'response':
      return responseRows(e, turn)
    case 'tool-result':
      return toolErrorRows(e, turn)
    default:
      return []
  }
}

// Keeps the rows of the last MAX_TURNS turns, current one included, and at
// most MAX_ROWS of them (newest win) so a long turn cannot grow the buffer.
export function pushRows(buffer: readonly ObservedRow[], rows: readonly ObservedRow[], turn: number): ObservedRow[] {
  return [...buffer, ...rows].filter(row => row.turn > turn - MAX_TURNS).slice(-MAX_ROWS)
}

function textRows(e: SessionAppendInput, turn: number, kind: 'user' | 'assistant'): ObservedRow[] {
  const text = e.message.content
    .flatMap(block => (block.type === 'text' && typeof block.text === 'string' ? [block.text] : []))
    .join('\n')
    .trim()

  return text === '' ? [] : [{ turn, kind, text: text.slice(0, TEXT_CHARS) }]
}

function responseRows(e: SessionAppendInput, turn: number): ObservedRow[] {
  return e.message.content.flatMap((block): ObservedRow[] => {
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') {
      return [{ turn, kind: 'assistant', text: block.text.trim().slice(0, TEXT_CHARS) }]
    }
    if (block.type === 'tool_use' && typeof block.name === 'string') {
      const input = JSON.stringify(block.input ?? {}).slice(0, TOOL_INPUT_CHARS)
      return [{ turn, kind: 'tool_use', text: `${block.name} ${input}` }]
    }
    return []
  })
}

function toolErrorRows(e: SessionAppendInput, turn: number): ObservedRow[] {
  return e.message.content.flatMap((block): ObservedRow[] => {
    if (block.type !== 'tool_result' || block.is_error !== true) return []

    return [{ turn, kind: 'tool_error', text: resultText(block.content).slice(0, TOOL_ERROR_CHARS) }]
  })
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .flatMap(part => (part?.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
    .join('\n')
}
