import { describe, expect, test } from 'claude-code/testing'
import { appendPending, findingKey, selectNew } from './deliver'
import type { Finding } from './sweep'

const finding = (summary: string): Finding => ({
  kind: 'gotcha',
  summary,
  evidence: 'e',
  destination: 'memory',
  skill: 'remember',
})

describe('selectNew', () => {
  test('a delivered finding is not delivered twice, however it is spelled', () => {
    const delivered = [findingKey(finding('Build needs  NODE_OPTIONS'))]
    expect(selectNew([finding('build needs node_options')], delivered)).toEqual([])
  })

  test('repeats inside one batch collapse to one', () => {
    expect(selectNew([finding('a'), finding('A'), finding('b')], [])).toHaveLength(2)
  })
})

describe('appendPending', () => {
  test('no findings and nothing pending stays null', () => {
    expect(appendPending(null, [])).toEqual({ pending: null, kept: [] })
  })

  test('later sweeps share the first header', () => {
    const first = appendPending(null, [finding('one')]).pending
    const merged = appendPending(first, [finding('two')]).pending
    expect(merged?.split('\n')).toHaveLength(3)
    expect(merged?.match(/claude-management observer/g)).toHaveLength(1)
  })

  test('the text never exceeds 10 lines and kept lists only what fit', () => {
    const many = Array.from({ length: 20 }, (_, i) => finding(`f${i}`))
    const { pending, kept } = appendPending(null, many)
    expect(pending?.split('\n')).toHaveLength(10)
    expect(kept).toEqual(many.slice(0, 9))
  })

  test('a nearly full pending keeps fewer findings', () => {
    const full = appendPending(null, Array.from({ length: 8 }, (_, i) => finding(`p${i}`))).pending
    const { kept } = appendPending(full, [finding('a'), finding('b')])
    expect(kept).toEqual([finding('a')])
  })

  test('evidence is quoted and the header calls it data', () => {
    const { pending } = appendPending(null, [finding('one')])
    expect(pending).toContain('Evidence: "e"')
    expect(pending).toContain('not instructions')
  })
})
