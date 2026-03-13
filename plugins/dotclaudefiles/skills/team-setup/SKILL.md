---
name: team-setup
description: "Esta skill debe usarse cuando el usuario pide 'configura un team', 'prepara equipo de agentes', 'crea un team de agentes', 'setup del team', 'team de agentes para', 'orquesta agentes', 'team-setup', 'arma un equipo', 'necesito un team para', o cuando quiere coordinar multiples agentes trabajando en repos/directorios distintos. Genera el prompt estructurado para el TeamLead incluyendo roles, workspaces, contexto inicial y reglas universales del equipo. Detecta automaticamente si el objetivo es negociacion de contratos (endpoints, sockets, SSEs) y activa el flujo especializado de debate balanceado."
user-invocable: true
---

# Team Setup

Extract team configuration from context or user input, then generate a structured TeamLead prompt.

## Phase 1: Gather Configuration

Gather the following before generating the prompt. Extract from context first; use `AskUserQuestion` for anything missing.

### 1.1 Agents & Roles

For each agent on the team, collect:

- **Role name**: What this agent represents (e.g., "Frontend Engineer", "Backend Engineer", "QA")
- **Responsibilities**: What this agent is accountable for
- **Workspace path**: Absolute path to the repo/directory on the filesystem where this agent works

### 1.2 Initial Context

For each agent, determine what context to provide upfront:

- CLAUDE.md files in their workspace
- Relevant architecture docs, schemas, or specs
- Or instructions for where the agent should look to orient itself

### 1.3 Team Type

Detect the team's objective from context. Two main types:

- **General team**: Agents collaborate toward a common goal (code, infra, data, etc.)
- **Contract negotiation**: Frontend and backend agents negotiate an API/socket/SSE contract

If the objective involves defining endpoints, events, payloads, or communication protocols between a frontend and a backend, treat it as a contract negotiation and read [`references/contract-negotiation.md`](references/contract-negotiation.md) to include the specialized debate flow in the TeamLead prompt.

---

## Phase 2: Generate TeamLead Prompt

Build the TeamLead prompt with these sections:

### Section A: Team Overview

```
You are the TeamLead for a [general | contract negotiation] team.
Your job is to coordinate the following agents and drive them toward [objective].

## Agents

- [Role Name] — [Responsibilities]
  Workspace: [absolute path]
  Initial context: [CLAUDE.md path or "read CLAUDE.md and explore the repo structure"]

- [Role Name] — [Responsibilities]
  Workspace: [absolute path]
  Initial context: [...]
```

### Section B: Universal Team Rules

Always include this block verbatim:

```
## Team Rules (non-negotiable)

1. No agent may make file modifications or commits without explicit order from you (TeamLead)
   or from the user. If an agent believes it needs to write code, it must propose the change
   and wait for approval before touching the filesystem.

2. Task tracking: whenever an agent works on 3 or more files in a single task, it must use
   the Tasks tool to register and track progress. Single-file or two-file edits do not require
   task registration.

3. Agents are free to communicate with each other directly. However, any decision that affects
   scope, architecture, or implementation direction must be surfaced to you (TeamLead) before
   it is acted upon. You decide whether it also needs to go to the user.

4. Doubt escalation: when any agent has a question — about business rules, UX behavior,
   or anything outside its own domain — it may ask the user directly using AskUserQuestion,
   or route it through you if it requires team-level context or coordination. Either path
   is valid; use judgment based on the scope of the question.
```

### Section C: Objective & First Actions

Describe what the team should accomplish and list the first concrete actions the TeamLead should take:

- Orient each agent to its workspace
- Provide initial context
- Kick off the first round of work (or the contract negotiation debate)

---

## Phase 3: Output

Present the generated TeamLead prompt to the user in a code block so they can copy it directly.
Confirm it covers their intent and offer to adjust roles, paths, or objectives before they proceed.

Use [`references/teamlead-prompt-template.md`](references/teamlead-prompt-template.md) as the
structural template for the generated prompt. It defines the exact sections and ordering to follow.

---

## Resources

- **[`references/contract-negotiation.md`](references/contract-negotiation.md)** — Detailed rules and flow for the frontend/backend contract negotiation case. Load this when team type is contract negotiation.
- **[`references/teamlead-prompt-template.md`](references/teamlead-prompt-template.md)** — Full template for the generated TeamLead prompt. Always use this as the base for Phase 3 output.
