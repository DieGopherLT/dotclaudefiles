import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

const lastCompactAt = atom({ plugin: 'task-harness', key: 'lastCompactAt' } as const, 0)

// Past this share of the window, the next session starts after a /clear.
const BUDGET_SHARE = 0.4

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
  const isOverBudget = context.tokens === undefined || context.tokens > context.window * BUDGET_SHARE

  return [
    '## Context budget (measured by task-harness mod)',
    `- context_tokens: ${context.tokens ?? 'unknown'}`,
    `- context_window: ${describeWindow(context)}`,
    `- compacted_this_session: ${hasCompacted}`,
    `- budget_verdict: ${isOverBudget || hasCompacted ? 'cut' : 'chain'}`,
  ].join('\n')
}

function describeWindow(context: SessionContextUsage): string {
  return context.percent === undefined ? `${context.window}` : `${context.window} (${context.percent}%)`
}
