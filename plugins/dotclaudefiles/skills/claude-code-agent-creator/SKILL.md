---
name: claude-code-agent-creator
description: Crea archivos markdown de sub-agentes de Claude Code (YAML frontmatter + system prompt) listos para ~/.claude/agents/, .claude/agents/ o agents/ de un plugin. Usa esta skill proactivamente cuando el usuario diga "crea un agente", "create an agent", "necesito un sub-agente que...", "scaffold an agent", "haz un auditor / reviewer / researcher", "agente que revise / audite / investigue", o describa trabajo especializado que conviene aislar en un contexto propio (ej. "algo que revise PRs", "un agente que analice seguridad"). Cubre tools de menor privilegio, description, arquetipo, model + effort segun carga y billing (API / Pro / Max), y confidence scoring para auditores.
---

# Claude Code Agent Creator

Produces one markdown file that IS a Claude Code sub-agent: YAML frontmatter (configuration) plus a markdown body (system prompt). Location decides scope:

| Location | Scope | Notes |
| --- | --- | --- |
| `~/.claude/agents/<name>.md` | every project on this machine | |
| `.claude/agents/<name>.md` | this project, version-controllable | discovered walking up from cwd |
| `plugins/<plugin>/agents/<name>.md` | wherever the plugin is enabled | `hooks`, `mcpServers`, `permissionMode` are stripped |

The sub-agent does not see the parent conversation, output style or auto memory; it does receive the CLAUDE.md hierarchy and a git-status snapshot. If the work is a reusable inline workflow for the main conversation rather than isolated work that returns a summary, it is a skill, not an agent.

## Process

### 1. Clarify only what you cannot infer

Ask once (`AskUserQuestion` works here, in the main conversation) for:

- **Scope**: user / project / plugin
- **Archetype**: auditor / researcher / implementer / orchestrator
- **Trigger**: concrete phrases that should auto-invoke it
- **Billing mode**: API pay-per-token, or subscription (Pro / Max). It decides whether `fable` is even viable.

### 2. Pick the archetype

Templates in `references/patterns.md`. Prefer one archetype; split when the tool sets conflict (read-only vs write) and orchestrate.

| Archetype | Default tools | Use for |
| --- | --- | --- |
| Auditor | `Read, Grep, Glob, Bash` | review, security / quality audit. Output uses confidence scoring |
| Researcher | `Read, Grep, Glob, Bash, WebSearch, WebFetch` | exploration, dependency analysis, codebase Q&A |
| Implementer | `Read, Edit, Write, Bash, Grep, Glob` | refactors, test generation, bug fixes |
| Orchestrator | `Read, Grep, Glob, Agent` | fans out to other agents and synthesizes |

### 3. Select tools

List tools explicitly; omitting `tools` inherits everything. Write the list as if the agent will run in background, because in interactive sessions it will, and background strips several tools silently. Catalog, the two availability filters and the `Agent` allowlist gotcha are in `references/tools.md`.

### 4. Calibrate thinking load: `model` + `effort`

Mechanical and small → light model, low effort; open-ended and long-horizon → heavy model, high effort. Prices, benchmarks, effort semantics and subscription rules are in `references/thinking-load.md`.

| Archetype | Pairing | Escalate to |
| --- | --- | --- |
| Researcher | `haiku` (no effort) | `sonnet` + `low` if synthesis is needed |
| Implementer | `sonnet` + `medium` | `sonnet` + `high` for multi-file; `opus` + `high` for architectural changes |
| Auditor | `sonnet` + `high` | `opus` + `high`/`xhigh` when a miss is unacceptable (security, compliance) |
| Orchestrator | `opus` + `xhigh` | `fable` + `xhigh` only for multi-hour, long-horizon runs on API or Max |

The rule that bites: on a Pro subscription never put `fable` in a sub-agent; it stalls on a credits prompt or falls back.

Cross-session knowledge: set `memory:` (semantics in `references/frontmatter-spec.md`); never hand-roll a notes file.

### 5. Write a description that triggers, and stays short

`description` is the only field Claude reads to decide on delegation, and every agent's description is in context on every turn, under a combined budget of 15,000 tokens. Lead with the role, add "Use proactively when..." / "Use immediately after...", list 3-6 exact phrases the user actually says. Method and checklists go in the body, which loads only when the agent runs.

### 6. Compose the body

Follow the file structure below. The agent cannot ask the user anything, so the body must say what to do on ambiguity: state it in the result and stop. For auditors, append the Confidence Scoring block from `references/confidence-system.md` verbatim.

### 7. Validate and deliver

Run the checklist at the end of `references/frontmatter-spec.md`, then write the file. Claude Code watches `~/.claude/agents/` and `.claude/agents/`, so edits apply within seconds, except the first file in a brand-new `agents/` directory, which needs a restart.

## Output: file structure

```markdown
---
name: <kebab-case>
description: <role + "Use proactively when..." + 3-6 trigger phrases. Keep it short.>
tools: <explicit comma-separated list>
model: <haiku|sonnet|opus|fable|inherit>   # bare alias; pin a full ID only for reproducibility
effort: <low|medium|high|xhigh|max>        # omit to inherit the session level (high unless changed); never set on haiku
color: <red|blue|green|yellow|purple|orange|pink|cyan>   # optional
memory: <user|project|local>               # optional, only for cross-session knowledge
maxTurns: <int>                            # optional; output is marked partial and resumable at the cap
---

# <Role>

<Identity paragraph: role and specialty>

## When invoked
1. <first action, e.g. git diff>

## Method
<checklist>

## Output format
<exact structure to return to the caller>
```

## Reference files

- `references/frontmatter-spec.md`: every field, valid values, plugin restrictions, model resolution order, validation checklist
- `references/tools.md`: tool catalog with background/foreground availability
- `references/thinking-load.md`: tiers, prices, cost-per-task benchmarks, effort semantics, subscription rules
- `references/patterns.md`: archetype templates
- `references/confidence-system.md`: 0-100 scoring, >= 80 threshold
