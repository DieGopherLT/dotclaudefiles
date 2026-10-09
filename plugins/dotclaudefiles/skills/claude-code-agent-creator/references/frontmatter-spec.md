# Frontmatter Specification

A sub-agent file starts with a YAML block delimited by `---`. Below it, plain markdown becomes the system prompt. The agent receives that prompt plus environment details, the CLAUDE.md hierarchy and a git-status snapshot — not the Claude Code system prompt.

Source of truth: https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields. Re-verify anything not listed here; the runtime changes between minor versions.

## Files Claude Code skips silently

- no `name` → treated as documentation beside your agents
- `name` present but no `description` → skipped (debug log only)
- `name` starting with `-` or containing `:` (reserved for `plugin:agent` scoping) → skipped
- opening `---` not on line 1 → treated as documentation
- YAML that does not parse → skipped

`claude plugin validate <dir>` catches parse errors in any `agents` directory (v2.1.233+). Run `claude --debug` to see the log.

## Required

| Field | Notes |
| --- | --- |
| `name` | lowercase + hyphens. Hooks receive it as `agent_type`. Filename need not match. Must be unique across the whole `agents/` tree (subfolders are scanned recursively but do not affect identity). |
| `description` | When to delegate. The only field Claude reads for auto-invocation. **Combined descriptions of all custom agents have a 15,000-token budget** — Claude Code warns at startup when exceeded. Keep it to trigger phrases; put method in the body. |

## Common

| Field | Default | Values / notes |
| --- | --- | --- |
| `tools` | inherit all | Comma-separated allowlist. Accepts `mcp__<server>` / `mcp__<server>__*`. If nothing in the list resolves to a tool, the agent fails to launch with an error naming the entries. Background runs remove non-whitelisted built-ins silently (see `tools.md`). To preload skills use `skills`, not `Skill` here. |
| `disallowedTools` | empty | Denylist, applied *before* `tools`. `mcp__*` removes every MCP tool. |
| `model` | inherit | `haiku`, `sonnet`, `opus`, `fable`, a full ID (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`), or `inherit`. Resolution: per-invocation param → frontmatter → `CLAUDE_CODE_SUBAGENT_MODEL` → main session. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` makes the env var win over all. A value blocked by the org's `availableModels` is substituted with the newest permitted version of that family, else the inherited model. `/tasks` shows the model (and effort) each running agent is on. |
| `effort` | inherit session | `low`, `medium`, `high`, `xhigh`, `max`. Omitting it inherits the session level, which is the model's default unless the user changed it (`medium` on Haiku 5.5 / Sonnet 5.5 / Opus 5.5, `high` on Fable). Overrides the session level but not `CLAUDE_CODE_EFFORT_LEVEL`; a per-invocation `effort` parameter on the Agent call overrides the field and persists on resume (v2.1.292+). Unsupported level degrades silently to the highest supported level below it. |
| `omitClaudeMd` | false | `true` skips the user, project and local CLAUDE.md files. Shortens the prompt of a narrow worker; keep it off when the agent needs project conventions. |
| `color` | none | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. Cosmetic. |
| `maxTurns` | none | Hard cap on agentic turns. At the cap the output is returned **marked partial** and Claude can resume the agent (v2.1.246+). The subscriber's brake. |
| `memory` | none | `user`, `project`, `local`. See below. |

## Advanced

| Field | Notes |
| --- | --- |
| `permissionMode` | `default` (alias `manual`), `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. Inherits from parent; if the parent uses `bypassPermissions`, `acceptEdits` or `auto`, the parent wins and this field is ignored. On Pro/Max/Team the session starts in `auto` unless changed, so in practice this field is often inert. `bypassPermissions` skips prompts including writes to `.git`, `.claude`, `.vscode` etc. **Ignored for plugin agents.** |
| `skills` | List of skill names whose full content is injected at startup. Controls preloading, not access — the agent can still invoke other skills via `Skill`. Skills with `disable-model-invocation: true` cannot be preloaded. |
| `mcpServers` | Names of configured servers, or inline definitions (`stdio`, `http`, `sse`, `ws`) scoped to this agent and disconnected when it finishes. Inline servers in project `.claude/agents/` load only after the folder is trusted. **Ignored for plugin agents.** |
| `hooks` | Same shape as `settings.json` hooks, scoped to this agent. `Stop` becomes `SubagentStop` when run as a sub-agent. Project-level frontmatter hooks need the workspace trust dialog accepted. **Ignored for plugin agents.** |
| `background` | `true` forces background even when Claude wants the result now. In interactive sessions (fork mode on by default since v2.1.232) sub-agents already run in background. Permission prompts still surface in the main session. |
| `isolation` | `worktree` → temporary git worktree branched from the default branch (not the parent's `HEAD`). Bash/PowerShell/Monitor commands whose cwd escapes the worktree fail. Auto-cleanup if no changes. |
| `initialPrompt` | Auto-submitted first user turn when the file runs as the main session (`--agent` or `agent` setting). |
| `experimental` | Map. `cacheTtl: 5m | 1h` picks the prompt-cache lifetime for this agent's requests (v2.1.248+). `1h` is ignored while a subscription is running on usage credits. Write it nested, not top-level. |

## Persistent memory

| Value | Directory | Use when |
| --- | --- | --- |
| `user` | `~/.claude/agent-memory/<name>/` | learnings should follow the user across projects |
| `project` | `.claude/agent-memory/<name>/` | project-specific, shareable via VCS — **recommended default** |
| `local` | `.claude/agent-memory-local/<name>/` | project-specific, must not be committed |

When set, the runtime: injects read/write instructions into the system prompt; injects the first 200 lines or 25 KB of `MEMORY.md` with an instruction to curate it; enables `Read`, `Write`, `Edit` automatically. Do not add those tools for memory, and do not write your own file protocol in the body. Do prompt the agent to consult memory before starting and to save what it learned when done.

Memory is part of auto memory: if `autoMemoryEnabled` is false or `CLAUDE_CODE_DISABLE_AUTO_MEMORY` is set, the field does nothing.

## Plugin restrictions

Inside `plugins/<name>/agents/`, `hooks`, `mcpServers` and `permissionMode` are stripped. A plugin agent whose frontmatter has no `name` or fails to parse still loads under its filename. Subfolders become part of the scoped ID: `agents/review/security.md` in `my-plugin` → `my-plugin:review:security`.

## Scope and precedence

Same `name` in several places → highest wins:

1. Managed settings (`.claude/agents/` in the managed settings dir)
2. `--agents '{...}'` CLI flag (session only)
3. Project `.claude/agents/` (walking up from cwd; nested → closest to cwd wins)
4. User `~/.claude/agents/`
5. Plugin `agents/`

`--add-dir` / `/add-dir` directories DO load their `.claude/agents/` (but are not watched for changes — restart after editing there).

## Validation checklist

- [ ] `name` kebab-case, unique in tree, no `:`, no leading `-`
- [ ] `description` present, trigger-phrase driven, short
- [ ] `tools` explicit; nothing in it that background strips as the *only* entry (`LSP` always next to `Grep`)
- [ ] auditors include the Confidence Scoring block
- [ ] read-only agents have no `Write`/`Edit`/`NotebookEdit` unless `memory` is set
- [ ] `model` is a bare alias unless a pin is intentional; `effort` is `medium` or `high` unless a measured miss justifies `xhigh`; never `max`
- [ ] `fable` only when billing allows (API or Max within 50 % weekly) and the scope is broad, complex and critical at once
- [ ] plugin agents: no `hooks`, `mcpServers`, `permissionMode`
- [ ] `memory` scope matches shareability
