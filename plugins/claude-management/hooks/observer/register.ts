import type { Register } from 'claude-code'
import { isObservable, pushRows, toObservedRows } from './buffer'
import { SWEEP_PERIOD_MS, runSweep } from './sweep'

const HOOK_STATE_DIR = '/tmp/claude-hooks'

// State references must be literals in the file that uses them, so sweep.ts
// repeats the ones it needs.
const TURN = { plugin: 'claude-management', key: 'turn' } as const
const TURNS_SINCE_SWEEP = { plugin: 'claude-management', key: 'turnsSinceSweep' } as const
const BUFFER = { plugin: 'claude-management', key: 'buffer' } as const
const USER_FOLLOW_UPS = { plugin: 'claude-management', key: 'userFollowUps' } as const
const PENDING = { plugin: 'claude-management', key: 'pending' } as const

export const register: Register = on => {
  // The marker tells the bash hooks to leave Stop findings in the inbox instead
  // of printing them; the timer drains it, outside any dispatch that could be
  // abandoned (a model call made inside one resolves `aborted`).
  on('session.start', async ($, e, next) => {
    const result = await next(e)

    try {
      const sessionId = await $.session.id()
      const markerPath = `${HOOK_STATE_DIR}/${sessionId}.observer`
      const inboxPath = `${HOOK_STATE_DIR}/${sessionId}.observer-inbox`
      await $.fs.write(markerPath, '')

      let isSweeping = false
      $.clock.every(SWEEP_PERIOD_MS, async () => {
        if (isSweeping) return

        isSweeping = true
        try {
          await runSweep($, inboxPath)
        } catch {
          // A failed sweep only skips this round of suggestions.
        } finally {
          isSweeping = false
        }
      })
    } catch {
      // Without the marker the bash hooks keep talking to the agent directly.
    }

    return result
  })

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

  // Findings ride the next real prompt as model-only context; slash commands
  // and meta prompts leave them waiting.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.isMeta) return next(e)

    const { value: pending = null } = await $.state.get(PENDING)
    if (pending === null) return next(e)

    const result = await next({ ...e, context: [...(e.context ?? []), pending] })
    if (result.drop === undefined) await $.state.set(PENDING, null)

    return result
  })
}
