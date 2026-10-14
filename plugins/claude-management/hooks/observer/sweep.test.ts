import { describe, expect, test } from 'claude-code/testing'
import { buildRequest, parseFindings, shouldSweep } from './sweep'

const valid = { kind: 'gotcha', summary: 'npm build needs NODE_OPTIONS', evidence: 'build exploded', destination: 'memory', skill: 'remember' }

describe('shouldSweep', () => {
  test('a quiet turn with no inbox makes no model call', () => {
    expect(shouldSweep({ inbox: '', turnsSinceSweep: 1, userFollowUps: 3 })).toBe(false)
  })

  test('enough turns without a user follow-up stays quiet', () => {
    expect(shouldSweep({ inbox: '  \n', turnsSinceSweep: 9, userFollowUps: 0 })).toBe(false)
  })

  test('new inbox text sweeps at once', () => {
    expect(shouldSweep({ inbox: '- npm failed 2 times', turnsSinceSweep: 0, userFollowUps: 0 })).toBe(true)
  })

  test('K turns plus a user follow-up sweeps', () => {
    expect(shouldSweep({ inbox: '', turnsSinceSweep: 5, userFollowUps: 1 })).toBe(true)
  })
})

describe('parseFindings', () => {
  test('keeps a well-formed finding, tolerating code fences', () => {
    const text = '```json\n' + JSON.stringify({ findings: [valid] }) + '\n```'
    expect(parseFindings(text)).toEqual([valid])
  })

  test('invalid JSON yields nothing', () => {
    expect(parseFindings('{"findings": [')).toEqual([])
    expect(parseFindings('no json at all')).toEqual([])
  })

  test('drops findings with an unknown kind, unknown skill or empty summary', () => {
    const text = JSON.stringify({
      findings: [{ ...valid, kind: 'rumor' }, { ...valid, skill: 'deploy' }, { ...valid, summary: ' ' }, valid],
    })
    expect(parseFindings(text)).toEqual([valid])
  })
})

describe('buildRequest', () => {
  const rows = [
    { turn: 1, kind: 'user', text: 'old' },
    { turn: 2, kind: 'tool_error', text: 'new' },
  ] as const

  test('earlier turns are a cached prefix, the current turn is not', () => {
    const { prompt } = buildRequest(rows, 2, '', ['gotcha:x'])
    expect(Array.isArray(prompt) && prompt[0]).toMatchObject({ cache: true })
    expect(Array.isArray(prompt) && prompt[1]).not.toHaveProperty('cache')
  })

  test('a first turn sends one plain block and the delivered keys', () => {
    const { prompt } = buildRequest([rows[1]], 2, '- candidate', ['gotcha:x'])
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('- candidate')
    expect(prompt).toContain('gotcha:x')
  })
})
