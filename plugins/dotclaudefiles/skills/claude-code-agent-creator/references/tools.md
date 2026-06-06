# Tools Reference

This is the full catalog of tools a Claude Code sub-agent may declare in its `tools` field. Each entry lists what the tool does, when it shines, and when to leave it out — applying the principle of least privilege.

## Quick presets by archetype

Start from these defaults, then add or remove based on actual need:

| Archetype     | Recommended tools                                              |
| ------------- | -------------------------------------------------------------- |
| Auditor       | `Read, Grep, Glob, Bash`                                       |
| Researcher    | `Read, Grep, Glob, Bash, WebSearch, WebFetch, LSP`             |
| Implementer   | `Read, Edit, Write, Bash, Grep, Glob, LSP`                     |
| Orchestrator  | `Read, Grep, Glob, Agent(child-1, child-2)`                    |

If you need deferred tool loading from a large MCP environment, add `ToolSearch` to any of the above.

## File operations

| Tool           | What it does                                                            | Use when                                                                | Avoid when                                                                              |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Read`         | Reads file contents; supports `offset`/`limit` for partial reads.       | Always include — fundamental for any agent that touches the codebase.   | Never. Even pure shell agents benefit.                                                  |
| `Write`        | Creates or fully overwrites a file.                                     | Implementers that produce new files (tests, configs, generated code).   | Read-only agents (auditors, researchers). Never give a reviewer the ability to write.   |
| `Edit`         | Targeted in-place replacements inside an existing file.                 | Implementers, refactorers — surgical edits without rewriting the file.  | Read-only agents.                                                                       |
| `Glob`         | File discovery by glob pattern (`src/**/*.ts`).                         | Finding all files of a type before processing them in batch.            | Single known path — read it directly.                                                   |
| `Grep`         | Content search via regex.                                               | Pattern hunts, debugging, finding string occurrences.                   | Symbol-level lookups in code — `LSP` is more precise (no false matches in comments).    |
| `NotebookEdit` | Jupyter notebook cell edits.                                            | Agents that operate on `.ipynb` files.                                  | Anything else.                                                                          |

## Execution

| Tool         | What it does                                                                       | Use when                                                                  | Avoid when                                                                       |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Bash`       | Runs shell commands. Working dir resets to project root after each call.           | Running tests, builds, git, linters, anything CLI-based.                  | Agents that only need to read text — Bash adds attack surface unnecessarily.     |
| `PowerShell` | Native PowerShell execution (opt-in on Linux/macOS).                               | Windows-specific tasks or PowerShell-only tooling.                        | If Bash works for the task, prefer it.                                           |
| `Monitor`    | Streams a long-running command's stdout to the agent line by line.                 | Tailing logs, polling CI, watching file changes during dev runs.          | Short-lived commands (use Bash). High overhead. Not available on Bedrock/Vertex. |

## Code intelligence

| Tool         | What it does                                                                                              | Use when                                                                                            | Avoid when                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `LSP`        | Language Server Protocol bridge: jump-to-definition, find-references, hover types, diagnostics. Auto-reports errors after edits. | Symbol-level navigation, type checking, refactoring across files.                                   | Documentation-only or shell-only agents.                                    |
| `ToolSearch` | Looks up and loads schemas of deferred tools so the agent can call them. Supports `select:Name1,Name2` for direct fetch or keyword search like `+slack send`. | Environments where MCP exposes too many tools to load eagerly. The agent searches for what it needs, then calls. | Small fixed tool sets — adds an unnecessary lookup step.                    |

**Critical rule**: when the task involves identifying a symbol, function, or type, prefer `LSP` over `Grep`. Grep matches text in comments and strings; LSP returns only real symbol references.

## Agent control

| Tool      | What it does                                                                                | Use when                                                                            | Avoid when                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Agent`   | Spawns a sub-agent. Format `Agent(subtype-1, subtype-2)` to allowlist specific child types. | Orchestrators that delegate well-bounded sub-tasks to specialized workers.          | Most leaf agents. Sub-agents cannot themselves spawn sub-agents in standard config — granting `Agent` is a no-op. |
| `Skill`   | Invokes a skill (a reusable prompt-based workflow) inside the agent's conversation.         | Agents that benefit from a documented workflow (e.g., "use the format-pr skill").   | When you can describe the workflow inline more cheaply.                                                          |

## Search and web

| Tool         | What it does                                  | Use when                                                              | Avoid when                                                                            |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `WebSearch`  | Issues web search queries.                    | Researchers that need current documentation or third-party info.      | Code-only agents. Adds latency and external surface.                                  |
| `WebFetch`   | Fetches a specific URL and returns content.   | Pulling docs, API references, OpenAPI specs from public URLs.         | Authenticated APIs (no auth support). Internal-only researchers where Bash + curl works better. |

## Task management

| Tool                                                          | What it does                                                  | Use when                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`, `TaskStop` | In-session task list (a checklist Claude maintains).          | Multi-step workers that benefit from progress tracking inside their run.  |
| `CronCreate`, `CronList`, `CronDelete`                        | Schedules recurring or one-shot prompts within the session.   | Session-scoped automation — does NOT persist across session resumes.      |

## Utility

| Tool                              | What it does                                                                  | Use when                                                          | Avoid when                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `AskUserQuestion`                 | Presents a multiple-choice question to the user.                              | Foreground agents that need clarification before committing.      | **Background agents** — fails silently with no error.                        |
| `EnterPlanMode` / `ExitPlanMode`  | Toggles plan mode (no edits, design only).                                    | Agents that should always design before executing.                | Most agents — plan mode is usually controlled at session level.              |
| `EnterWorktree` / `ExitWorktree`  | Creates and switches to a temporary git worktree.                             | Implementers that need isolation from the main checkout.          | If the agent has `isolation: worktree` in frontmatter, it's already covered. |

## MCP-related

| Tool                     | What it does                                                            | Use when                                                              |
| ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ListMcpResourcesTool`   | Lists resources exposed by connected MCP servers.                       | Discovering what an MCP server provides before reading.               |
| `ReadMcpResourceTool`    | Reads a specific MCP resource by URI.                                   | Pulling structured data from an MCP integration.                      |

## Tools NOT to grant unless you really mean it

| Tool                  | Why caution                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Bash` to auditors    | A reviewer rarely needs shell access. If it only needs `git diff`, consider whether `Read` + a pre-collected diff works.  |
| `Write` to anyone but implementers | Auditors, researchers, and orchestrators should not write files. They should report, and let the user (or another agent) act. |
| `WebFetch` / `WebSearch` to security auditors | External calls broaden the threat model. Only grant if the audit explicitly needs upstream advisories.                  |
| `Agent` without specific subtypes | `Agent` alone allows the orchestrator to spawn anything available. Always use `Agent(specific-child-1, specific-child-2)`. |

## Selection workflow

When picking the tool list for a new agent, work through this checklist:

1. **Read** — yes, always.
2. Does the agent **modify files**? → add `Edit` and/or `Write` (and only then).
3. Does the agent **navigate by symbol**? → add `LSP`. (Add `Grep` for text-level fallback.)
4. Does the agent **discover files by pattern**? → add `Glob`.
5. Does the agent **run commands**? → add `Bash`. Otherwise leave it out.
6. Does the agent **need external info**? → add `WebSearch` and/or `WebFetch`.
7. Does the agent **delegate to other agents**? → add `Agent(specific-children)`.
8. Does the agent **operate in a tool-heavy MCP environment**? → add `ToolSearch`.
9. Default to NO for everything else.

Each tool you add is a capability you'll have to trust. Each one you leave out is one less thing that can go wrong.
