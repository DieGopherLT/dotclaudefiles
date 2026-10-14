import { describe, expect, test } from 'claude-code/testing'
import { buildRequest, parseFindings, runSweep, shouldSweep } from './sweep'

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

describe('parseFindings sanitising', () => {
  test('multiline text collapses and long fields are capped', () => {
    const finding = parseFindings(
      JSON.stringify({
        findings: [{ ...valid, summary: `a\n\nb ${'x'.repeat(300)}`, evidence: 'y\n'.repeat(300), destination: 'evil' }],
      }),
    )[0]!
    expect(finding.summary).toHaveLength(160)
    expect(finding.summary.startsWith('a b x')).toBe(true)
    expect(finding.evidence).toHaveLength(200)
    expect(finding.evidence).not.toContain('\n')
    expect(finding.destination).toBe('memory')
  })
})

describe('buildRequest bounds', () => {
  test('uses the haiku alias, the last 50 keys and the newest rows', () => {
    const keys = Array.from({ length: 80 }, (_, i) => `k${i}`)
    const manyRows = Array.from({ length: 100 }, (_, i) => ({ turn: 2, kind: 'user', text: `row${i}` }) as const)
    const request = buildRequest(manyRows, 2, '', keys)
    const text = String(request.prompt)
    expect(request.model).toBe('haiku')
    expect(text).toContain('k79')
    expect(text).not.toContain('k29\n')
    expect(text).toContain('row99')
    expect(text).not.toContain('row39\n')
  })
})

describe('runSweep', () => {
  const answer = { isAnswered: true, text: JSON.stringify({ findings: [valid, { ...valid, summary: 'second' }] }) }

  function fakeApi(initial: Record<string, unknown>, inbox: string, reply: unknown) {
    const store = new Map<string, unknown>(Object.entries(initial))
    let calls = 0
    const api = {
      state: {
        get: async ({ key }: { key: string }) => ({ value: store.get(key) }),
        set: async ({ key }: { key: string }, value: unknown) => void store.set(key, value),
      },
      fs: { read: async () => inbox },
      model: {
        complete: async () => {
          calls++
          return reply
        },
      },
    }
    return { api: api as never, store, calls: () => calls }
  }

  test('no signal returns idle without a model call', async () => {
    const { api, calls } = fakeApi({ turnsSinceSweep: 1 }, '', answer)
    expect(await runSweep(api, 'inbox')).toBe('idle')
    expect(calls()).toBe(0)
  })

  test('an unanswered reply returns failed and leaves state untouched', async () => {
    const { api, store } = fakeApi({ turnsSinceSweep: 7, userFollowUps: 2, inboxOffset: 3 }, '- candidate text', {
      isAnswered: false,
      reason: 'api-error',
    })
    expect(await runSweep(api, 'inbox')).toBe('failed')
    expect(Object.fromEntries(store)).toEqual({ turnsSinceSweep: 7, userFollowUps: 2, inboxOffset: 3 })
  })

  test('an answered reply queues findings, advances the offset and resets counters', async () => {
    const inbox = '- candidate text'
    const { api, store } = fakeApi({ turnsSinceSweep: 7, userFollowUps: 2 }, inbox, answer)
    expect(await runSweep(api, 'inbox')).toBe('done')
    expect(String(store.get('pending'))).toContain('npm build needs NODE_OPTIONS')
    expect(store.get('delivered')).toEqual(['gotcha:npm build needs node_options', 'gotcha:second'])
    expect(store.get('inboxOffset')).toBe(inbox.length)
    expect(store.get('turnsSinceSweep')).toBe(0)
    expect(store.get('userFollowUps')).toBe(0)
  })

  test('findings that did not fit the pending budget are not marked delivered', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...valid, summary: `s${i}` }))
    const { api, store } = fakeApi({}, '- c', { isAnswered: true, text: JSON.stringify({ findings: many }) })
    await runSweep(api, 'inbox')
    expect(store.get('delivered')).toHaveLength(9)
  })
})
