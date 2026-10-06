// Milliseconds on $.clock.now(), compared against $.session.usage().startedAt.
export type CompactStamp = number

declare module 'claude-code' {
  interface PluginState {
    'task-harness': { lastCompactAt: CompactStamp }
  }
}
