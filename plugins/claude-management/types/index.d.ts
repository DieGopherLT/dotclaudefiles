export type ObservedRowKind = 'user' | 'assistant' | 'tool_use' | 'tool_error'

export type ObservedRow = { turn: number; kind: ObservedRowKind; text: string }

declare module 'claude-code' {
  interface PluginState {
    'claude-management': {
      /** Compacted rows of the last few main-loop turns the observer judges. */
      buffer: ObservedRow[]
      /** Main-loop turns completed so far. */
      turn: number
      /** Turns completed since the last sweep. */
      turnsSinceSweep: number
      /** User prompts that followed an assistant answer since the last sweep. */
      userFollowUps: number
      /** Keys of findings already handed to the main agent. */
      delivered: string[]
      /** Bytes of the bash-hook inbox already read. */
      inboxOffset: number
      /** Findings text waiting to ride on the next prompt. */
      pending: string | null
    }
  }
}
