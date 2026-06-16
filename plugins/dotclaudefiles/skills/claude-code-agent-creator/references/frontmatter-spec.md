# Frontmatter Specification

Every Claude Code sub-agent file starts with a YAML frontmatter block delimited by `---`. This block is the agent's configuration. Below the block, plain markdown becomes the agent's system prompt.

This reference catalogs every field the runtime understands, valid values, defaults, and restrictions.

## Required fields

**`name`** — type: string  
Lowercase kebab-case identifier, unique within scope (e.g., `code-reviewer`, `security-auditor`).

**`description`** — type: string  
Tells Claude WHEN to invoke the agent. This is the primary auto-invocation signal. Combined with `when_to_use`, the cap is 1,536 characters.

## Common configuration fields

**`tools`** — default: inherit all  
Allowlist: only the listed tools are exposed. Comma-separated (e.g., `Read, Grep, Glob, Bash`). If omitted, the agent inherits every tool of its parent. Use `Agent(subtype-1, subtype-2)` to allowlist specific delegation targets.

**`disallowedTools`** — default: empty  
Denylist: removes those tools from the inherited set. Applied BEFORE `tools` is resolved. Useful when you mostly want defaults but need to subtract a few risky tools.

**`model`** — default: `inherit`  
Valid: `sonnet`, `opus`, `haiku`, full model ID (e.g., `claude-opus-4-7`), or `inherit`. Resolution order: env var `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation parameter → frontmatter `model` → main session model.

**`color`** — default: none  
Valid: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. Visual indicator in the task list and transcript. Pure cosmetic; pick something that helps you tell concurrent agents apart at a glance.

**`when_to_use`** — default: none  
Extra triggering context appended to `description` in the agent listing. Counts against the 1,536-char cap.

## Advanced fields

**`permissionMode`**  
Valid: `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. Inherited from parent unless parent uses `bypassPermissions` or `acceptEdits`. **Danger**: `bypassPermissions` skips all prompts, including writes inside `.git`/`.claude`.

**`maxTurns`** — type: integer  
Hard cap on agentic turns before the agent halts. Use to prevent runaway loops in autonomous workers.

**`skills`**  
List of skill names (e.g., `[api-conventions, error-handling-patterns]`). Preloads the FULL content of those skills into the agent's context at startup. Skills marked `disable-model-invocation: true` cannot be preloaded.

**`mcpServers`**  
List of server names or inline definitions. Connects MCP servers to the agent. Inline definitions disconnect when the agent finishes. **Not supported in plugin sub-agents.**

**`hooks`**  
Hook configuration object. Defines `PreToolUse` / `PostToolUse` / `Stop` hooks scoped to this agent only. Same shape as `settings.json` hooks. **Not supported in plugin sub-agents.**

**`memory`**  
Valid: `user`, `project`, `local`. Enables persistent cross-session memory under `agent-memory/<name>/`. The first ~200 lines or 25KB of `MEMORY.md` get auto-injected.

**`background`**  
Valid: `true` / `false`. When `true`, the agent runs as a background task: permissions pre-approved at launch, new permission requests are auto-denied. `AskUserQuestion` fails silently.

**`isolation`**  
Valid: `worktree`. Spawns a temporary git worktree. The agent's edits go there, not into the current checkout. Auto-cleanup if the agent makes no changes. Useful for parallel testing.

**`effort`**  
Valid: `low`, `medium`, `high`, `xhigh`, `max`. Effort level while the agent is active. Overrides session-level effort. Honored only by models that support it.

**`initialPrompt`** — type: string  
Auto-submitted as the first user turn when the agent runs as the main session agent (via `--agent` flag or `agent` setting). Slash commands and skills are processed.

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

- The agent is read-only (`Read, Grep, Glob, Bash`) — cannot modify files, which is correct for an auditor
- Sonnet is faster and cheap enough for systematic review
- Project memory accumulates findings/exceptions across sessions in version-controlled storage
- A 12-turn cap prevents the agent from spinning indefinitely
- Red color flags it visually as a "security" lane in concurrent runs

## Validation checklist

Before saving the agent file, confirm:

- [ ] `name` is kebab-case, unique in scope
- [ ] `description` includes "Use proactively..." or explicit trigger phrases
- [ ] `description` + `when_to_use` ≤ 1,536 characters
- [ ] `tools` is explicit (not omitted) unless full inheritance is intentional
- [ ] Read-only agents have NO `Write`, `Edit`, `NotebookEdit`
- [ ] If shipping in a plugin: no `hooks`, `mcpServers`, `permissionMode`
- [ ] If `model` is overridden, the override is justified (cost/capability)
