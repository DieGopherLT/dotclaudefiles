import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, TurnStepInput } from 'claude-code'

interface Sent {
  model: string
  effort: TurnStepInput['effort']
}

// Stands for the engine beneath the plugin: the env var, and a model request
// whose final model and effort the test reads back.
function engineBeneath(on: On, env: string | undefined) {
  const sent: Sent[] = []
  on('env.get', () => ({ value: env }))
  on('classic.UserPromptSubmit', () => ({}))
  on('turn.step', async function* (_$, e) {
    sent.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  return sent
}

function setMode($: Engine, permission_mode: string) {
  return $.classic.UserPromptSubmit({ prompt: 'x', permission_mode })
}

// `.result` settles only once the stream is read to its end.
async function drain(stream: AsyncIterable<unknown>) {
  for await (const _chunk of stream) {
    // consumed
  }
}

function step(overrides: Partial<TurnStepInput> = {}): TurnStepInput {
  return { turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'medium', messageCount: 1, ...overrides }
}

const UPGRADED: Sent = { model: 'opus', effort: 'high' }
const UNTOUCHED: Sent = { model: 'claude-sonnet-5-5', effort: 'medium' }

describe('plan-mode opus upgrade', () => {
  test('plan mode on sonnet/medium with the env upgrades to opus/high', async ($, on) => {
    const sent = engineBeneath(on, '1')
    await setMode($, 'plan')

    await drain($.turn.step(step()))

    expect(sent).toEqual([UPGRADED])
  })

  for (const [name, env, mode, input, expected] of [
    ['default mode', '1', 'default', step(), UNTOUCHED],
    ['auto mode', '1', 'auto', step(), UNTOUCHED],
    ['sonnet at high effort', '1', 'plan', step({ effort: 'high' }), { model: 'claude-sonnet-5-5', effort: 'high' }],
    ['opus at medium effort', '1', 'plan', step({ model: 'claude-opus-5-5' }), { model: 'claude-opus-5-5', effort: 'medium' }],
    ['no effort', '1', 'plan', step({ effort: undefined }), { model: 'claude-sonnet-5-5', effort: undefined }],
    ['env unset', undefined, 'plan', step(), UNTOUCHED],
    ['env not 1', '0', 'plan', step(), UNTOUCHED],
    ['a subagent step', '1', 'plan', step({ agentId: 'agent-1' }), UNTOUCHED],
  ] as const) {
    test(`${name} is left untouched`, async ($, on) => {
      const sent = engineBeneath(on, env)
      await setMode($, mode)

      await drain($.turn.step(input))

      expect(sent).toEqual([expected])
    })
  }

  test('leaving plan mode stops the upgrade on the next step', async ($, on) => {
    const sent = engineBeneath(on, '1')

    await setMode($, 'plan')
    await drain($.turn.step(step()))
    await setMode($, 'auto')
    await drain($.turn.step(step({ index: 1 })))

    expect(sent).toEqual([UPGRADED, UNTOUCHED])
  })

  test('a session that never reported a mode is left untouched', async ($, on) => {
    const sent = engineBeneath(on, '1')

    await drain($.turn.step(step()))

    expect(sent).toEqual([UNTOUCHED])
  })
})
