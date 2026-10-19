import type { Register } from 'claude-code'

// turn.step takes the resolved id, as e.model carries it: the 'opus' alias is
// refused by the API. shortcut: pinned id, bump it when a newer Opus ships.
const PLAN_MODEL = 'claude-opus-5-5'

export const register: Register = on => {
  // shortcut: one transcript line per decision change to verify the mode and
  // model strings live, drop once confirmed.
  let lastDecision = ''
  let permissionMode: string | undefined
  let isEnabled: Promise<boolean> | undefined

  // Every classic event carries the live permission mode; Shift+Tab and
  // Enter/ExitPlanMode show up at the next one, before the next model request.
  on('classic.*', async ($, e, next) => {
    permissionMode = e.permission_mode
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    isEnabled ??= $.env.get('CLAUDE_PLAN_OPUS').then(value => value === '1')

    // Only the exact session default (sonnet at medium) is upgraded, so an
    // explicit /model or /effort choice is never overridden.
    const isUpgrade =
      (await isEnabled) &&
      e.agentId === undefined &&
      permissionMode === 'plan' &&
      /sonnet/i.test(e.model) &&
      e.effort === 'medium'

    if (e.agentId === undefined) {
      const decision = `mode=${permissionMode} model=${e.model} effort=${e.effort} upgraded=${isUpgrade}`
      if (decision !== lastDecision) {
        lastDecision = decision
        $.ui.log(`plan-opus-upgrade: ${decision}`)
      }
    }

    return yield* next(isUpgrade ? { ...e, model: PLAN_MODEL, effort: 'high' } : e)
  })
}
