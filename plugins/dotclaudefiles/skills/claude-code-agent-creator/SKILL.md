---
name: claude-code-agent-creator
description: Crea archivos markdown de sub-agentes de Claude Code (con YAML frontmatter y system prompt) listos para colocar en ~/.claude/agents/, .claude/agents/ o agents/ de un plugin. Usa esta skill proactivamente cuando el usuario diga "crea un agente", "create an agent", "necesito un sub-agente que...", "scaffold an agent", "haz un auditor", "make a code reviewer agent", "agente que revise", "agente que audite", "agente que investigue", o cuando describa funcionalidad especializada que conviene aislar en un sub-agente (ej. "necesito algo que revise PRs", "quiero un agente que analice seguridad"). Cubre seleccion de tools con principio de menor privilegio, tuning de description para auto-invocacion, eleccion de arquetipo (auditor / researcher / implementer / orchestrator), calibracion de modelo + effort segun la carga de razonamiento de la tarea (mas mecanico = modelo mas ligero y menos effort) e incluye un sistema de scoring de confianza 0-100 con umbral >=80 para agentes tipo auditor.
---

# Claude Code Agent Creator

This skill produces a single markdown file that IS the full definition of a Claude Code sub-agent: YAML frontmatter (configuration) plus a markdown body (the system prompt). The file goes in one of these locations depending on its scope:

- `~/.claude/agents/<name>.md` — user-level, available across every project
- `.claude/agents/<name>.md` — project-level, version-controllable with the repo
- `plugins/<plugin>/agents/<name>.md` — distributed via a plugin

A sub-agent runs in its own isolated context window, with its own model, tool allowlist, and system prompt. The file you generate IS the agent — no extra wiring required.

## When to invoke this skill

Trigger on any of these signals:
- "Create an agent that...", "I need a sub-agent for..."
- "Make me an auditor / reviewer / researcher / implementer"
- "Scaffold an agent with these tools..."
- "I want something that reviews X / audits Y / investigates Z"

If the user describes work worth delegating to a specialized worker with an isolated context, that is an agent. If they describe a reusable inline workflow that should run in the main conversation, that is a skill — redirect them to skill creation instead.

## Process

Walk through these steps in order. Do not skip clarification: a poorly tuned frontmatter produces an agent Claude never invokes.

### 1. Clarify intent

Ask only what you cannot infer from the user's message. Use `AskUserQuestion`. Minimum information you need before writing:

- **Scope**: user-level, project-level, or inside a plugin
- **Archetype**: auditor / researcher / implementer / orchestrator (see step 2)
- **Trigger**: when should Claude invoke it automatically? (concrete phrases)
- **Thinking load** (only if the user has a preference): which model tier (`haiku` / `sonnet` / `opus` / `inherit`) and effort level. If unstated, derive it from the archetype and task in step 4.

If the user's initial message already covers all of this, do not ask — proceed.

### 2. Pick the archetype

The archetype drives tool selection and the structure of the system prompt. Full details in `references/patterns.md`. Quick map:

| Archetype     | Default tools                                          | When to use                                                                  |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Auditor       | `Read, Grep, Glob, Bash` (read-only)                   | Code review, security audit, quality check. Output uses confidence scoring   |
| Researcher    | `Read, Grep, Glob, Bash, WebSearch, WebFetch`          | Exploration, dependency analysis, codebase Q&A                               |
| Implementer   | `Read, Edit, Write, Bash, Grep, Glob`                  | Tasks where edits are expected (refactors, test generation, bug fixes)       |
| Orchestrator  | `Read, Grep, Agent(specific-types)`                    | Coordinates other agents — restrict `Agent` to concrete subtypes             |

If the agent navigates code by symbols (jump to definition, find references, type info), add `LSP` — it beats `Grep` for symbol-level queries.

### 3. Select tools (least privilege)

List ONLY the tools the agent actually needs. Omitting `tools` inherits everything from the parent, which is rarely what you want.

Key rules (full reference in `references/tools.md`):

- **Read-only agents** (auditors, researchers): NEVER include `Write`, `Edit`, `NotebookEdit`
- **Symbol-level code navigation**: include `LSP`, prefer it over `Grep` for identifiers
- **Delegation to other agents**: `Agent(child-name)` with explicit allowlist; standard sub-agents cannot nest further sub-agents
- **Dynamic loading of deferred tools** (large MCP setups): include `ToolSearch`
- **Shell commands**: only include `Bash` if the agent really needs it; a pure auditor often gets by with `Read + Grep`

### 4. Calibrate the thinking load (model + effort)

`model` and `effort` together decide how much reasoning capacity the agent pays for on every turn. This is the biggest lever on its cost and latency, so tune it deliberately — do not default everything to the heaviest pairing. Full reference in `references/thinking-load.md`.

The principle: the more **mechanical and deterministic** (and smaller) the task, the lighter the model and the lower the effort; the more **open-ended, ambiguous, or long-horizon**, the heavier the model and the higher the effort.

- **Prefer the bare alias** `haiku` / `sonnet` / `opus` over a pinned model ID — it auto-resolves to the latest model in that tier, so the agent improves with zero maintenance. Pin a full ID only when you need version reproducibility.
- **Default pairing by archetype**: researcher → `haiku` (no effort); implementer → `sonnet` + `medium`; auditor → `sonnet` + `high` (or `opus` + `max` when a miss is unacceptable); orchestrator → `opus` + `high`/`xhigh`.
- **Effort support is not uniform** — set it only where it is honored:
  - `haiku` has **no** effort dial — omit `effort` entirely.
  - `sonnet` supports the full ladder, but past `high` (`xhigh`, `max`) it is generally not recommended (see cost crossover below).
  - `opus` supports the full ladder, including `xhigh`.
- **Cost crossover**: high effort on a cheaper model can cost more per task than the superior model — at that level the cheaper model iterates more (more turns, more output) and the volume overtakes the rate. On Sonnet, `max` is not a cheap shortcut to Opus: escalate the model before escalating the effort.

An unsupported effort level is silently ignored, not an error — so a wrong pairing fails quietly. When in doubt, consult the matrix in `references/thinking-load.md`.

### 5. Write a description that triggers correctly

`description` (plus optional `when_to_use`) is the only field Claude reads when deciding whether to auto-invoke the agent. Combined cap: 1,536 characters.

Patterns that work:
- Lead with the role: "Expert code reviewer specialized in..."
- Include "Use proactively when..." or "Use immediately after..." for eager invocation
- List concrete trigger phrases: "Use when reviewing PRs, after git commits, when analyzing security"
- If the user often phrases requests indirectly, include those exact phrases

Weak patterns to avoid:
- "Helper agent", "Utility for X", "General-purpose tool"
- Descriptions that only state WHAT the agent does but not WHEN to use it

### 6. Compose the system prompt (markdown body)

The body of the file IS the agent's system prompt. Recommended structure:

1. **Identity** — who the agent is, what it specializes in
2. **When invoked** — first action when activated (e.g., "Run git diff to find changes")
3. **Method / checklist** — the work, step by step
4. **Output format** — exactly what to return to the caller

If the archetype is **auditor**, append the Confidence Scoring block from `references/confidence-system.md` verbatim. This prevents false-positive noise and forces concrete, actionable findings.

### 7. Validate and deliver

Before writing the file, check:

- `name` is kebab-case and unique within its scope
- `description` is specific, with explicit trigger phrases
- `tools` is declared explicitly (not omitted unless intentional)
- Read-only agents have no write tools
- `model` uses a bare alias (`haiku` / `sonnet` / `opus`) unless a pinned ID is intentional, and the `model` + `effort` pairing is sensible (no `effort` on `haiku`; avoid `xhigh`/`max` on `sonnet` when the task justifies `opus`)
- Auditors include the Confidence Scoring section

By default, write the file directly to the chosen location with the `Write` tool. If the user wants to review first, present the contents as a code block and clearly state the destination path.

## Output: file structure

```markdown
---
name: <kebab-case-name>
description: <triggering description — "Use proactively when...">
tools: <comma-separated list>
model: <haiku|sonnet|opus|inherit>   # optional — bare alias auto-resolves to the latest in that tier
effort: <low|medium|high|xhigh|max>   # optional — honored only by models that support it (none on haiku; past high on sonnet not recommended)
color: <red|blue|green|yellow|purple|orange|pink|cyan>   # optional
---

# <Agent role>

<Identity paragraph: who you are, what you specialize in>

## When invoked
1. <First action>
2. <Second action>

## Method
<Checklist or detailed process>

## Output format
<Exact structure to return>
```

For auditors, append the Confidence Scoring section at the end (copy verbatim from `references/confidence-system.md`).

## Reference files

Read these when you need to drill into a specific area:

- `references/frontmatter-spec.md` — Every YAML field, valid values, defaults, plugin restrictions
- `references/tools.md` — Full tools table with when-to-use / when-NOT-to-use guidance
- `references/thinking-load.md` — Choosing model + effort: tiers, the effort support matrix, and a task → (model, effort) decision matrix
- `references/patterns.md` — Archetype templates (auditor, researcher, implementer, orchestrator)
- `references/confidence-system.md` — 0-100 confidence scoring system with >=80 threshold for auditors

## Golden rules (do not violate)

1. **Description is everything**: a vague description = an agent Claude never invokes. Spend time on it.
2. **Least privilege**: list tools explicitly. If you're unsure a tool is needed, leave it out.
3. **Calibrate thinking load**: match `model` + `effort` to the task's determinism and scope — mechanical/small gets a light model and low effort; open-ended/long-horizon gets a heavy model and high effort. Never default everything to `opus` + `max`. Prefer bare model aliases, and respect the effort support matrix (no `effort` on `haiku`; past `high` on `sonnet` supported but not recommended). Remember the cost crossover: high effort on a cheap model can cost more per task than the superior model — escalate the model before the effort.
4. **Auditor without scoring = noise**: if it's an auditor, the 0-100 confidence system with >=80 threshold is mandatory.
5. **Sub-agents do not nest**: a standard sub-agent cannot invoke another sub-agent. If you need sustained orchestration, use agent teams or coordinate from the main conversation.
6. **Plugin restrictions**: inside plugins, `hooks`, `mcpServers`, and `permissionMode` are NOT supported. If the agent needs them, it must live in `.claude/agents/` or `~/.claude/agents/`.
