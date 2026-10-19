import type { Register } from 'claude-code'

const PLAN_EFFORT = 'high'
const BUILD_EFFORT = 'medium'

export const register: Register = on => {
  // Phase comes from e.model, already resolved per step by the engine, so plan
  // mode needs no tracking. Read the session model every step: /model can change it.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || !/opus ?plan/i.test(await $.session.model())) {
      return yield* next(e)
    }

    const effort = /sonnet/i.test(e.model) ? BUILD_EFFORT : PLAN_EFFORT

    return yield* next({ ...e, effort })
  })
}
