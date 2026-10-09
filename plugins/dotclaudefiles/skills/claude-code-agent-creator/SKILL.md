---
name: claude-code-agent-creator
description: Crea o actualiza sub-agentes de Claude Code (frontmatter YAML + system prompt) para ~/.claude/agents/, .claude/agents/ o agents/ de un plugin. Usar proactivamente cuando el usuario diga "crea un agente", "create an agent", "scaffold an agent", "haz un auditor / reviewer / researcher", describa trabajo que conviene aislar en su propio contexto, o pida actualizar, revisar o recalibrar model / effort de un agente existente o de todos los del proyecto ("actualiza el agente", "update this agent", "actualiza todos los agentes"), tambien tras salir un modelo nuevo. Decide tools de menor privilegio, model + effort segun carga y billing, y confidence scoring para auditores.
argument-hint: "[--update <path-to-agent.md> | --update-all]"
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

Mechanical and small → light model, low effort; open-ended and long-horizon → heavy model, higher effort. Prices, benchmarks, effort semantics and subscription rules are in `references/thinking-load.md`. Escalate one notch at a time. Past `high` on Haiku and Sonnet, change the model; Opus may take `xhigh` after a measured miss, then `fable`; `max` never pays for a sub-agent.

| Archetype | Pairing | Escalate to |
| --- | --- | --- |
| Researcher | `haiku` + `medium` | `haiku` + `high` when the answer needs synthesis; `sonnet` + `medium` only past that |
| Implementer | `sonnet` + `medium` | `sonnet` + `high` for multi-file; `opus` + `medium` for architectural changes. `low` is not an implementer setting: it skips verification |
| Auditor | `sonnet` + `high` | `opus` + `medium`/`high` when a miss is unacceptable (security, compliance) or the diff is cross-cutting |
| Orchestrator | `opus` + `high` | `opus` + `xhigh` after a measured miss; `fable` + `high` when the scope is broad, complex and critical at once, on API or Max |

The rule that bites: on a Pro subscription never put `fable` in a sub-agent; it stalls on a credits prompt or falls back.

Cross-session knowledge: set `memory:` (semantics in `references/frontmatter-spec.md`); never hand-roll a notes file.

### 5. Write a description that triggers, and stays short

`description` is the only field Claude reads to decide on delegation, and every agent's description is in context on every turn, under a combined budget of 15,000 tokens. Lead with the role, add "Use proactively when..." / "Use immediately after...", list 3-6 exact phrases the user actually says. Method and checklists go in the body, which loads only when the agent runs.

### 6. Compose the body

Follow the file structure below. The agent cannot ask the user anything, so the body must say what to do on ambiguity: state it in the result and stop. For auditors, append the Confidence Scoring block from `references/confidence-system.md` verbatim.

### 7. Validate and deliver

Run the checklist at the end of `references/frontmatter-spec.md`, then write the file. Claude Code watches `~/.claude/agents/` and `.claude/agents/`, so edits apply within seconds, except the first file in a brand-new `agents/` directory, which needs a restart.

## Update mode: `--update <path>` and `--update-all`

Arguments: $ARGUMENTS

Invoked as `--update <path-to-agent.md>`, or when the user asks to update, review or recalibrate an existing agent. `--update-all` runs the same audit over every `*.md` under the project's `.claude/agents/` (recursive; files without `name` are documentation and are skipped): one table per agent, all tables printed before any write, then the same gate per agent. Agents that pass are listed as current in one line each. Ask the billing mode once, up front, when any agent in the batch names `fable`. With no path, Glob the three scopes in the table above for the agent named and ask only if more than one file matches; a path that does not exist or has no `name` in its frontmatter is reported and stops the run. The file answers scope, trigger and archetype (infer the archetype from `tools` and the body; if it fits none, say so and skip the pairing check); billing mode it cannot answer, so ask for it only when a `fable` decision depends on it.

Re-run steps 3 to 7 as an audit against the current references, plus three checks the numbered steps do not carry:

- an `Agent(a, b)` allowlist, which is ignored inside a sub-agent (`references/tools.md`);
- a pinned model ID older than the Current model column in `references/thinking-load.md`;
- `effort` missing on `fable`, or on an implementer whose inherited default would fall below `medium`.

Print a table (field, before, after, reason) before touching the file. Write immediately when every row changes a frontmatter field other than `model` or `tools`; wait for a yes when a row changes `model`, `tools` or the body. Do not rewrite prose that still holds; an agent that passes every check is left untouched and reported as current.

## Output: file structure

```markdown
---
name: <kebab-case>
description: <role + "Use proactively when..." + 3-6 trigger phrases. Keep it short.>
tools: <explicit comma-separated list>
model: <haiku|sonnet|opus|fable|inherit>   # bare alias; pin a full ID only for reproducibility
effort: <low|medium|high|xhigh|max>        # omit to inherit the session level (the model's default, medium on haiku/sonnet/opus, unless changed)
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
- `references/thinking-load.md`: tiers, prices, effort semantics, escalation ladder, subscription rules
- `references/cost-intelligence-research.md`: the dated data and sources behind `thinking-load.md`, including when Fable earns its price
- `references/patterns.md`: archetype templates
- `references/confidence-system.md`: 0-100 scoring, >= 80 threshold
