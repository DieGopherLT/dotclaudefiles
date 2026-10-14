import type { Register } from 'claude-code'
import { isObservable, pushRows, toObservedRows } from './buffer'

const TURN = { plugin: 'claude-management', key: 'turn' } as const
const TURNS_SINCE_SWEEP = { plugin: 'claude-management', key: 'turnsSinceSweep' } as const
const BUFFER = { plugin: 'claude-management', key: 'buffer' } as const
const USER_FOLLOW_UPS = { plugin: 'claude-management', key: 'userFollowUps' } as const

export const register: Register = on => {
  // Observes only: the row always goes through unchanged, and a failure while
  // recording it must never reach the conversation.
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (!isObservable(e)) return stored

    try {
      const { value: turn = 0 } = await $.state.get(TURN)
      const rows = toObservedRows(e, turn)
      if (rows.length === 0) return stored

      const { value: buffer = [] } = await $.state.get(BUFFER)
      // shortcut: no version check, two concurrent appends can lose a row, which only blunts one finding.
      await $.state.set(BUFFER, pushRows(buffer, rows, turn))

      const isFollowUp = rows[0]?.kind === 'user' && buffer.some(row => row.kind === 'assistant')
      if (isFollowUp) {
        const { value: followUps = 0 } = await $.state.get(USER_FOLLOW_UPS)
        await $.state.set(USER_FOLLOW_UPS, followUps + 1)
      }
    } catch {
      // Recording is best effort.
    }

    return stored
  }).catch(($, e, next) => next(e))

  // Counts main-loop turns only; subagent runs end through this event too.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result

    try {
      const { value: turn = 0 } = await $.state.get(TURN)
      await $.state.set(TURN, turn + 1)

      const { value: sinceSweep = 0 } = await $.state.get(TURNS_SINCE_SWEEP)
      await $.state.set(TURNS_SINCE_SWEEP, sinceSweep + 1)
    } catch {
      // Counting is best effort.
    }

    return result
  })
}
