# Tools Reference

Catalog of what a sub-agent may declare in `tools`, with least-privilege guidance and the one fact that trips most agent authors: **background runs filter the list**.

## Availability by run mode

Sub-agents inherit the parent's built-in and MCP tools, minus two filters.

**Filter 1 — always removed from every sub-agent** (even if listed): `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode` (unless `permissionMode: plan`), `EndConversation`, `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`, `Workflow`, and `Agent` once the nesting depth limit (default 3) is reached. A sub-agent cannot ask the user anything: on ambiguity it returns the question in its result.

**Filter 2 — background runs keep only these built-ins** (plus every MCP tool):
`Read, Grep, Glob, Bash, PowerShell, Edit, Write, NotebookEdit, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, EnterWorktree, ExitWorktree, Monitor, TaskStop, SendMessage, Artifact`

Everything else — `LSP`, `TaskCreate/List/Get/Update`, `CronCreate/List/Delete`, `ListAgents`, `ListMcpResourcesTool`, `ReadMcpResourceTool` — is removed **without error**. Only if the whole list resolves to nothing does the launch fail.

Background is the default in interactive sessions (fork mode on since v2.1.232) and Claude cannot request foreground there. Foreground happens when: the user @-mentions the agent and it is not forced background, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, `-p` / SDK sessions without fork mode when Claude needs the result now, or the file runs as the main thread via `claude --agent`. Forks (`/subtask`) skip both filters and get the parent's exact pool.

Design consequence: **write the list as if it will run in background**, and treat foreground-only tools as a bonus.

## File operations

| Tool | Does | Grant when | Withhold when |
| --- | --- | --- | --- |
| `Read` | reads files, partial reads via offset/limit | always | never |
| `Write` | creates / overwrites a file | implementers producing new files | any read-only agent (auditor, researcher, orchestrator) |
| `Edit` | targeted in-place replacement | implementers, refactorers | read-only agents |
| `Glob` | file discovery by pattern | batch processing of a file type | single known path |
| `Grep` | regex content search | pattern hunts, and the background fallback for `LSP` | — |
| `NotebookEdit` | Jupyter cell edits | `.ipynb` work | anything else |

## Execution

| Tool | Does | Grant when | Withhold when |
| --- | --- | --- | --- |
| `Bash` | shell; cwd resets to project root per call; inside `isolation: worktree` commands whose cwd escapes the worktree fail | git, tests, builds, linters | the agent only reads text |
| `PowerShell` | native PowerShell (opt-in on Linux/macOS) | Windows-only tooling | Bash works |
| `Monitor` | streams a long-running command's stdout | tailing logs, polling CI | short commands; not on Bedrock/Vertex |

## Code intelligence

| Tool | Does | Grant when | Withhold when |
| --- | --- | --- | --- |
| `LSP` | jump-to-definition, references, hover types, diagnostics after edits | symbol-level navigation in **foreground** runs; always pair with `Grep` | background-only agents (it is stripped) |
| `ToolSearch` | loads deferred tool schemas (`select:A,B` or keyword search) | many MCP tools deferred | small fixed tool sets |

## Agent control

| Tool | Does | Grant when | Withhold when |
| --- | --- | --- | --- |
| `Agent` | spawns sub-agents. Nesting allowed up to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3). **Inside a sub-agent definition the `Agent(type-a, type-b)` allowlist is ignored** — bare `Agent` grants any type. The allowlist only works when the file runs as main thread with `claude --agent`. Restrict children with `permissions.deny: ["Agent(x)"]` in settings. | orchestrators | leaf agents (a reviewer that should stay read-only must omit `Agent`) |
| `Skill` | invokes a skill inline | agents that benefit from a documented workflow | the workflow fits in the body |
| `SendMessage` | messages another agent by ID/name; resumes a finished sub-agent | orchestrators steering children; agent-team teammates | leaf agents |
| `TaskStop` | stops a running task | orchestrators | leaf agents |

## Web

| Tool | Grant when | Withhold when |
| --- | --- | --- |
| `WebSearch` | researchers needing current docs / advisories | code-only agents; security auditors unless they must fetch advisories |
| `WebFetch` | pulling public docs, specs, READMEs | authenticated APIs (no auth support) |

## Task and schedule tools

`TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskStop`, `CronCreate`, `CronList`, `CronDelete` — in-session checklist and scheduling. **Removed from background sub-agents** (only `TaskStop` survives). Kept for agent-team teammates. Use `TodoWrite` (background-safe) for an in-run checklist. Cron entries do not persist across session resumes.

## Utility

`EnterWorktree` / `ExitWorktree` are redundant if `isolation: worktree` is set. `Artifact` is available in background.

## MCP

`mcp__<server>` or `mcp__<server>__*` in `tools` grants every tool from that server. Server-scoped `mcpServers` in frontmatter keeps a server's tool descriptions out of the main conversation. `ListMcpResourcesTool` / `ReadMcpResourceTool` are foreground-only.
