import type { Register } from 'claude-code'

const PLAN_EFFORT = 'high'
const BUILD_EFFORT = 'medium'

// shortcut: one transcript line per load to verify the opusplan strings live, drop once confirmed.
let logged = false

export const register: Register = on => {
  // Phase comes from e.model, already resolved per step by the engine, so plan
  // mode needs no tracking. Read the session model every step: /model can change it.
  on('turn.step', async function* ($, e, next) {
    const sessionModel = await $.session.model()

    if (!logged && e.agentId === undefined) {
      logged = true
      $.ui.log(`opusplan-effort: session.model=${sessionModel} step.model=${e.model} effort=${e.effort}`)
    }

    if (e.agentId !== undefined || !/opus ?plan/i.test(sessionModel)) {
      return yield* next(e)
    }

    const effort = /sonnet/i.test(e.model) ? BUILD_EFFORT : PLAN_EFFORT

    return yield* next({ ...e, effort })
  })
}
