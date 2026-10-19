import { describe, expect, test } from 'claude-code/testing'
import type { On, TurnStepInput } from 'claude-code'

// Stands for the engine beneath the plugin: a session on `model`, and a model
// request whose effort the test reads back.
function engineBeneath(on: On, model: string) {
  const sent: Array<TurnStepInput['effort']> = []
  on('session.model', () => ({ value: model }))
  on('turn.step', async function* (_$, e) {
    sent.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  return sent
}

// `.result` settles only once the stream is read to its end.
async function drain(stream: AsyncIterable<unknown>) {
  for await (const _chunk of stream) {
    // consumed
  }
}

function step(overrides: Partial<TurnStepInput> = {}): TurnStepInput {
  return { turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'xhigh', messageCount: 1, ...overrides }
}

describe('opusplan effort', () => {
  for (const [name, model, effort] of [
    ['opus step plans at high', 'claude-opus-5-5', 'high'],
    ['sonnet step builds at medium', 'claude-sonnet-5-5', 'medium'],
  ] as const) {
    test(name, async ($, on) => {
      const sent = engineBeneath(on, 'opusplan')

      await drain($.turn.step(step({ model })))

      expect(sent).toEqual([effort])
    })
  }

  for (const [name, sessionModel, input] of [
    ['a subagent step', 'opusplan', step({ agentId: 'agent-1', model: 'claude-sonnet-5-5' })],
    ['a step outside opusplan', 'opus', step({ model: 'claude-sonnet-5-5' })],
  ] as const) {
    test(`${name} keeps its effort`, async ($, on) => {
      const sent = engineBeneath(on, sessionModel)

      await drain($.turn.step(input))

      expect(sent).toEqual(['xhigh'])
    })
  }
})
