import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

const lastCompactAt = atom({ plugin: 'task-harness', key: 'lastCompactAt' } as const, 0)

// Cut at 90% of the auto-compact window: past it the next session has too
// little room left to chain into before compaction fires.
const BUDGET_RATIO = 0.9
const DEFAULT_BUDGET_TOKENS = 500_000

export const register: Register = on => {
  // Precompute installs nothing and subagents compact their own transcripts:
  // only a compaction of the main conversation that stood counts.
  on('session.compact', async ($, e, next) => {
    const compacted = await next(e)
    const isMainCompaction = e.agentId === undefined && e.trigger !== 'precompute' && compacted.skip === undefined

    // A failure here must not undo or repeat a compaction that already stood.
    if (isMainCompaction) {
      await stampCompaction($).catch(error => $.ui.log(`task-harness: compaction not recorded: ${error}`))
    }

    return compacted
  })

  // A plugin skill may arrive namespaced (task-harness:log-binnacle).
  on('skill.prompt', async ($, e, next) => {
    if (e.skill !== 'log-binnacle' && !e.skill.endsWith(':log-binnacle')) {
      return next(e)
    }

    const prompt = await next(e)

    return { text: `${prompt.text}\n\n${await describeContextBudget($)}` }
  })
}

async function stampCompaction($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, lastCompactAt, () => now)
}

// ponytail: lastCompactAt lives in $.state, which dies with the process while
// startedAt survives a --resume; a compaction before a resume reads as false.
async function describeContextBudget($: EngineInterface): Promise<string> {
  const { context, startedAt } = await $.session.usage()
  const hasCompacted = (await read($, lastCompactAt)) > startedAt
  const budget = await budgetTokens($)
  const isOverBudget = context.tokens === undefined || context.tokens > budget

  return [
    '## Context budget (measured by task-harness mod)',
    `- context_tokens: ${context.tokens ?? 'unknown'}`,
    `- context_window: ${describeWindow(context)}`,
    `- budget_tokens: ${budget}`,
    `- compacted_this_session: ${hasCompacted}`,
    `- budget_verdict: ${isOverBudget || hasCompacted ? 'cut' : 'chain'}`,
  ].join('\n')
}

// An unset or non-numeric window falls back to the default budget.
async function budgetTokens($: EngineInterface): Promise<number> {
  const window = Number(await $.env.get('CLAUDE_CODE_AUTO_COMPACT_WINDOW'))
  return window > 0 ? Math.floor(window * BUDGET_RATIO) : DEFAULT_BUDGET_TOKENS
}

function describeWindow(context: SessionContextUsage): string {
  return context.percent === undefined ? `${context.window}` : `${context.window} (${context.percent}%)`
}
