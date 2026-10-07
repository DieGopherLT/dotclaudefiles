import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, SessionCompactInput, SessionCompactResult, SessionMessage } from 'claude-code'

const STARTED_AT = 500
const SKILL_TEXT = 'Close the session.'
const SUMMARY: SessionMessage[] = [{ role: 'user', text: 'summary', toolUses: [] }]

// Stands for the engine beneath the plugin: a session that began at STARTED_AT,
// a clock past it, and a compaction that stands unless `skip` is given.
function engineBeneath(on: On, compaction: SessionCompactResult = { messages: SUMMARY }, startedAt = STARTED_AT) {
  mock.clock(on, { now: 1_000 })
  on('session.usage', () => ({
    value: { startedAt, context: { tokens: 312_450, window: 1_000_000, percent: 31 }, rateLimits: [] },
  }))
  on('session.compact', () => compaction)
  on('skill.prompt', ($, e) => ({ text: e.text }))
}

function compaction(overrides: Partial<SessionCompactInput> = {}): SessionCompactInput {
  return { trigger: 'auto', messages: SUMMARY, ...overrides }
}

describe('log-binnacle context budget', () => {
  test('appends the figures and no compaction to log-binnacle', async ($, on) => {
    engineBeneath(on)

    const { text } = await $.skill.prompt({ skill: 'log-binnacle', text: SKILL_TEXT })

    expect(text.startsWith(SKILL_TEXT)).toBe(true)
    expect(text).toContain('- context_tokens: 312450')
    expect(text).toContain('- context_window: 1000000 (31%)')
    expect(text).toContain('- compacted_this_session: false')
  })

  test('matches the namespaced skill name too', async ($, on) => {
    engineBeneath(on)

    const { text } = await $.skill.prompt({ skill: 'task-harness:log-binnacle', text: SKILL_TEXT })

    expect(text).toContain('## Context budget')
  })

  for (const skill of ['commit', 'changelog-binnacle']) {
    test(`leaves ${skill} untouched`, async ($, on) => {
      engineBeneath(on)

      const { text } = await $.skill.prompt({ skill, text: SKILL_TEXT })

      expect(text).toBe(SKILL_TEXT)
    })
  }

  // /clear restarts startedAt past an earlier compaction's stamp.
  test('a compaction before the session began does not count', async ($, on) => {
    engineBeneath(on, undefined, 2_000)

    await $.session.compact(compaction())
    const { text } = await $.skill.prompt({ skill: 'log-binnacle', text: SKILL_TEXT })

    expect(text).toContain('- compacted_this_session: false')
  })

  test('a main-conversation compaction after the session began counts', async ($, on) => {
    engineBeneath(on)

    await $.session.compact(compaction())
    const { text } = await $.skill.prompt({ skill: 'log-binnacle', text: SKILL_TEXT })

    expect(text).toContain('- compacted_this_session: true')
  })

  for (const [name, input] of [
    ['a precompute', compaction({ trigger: 'precompute' })],
    ['a subagent', compaction({ agentId: 'agent-1' })],
  ] as const) {
    test(`${name} compaction does not count`, async ($, on) => {
      engineBeneath(on)

      await $.session.compact(input)
      const { text } = await $.skill.prompt({ skill: 'log-binnacle', text: SKILL_TEXT })

      expect(text).toContain('- compacted_this_session: false')
    })
  }

  test('a skipped compaction does not count', async ($, on) => {
    engineBeneath(on, { skip: 'vetoed' })

    await $.session.compact(compaction())
    const { text } = await $.skill.prompt({ skill: 'log-binnacle', text: SKILL_TEXT })

    expect(text).toContain('- compacted_this_session: false')
  })
})
