import type { SessionAppendInput } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
import { isObservable, MAX_TURNS, pushRows, toObservedRows } from './buffer'

type Blocks = SessionAppendInput['message']['content']

function append(door: SessionAppendInput['door'], content: Blocks, over: Partial<SessionAppendInput> = {}): SessionAppendInput {
  return {
    door,
    uuid: 'row-1',
    origin: { kind: 'model', model: 'm' },
    message: { type: 'user', content },
    ...over,
  }
}

const text = (value: string): Blocks => [{ type: 'text', text: value }]

describe('isObservable', () => {
  test('keeps main-loop prompts, responses and tool results', () => {
    for (const door of ['prompt', 'response', 'tool-result'] as const) {
      expect(isObservable(append(door, text('x')))).toBe(true)
    }
  })

  test('drops rows of a subagent loop', () => {
    expect(isObservable(append('response', text('x'), { agentId: 'agent-1' }))).toBe(false)
  })

  test('drops rows a plugin put in the conversation, the observer own included', () => {
    expect(isObservable(append('note', text('x'), { origin: { kind: 'plugin', event: 'prompt.submit' } }))).toBe(false)
    expect(isObservable(append('prompt', text('x'), { origin: { kind: 'plugin', event: 'prompt.submit' } }))).toBe(false)
  })

  test('drops hidden prompts, hook context, compaction and notices', () => {
    expect(isObservable(append('prompt', text('x'), { message: { type: 'user', isMeta: true, content: text('x') } }))).toBe(false)
    for (const door of ['hook-context', 'compaction', 'notice', 'note', 'queue', 'delivery'] as const) {
      expect(isObservable(append(door, text('x')))).toBe(false)
    }
  })
})

describe('toObservedRows', () => {
  test('turns a prompt into one user row and ignores an empty one', () => {
    expect(toObservedRows(append('prompt', text('  fix the bug  ')), 3)).toEqual([{ turn: 3, kind: 'user', text: 'fix the bug' }])
    expect(toObservedRows(append('prompt', text('   ')), 3)).toEqual([])
  })

  test('turns a response into assistant text and tool_use rows, skipping thinking', () => {
    const rows = toObservedRows(
      append('response', [
        { type: 'thinking', thinking: 'secret' },
        { type: 'text', text: 'Running tests' },
        { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'go test ./...' } },
      ]),
      2,
    )

    expect(rows).toEqual([
      { turn: 2, kind: 'assistant', text: 'Running tests' },
      { turn: 2, kind: 'tool_use', text: 'Bash {"command":"go test ./..."}' },
    ])
  })

  test('cuts long tool inputs and long error texts', () => {
    const [toolUse] = toObservedRows(append('response', [{ type: 'tool_use', id: 't1', name: 'Write', input: { content: 'a'.repeat(500) } }]), 1)
    expect(toolUse?.text.length).toBeLessThanOrEqual('Write '.length + 200)

    const [error] = toObservedRows(append('tool-result', [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'e'.repeat(900) }]), 1)
    expect(error?.text.length).toBe(300)
  })

  test('keeps only failed tool results, and reads block-list contents', () => {
    const rows = toObservedRows(
      append('tool-result', [
        { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
        { type: 'tool_result', tool_use_id: 't2', is_error: true, content: [{ type: 'text', text: 'exit 1' }] },
      ]),
      4,
    )

    expect(rows).toEqual([{ turn: 4, kind: 'tool_error', text: 'exit 1' }])
  })

  test('ignores a door it does not read', () => {
    expect(toObservedRows(append('note', text('x')), 1)).toEqual([])
  })
})

describe('pushRows', () => {
  test('drops rows older than the last MAX_TURNS turns', () => {
    const old = { turn: 1, kind: 'user' as const, text: 'old' }
    const recent = { turn: 1 + MAX_TURNS, kind: 'user' as const, text: 'recent' }

    expect(pushRows([old], [recent], 1 + MAX_TURNS)).toEqual([recent])
  })

  test('keeps rows of the window, current turn included', () => {
    const edge = { turn: 2, kind: 'assistant' as const, text: 'edge' }
    const now = { turn: 1 + MAX_TURNS, kind: 'user' as const, text: 'now' }

    expect(pushRows([edge], [now], 1 + MAX_TURNS)).toEqual([edge, now])
  })
})
