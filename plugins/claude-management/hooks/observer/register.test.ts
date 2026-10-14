import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

const turnEnd = { answer: '', durationMs: 1, isAborted: false, reason: 'answer' } as const

// The kit answers $.state; the test reads what the plugin wrote through the
// state.set events, since a test's $ has no $.state of its own.
function recordStateWrites(on: On): { key: string; value: unknown }[] {
  const writes: { key: string; value: unknown }[] = []
  on('state.set', ($, e, next) => {
    writes.push({ key: e.key, value: e.value })
    return next(e)
  })
  return writes
}

describe('observer hooks', () => {
  test('counts main-loop turns and ignores subagent runs', async ($, on) => {
    const writes = recordStateWrites(on)
    on('turn.complete', () => ({ text: '' }))

    await $.turn.complete({ ...turnEnd, turnId: 'main-1' })
    await $.turn.complete({ ...turnEnd, turnId: 'agent-1', agentId: 'agent-a' })
    await $.turn.complete({ ...turnEnd, turnId: 'main-2' })

    expect(writes.filter(w => w.key === 'turn').map(w => w.value)).toEqual([1, 2])
    expect(writes.filter(w => w.key === 'turnsSinceSweep').map(w => w.value)).toEqual([1, 2])
  })
})
