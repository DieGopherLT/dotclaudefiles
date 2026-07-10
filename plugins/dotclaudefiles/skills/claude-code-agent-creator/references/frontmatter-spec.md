# Frontmatter Specification

Every Claude Code sub-agent file starts with a YAML frontmatter block delimited by `---`. This block is the agent's configuration. Below the block, plain markdown becomes the agent's system prompt.

Source of truth: https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields — re-verify against that page before trusting a field or value not listed here, since the runtime evolves between minor versions.

## Required fields

**`name`** — type: string
Unique identifier using lowercase letters and hyphens. Hooks receive this value as `agent_type`. The filename doesn't have to match.

**`description`** — type: string
Tells Claude WHEN to delegate to this subagent. This is the only field Claude reads for auto-invocation — there is no separate `when_to_use` frontmatter field and no documented character cap; write it as long as it needs to be to carry concrete trigger phrases.

## Common configuration fields

**`tools`** — default: inherit all
Allowlist: only the listed tools are exposed. Comma-separated (e.g., `Read, Grep, Glob, Bash`). If omitted, the agent inherits every tool of its parent. Use `Agent(subtype-1, subtype-2)` to allowlist specific delegation targets. To preload Skills into context, use the `skills` field rather than listing `Skill` here. Also accepts MCP server-level patterns: `mcp__<server>` or `mcp__<server>__*` grants every tool from that server.

**`disallowedTools`** — default: empty
Denylist: removes tools from the inherited or specified list. If both `tools` and `disallowedTools` are set, `disallowedTools` is applied first, then `tools` is resolved against the remaining pool — a tool listed in both is removed. Also accepts MCP server-level patterns; `mcp__*` removes every MCP tool from every server.

**`model`** — default: `inherit`
Valid: `sonnet`, `opus`, `haiku`, `fable`, a full model ID (e.g., `claude-opus-4-8`), or `inherit`. Resolution order: env var `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation parameter → frontmatter `model` → main session model. A value that resolves to a model excluded by the org's `availableModels` allowlist is skipped and the subagent falls back to the inherited model.

**`color`** — default: none
Valid: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. Visual indicator in the task list and transcript. Pure cosmetic; pick something that helps you tell concurrent agents apart at a glance.

## Advanced fields

**`permissionMode`**
Valid: `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, or `manual` (alias for `default`, requires v2.1.200+). Inherited from parent unless the parent uses `bypassPermissions`, `acceptEdits`, or `auto` — in the `auto` case the subagent inherits auto mode and this field is ignored entirely. **Danger**: `bypassPermissions` skips all prompts, including writes inside `.git`/`.claude`. Ignored for plugin subagents.

**`maxTurns`** — type: integer
Hard cap on agentic turns before the subagent stops. Use to prevent runaway loops in autonomous workers.

**`skills`**
List of skill names (e.g., `[api-conventions, error-handling-patterns]`). Preloads the FULL content of those skills into the agent's context at startup — this controls preloading, not access: without it the subagent can still discover and invoke project/user/plugin skills through the Skill tool. Skills marked `disable-model-invocation: true` cannot be preloaded. To block skill invocation entirely, omit `Skill` from `tools` or add it to `disallowedTools`.

**`mcpServers`**
List of server names or inline definitions. Connects MCP servers to the agent. Inline definitions disconnect when the agent finishes. **Ignored for plugin subagents.**

**`hooks`**
Lifecycle hooks (`PreToolUse` / `PostToolUse` / `Stop`) scoped to this subagent only. Same shape as `settings.json` hooks. Fires when the agent runs as a subagent (via the Agent tool or an @-mention) and when it runs as the main session agent. When invoked as a subagent, `Stop` is converted to `SubagentStop` at runtime. **Ignored for plugin subagents.**

**`memory`** — see "Persistent memory" below
Valid: `user`, `project`, `local`. Enables a persistent directory the subagent uses to build up knowledge across conversations — codebase patterns, debugging insights, architectural decisions.

**`background`**
Valid: `true` / `false`. When `true`, always runs this subagent as a background task, even when Claude needs its result right away. When unset, Claude chooses — and as of v2.1.198 subagents run in the background by default (Claude runs one in the foreground only when it needs the result before continuing). Background subagents still surface every permission prompt in the main session; the field changes where the subagent runs, not what it's allowed to do.

**`isolation`**
Valid: `worktree`. Spawns a temporary git worktree, branched by default from the repo's default branch (not the parent session's `HEAD`), giving the subagent an isolated copy of the repository. Auto-cleanup if the subagent makes no changes.

**`effort`**
Valid: `low`, `medium`, `high`, `xhigh`, `max`. Effort level while the subagent is active. Overrides the session-level effort. Default: inherits from session. Available levels depend on the model.

**`initialPrompt`** — type: string
Auto-submitted as the first user turn when the agent runs as the main session agent (via `--agent` flag or the `agent` setting). Commands and skills are processed. Prepended to any user-provided prompt.

## Persistent memory

The `memory` field gives the subagent a directory that survives across conversations, so it can accumulate knowledge over time instead of re-deriving it every invocation.

| Value     | Directory                                     | Use when                                                                       |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `user`    | `~/.claude/agent-memory/<name-of-agent>/`      | the subagent should remember learnings across all projects                       |
| `project` | `.claude/agent-memory/<name-of-agent>/`        | the subagent's knowledge is project-specific and shareable via version control   |
| `local`   | `.claude/agent-memory-local/<name-of-agent>/`  | the subagent's knowledge is project-specific but should NOT be checked into VCS |

When memory is enabled:

- The subagent's system prompt automatically gets instructions for reading and writing to the memory directory — you do not need to hand-write your own memory-file protocol in the body.
- The system prompt also automatically includes the first ~200 lines or 25KB of `MEMORY.md` in that directory, whichever comes first, plus an instruction to curate it if it grows past that.
- `Read`, `Write`, and `Edit` are automatically enabled so the subagent can manage its memory files — do not add them to `tools` solely for memory management; only add them if the agent independently needs to edit project files for another reason.
- Prompt the agent explicitly to consult and update memory at the right moments (e.g., "check your memory for patterns you've seen before" / "save what you learned to your memory") — the body can also proactively instruct this, e.g. "Update your agent memory as you discover codepaths, patterns, or library quirks worth remembering."

## Plugin restrictions

When an agent ships inside a plugin (`plugins/<name>/agents/`), three fields are stripped for security:

- `hooks`
- `mcpServers`
- `permissionMode`

If you need any of these, copy the file to `.claude/agents/` (project) or `~/.claude/agents/` (user) instead.

## Scope and precedence

When two agents share the same `name`, the higher-precedence definition wins:

1. Managed settings (`.claude/agents/` inside the org-managed settings dir) — top priority
2. CLI flag (`claude --agents '{...}'`) — ephemeral, current session only
3. Project (`.claude/agents/` from the cwd, walking up)
4. User (`~/.claude/agents/`)
5. Plugin (`plugins/<name>/agents/`) — lowest priority

Project agents are discovered by walking UP from the current working directory. Directories added with `--add-dir` grant file access but are NOT scanned for agents.

## Annotated example

```yaml
---
name: security-auditor
description: Expert security reviewer for authentication, authorization, and input validation code. Use proactively after changes to auth, session, or permission logic. Use when reviewing PRs that touch login flows, token handling, or user-input parsing.
tools: Read, Grep, Glob, Bash
model: sonnet
effort: high
color: red
memory: project
maxTurns: 12
---
```

What this configures:

- The agent is read-only by intent (`Read, Grep, Glob, Bash`) — `memory: project` layers `Read`/`Write`/`Edit` back in automatically, scoped to its own `.claude/agent-memory/security-auditor/` directory, not to project source
- Sonnet is faster and cheap enough for systematic review
- Project memory accumulates findings/exceptions across sessions in version-controlled storage
- A 12-turn cap prevents the agent from spinning indefinitely
- Red color flags it visually as a "security" lane in concurrent runs

## Validation checklist

Before saving the agent file, confirm:

- [ ] `name` is kebab-case, unique in scope
- [ ] `description` includes "Use proactively..." or explicit trigger phrases
- [ ] `tools` is explicit (not omitted) unless full inheritance is intentional
- [ ] Read-only agents have no `Write`, `Edit`, `NotebookEdit` UNLESS `memory` is set, in which case those three are auto-enabled and scoped to the agent's own memory directory
- [ ] If shipping in a plugin: no `hooks`, `mcpServers`, `permissionMode`
- [ ] If `model` is overridden, the override is justified (cost/capability)
- [ ] If `memory` is set, the scope (`user`/`project`/`local`) matches whether the knowledge should be cross-project, version-controlled, or project-local-and-gitignored
