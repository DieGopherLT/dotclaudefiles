---
name: plan-feature
description: Esta skill debe usarse cuando el usuario pide "planear una feature", "plan a feature", "crear un plan de acción", "disenar una implementacion", "design an implementation", "crear un plan de desarrollo", "create a development plan", "quiero planear", "quiero hacer un plan", "quiero disenar", o cuando solicite un feature cuya complejidad lo requiera. Ejecuta workflow de 5 fases: discovery, exploracion del codebase, clarificacion, arquitectura, y escritura del plan. Al aprobar el plan, invoca smart-delegation automaticamente para ejecutar la implementacion.
---

# Plan Feature - 5-Phase Planning Workflow

Operate as the **Smart Plan orchestrator**. Orchestrate the planning of a feature through 5 structured phases, delegating work to specialized agents and coordinating their outputs. The final output is a self-contained implementation plan approved by the user.

**Feature request:** $ARGUMENTS

---

## Phase 1: Discovery

**Goal**: Understand the feature request and establish tracking.

1. Create tasks (TaskCreate) for all 5 phases:
   - Phase 1: Discovery
   - Phase 2: Codebase Exploration
   - Phase 3: Smart Interview
   - Phase 4: Architecture Design
   - Phase 5: Plan Mode
2. Set up task dependencies: each phase is blocked by the previous one
3. Mark Phase 1 as in_progress
4. Summarize your understanding of the feature to the user and confirm it is correct
5. Mark Phase 1 as completed

---

## Phase 2: Codebase Exploration

**Goal**: Build a comprehensive understanding of the codebase relevant to this feature.

1. Mark Phase 2 as in_progress
2. Launch **3 agents in parallel** using the Task tool:

   **Agent 1 - code-explorer (textual, broad)**:

   ```
   Explore the codebase to understand architecture, patterns, and features similar to: <actual feature request from $ARGUMENTS>.
   Focus on: project structure, naming conventions, error handling, testing patterns, configuration.
   Do NOT produce a formatted report. Only list the file paths you identified as essential and a one-line note per file explaining its relevance.
   ```

   **Agent 2 - code-explorer (textual, feature-focused)**:

   ```
   Find and trace complete execution flows of features most similar to: <actual feature request from $ARGUMENTS>.
   For each similar feature, trace from entry point through all layers to data storage/external calls.
   Do NOT produce a formatted report. Only list every file path involved and which layer it belongs to.
   ```

   **Agent 3 - code-indexer (semantic/LSP)**:

   ```
   Build a semantic index of the codebase areas most relevant to: <actual feature request from $ARGUMENTS>.
   Focus on: type dependencies, interface contracts, call hierarchy, shared symbols.
   Do NOT produce a formatted report. Only list file paths, key symbols, and type relationships discovered.
   ```

3. After all 3 agents complete, **read all essential files they identified** (Read tool) to have them in your own context
4. Consolidate findings internally. Present a brief summary to the user (key files, patterns detected, similar features found)
5. Mark Phase 2 as completed

---

## Phase 3: Smart Interview

**Goal**: Elicit quantifiable requirements, business rules, and flows before designing architecture.

1. Mark Phase 3 as in_progress
2. Invoke the **Skill tool** with `smart-plan:smart-interview`
   - The skill will identify gaps, conduct structured interview rounds, and consolidate confirmed results
   - The results will be structured and ready for the `## Requirements` section of the plan
3. Mark Phase 3 as completed

---

## Phase 4: Architecture Design

**Goal**: Design the implementation approach with multiple perspectives.

1. Mark Phase 4 as in_progress
2. Launch **2-3 code-architect agents in parallel**, each with a different approach:

   **Architect 1 - Minimal Changes**:

   ```
   Design the architecture for: <actual feature request from $ARGUMENTS>
   Approach: MINIMAL CHANGES - maximum reuse of existing code, minimum new files.

   Context from exploration:
   <insert consolidated findings from Phase 2>

   Decisions made:
   <insert all decisions documented in Phase 3>

   Produce the full Architecture Blueprint as specified in your instructions.
   ```

   **Architect 2 - Clean Architecture**:

   ```
   Design the architecture for: <actual feature request from $ARGUMENTS>
   Approach: CLEAN ARCHITECTURE - proper separation of concerns, new abstractions where they add value.

   Context from exploration:
   <insert consolidated findings from Phase 2>

   Decisions made:
   <insert all decisions documented in Phase 3>

   Produce the full Architecture Blueprint as specified in your instructions.
   ```

   **Architect 3 - Pragmatic Balance** (optional, use when the feature spans 3+ new files or introduces a new architectural layer):

   ```
   Design the architecture for: <actual feature request from $ARGUMENTS>
   Approach: PRAGMATIC BALANCE - reuse where sensible, abstract where it adds clear value.

   Context from exploration:
   <insert consolidated findings from Phase 2>

   Decisions made:
   <insert all decisions documented in Phase 3>

   Produce the full Architecture Blueprint as specified in your instructions.
   ```

3. Review all architecture proposals
4. Form your own recommendation with reasoning
5. Present all approaches to the user with your recommendation highlighted
6. Use **AskUserQuestion** to let the user choose the approach
7. Mark Phase 4 as completed

---

## Phase 5: Plan Mode

**Goal**: Write a comprehensive, self-contained implementation plan using the plan template.

1. Mark Phase 5 as in_progress
2. Invoke the **Skill tool** with `smart-plan:smart-delegation` — it will provide delegation guidelines to embed in the plan (task grouping, parallelization, model recommendations)
3. Resolve branch context for every repository involved in the plan:
   - If the initial prompt specified the repository/repositories and base branch(es): use them directly
   - If not: use **AskUserQuestion** to ask for each repository: which base branch to use, and confirm the `feat/<name>` branch name
4. Read the plan template from `references/plan-template.md` (relative to this skill's directory) for structure guidance
5. Call **EnterPlanMode** directly (do NOT launch a Plan sub-agent; operate as the planner directly)
6. Write the plan using the template structure as a base:
   - Fill `## Repository Context` with the resolved branch information
   - Incorporate the delegation guidelines from step 2
   - Fill the `## Requirements` section with the requirements, rules, and flows produced by Phase 3 (smart-interview)
7. Ensure the plan is fully self-contained: anyone reading it must be able to execute it without additional context
8. Call **ExitPlanMode** to request user approval
9. If the user requests changes, modify the plan and re-submit
10. Mark Phase 5 as completed after approval

---

## Orchestration Rules

- **Always track progress**: Update tasks (TaskUpdate) as you start and complete each phase
- **Never skip phases**: Even if a phase seems unnecessary, execute it (it may reveal something)
- **Respect dependencies**: Do not start a phase until the previous one is completed
- **Consolidate agent outputs**: After agents return, synthesize their findings before presenting to user
- **User approval at key points**: Phases 1 (understanding), 4 (architecture choice), 5 (plan approval)
- **Plan completeness**: The plan must be self-contained with all instructions needed for execution
- **Fail gracefully**: If an agent fails or returns poor results, inform user and offer to retry or adjust
- **Be transparent**: Show the user what is happening at each phase; do not work silently
