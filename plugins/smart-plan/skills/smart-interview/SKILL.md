---
name: smart-interview
description: Esta skill debe usarse cuando el usuario pregunta "¿Preguntas?", "¿Tienes dudas?", "¿Tienes preguntas?", "¿Quieres aclarar algo?", "¿Necesitas aclarar algo?", "aclara lo que necesites", o cuando quiere aterrizar requerimientos antes de planear. Tambien la invoca plan-feature en Phase 3. Ejecuta entrevista estructurada para obtener requerimientos cuantificables, reglas de negocio traducibles a codigo, y flujos del sistema; luego anota los resultados en el plan.
---

# Smart Interview

Conduct a structured interview to elicit quantifiable requirements, business rules, and system flows that translate directly into programmable logic. The output is a filled Requirements section ready to embed in an implementation plan.

---

## Step 1: Gap Identification

Review all available context:

- Original feature or task request
- Codebase exploration findings (if available in context)
- Any requirements or constraints already stated by the user

Identify every dimension that is NOT explicitly specified:

- Functional requirements and acceptance criteria (measurable outcomes)
- Business rules (conditions, constraints, validation logic, authorization)
- User/system flows (entry points, decision branches, error paths, exit states)
- Configuration requirements and sensible defaults
- Performance constraints (timeouts, rate limits, retry limits, size limits)
- Edge cases and error scenarios
- Integration points with existing features or external systems
- Data formats, validation rules, and schema constraints

---

## Step 2: Structured Interview Rounds

Group gaps into related batches by domain or concern. For each batch:

- Use **AskUserQuestion** with **max 5 questions per call**
- Prioritize by impact: functional requirements first, then business rules, then edge cases

**For vague answers** ("lo que tú creas", "como prefieras", "lo que mejor te parezca"):

1. Provide your specific recommendation with concrete reasoning
2. Use **AskUserQuestion** to ask for explicit confirmation before moving on

Repeat rounds until ALL identified gaps are resolved. Do not advance to Step 3 until every question has a concrete, unambiguous answer.

---

## Step 3: Consolidation and Confirmation

Organize all answers into exactly 3 categories:

**Functional Requirements**: measurable, testable outcomes

- Example: "The endpoint must respond in under 300ms for p95"
- Example: "Users can upload a maximum of 10 files per request"

**Business Rules**: conditions and constraints that drive conditional logic

- Example: "If a user has role 'viewer', they cannot modify records"
- Example: "Orders over $1000 require manager approval before processing"

**User/System Flows**: ordered sequences with explicit branches and error paths

- Example: "User submits form → validate input → if valid, create record and return 201; if invalid, return 422 with field errors"

Present the full consolidated list to the user in a clear, structured format. Then use **AskUserQuestion** to confirm:

- Is every requirement captured correctly?
- Is anything missing or misunderstood?
- Are all flows complete end-to-end?

Apply any corrections the user requests and re-confirm before proceeding.

---

## Step 4: Handle Results Based on Planning Context

Read the 3 template blocks from `references/` relative to this skill's directory:
`requirements-block.md`, `business-rules-block.md`, `flows-block.md`.
Fill each block with the confirmed interview results.

Assess the current planning context and act accordingly:

### Currently in plan mode (EnterPlanMode was already called)

Write the filled Requirements section directly into the plan under `## Requirements`.

### About to enter plan mode (plan mode is intended but not yet active)

Signals: this skill was invoked from plan-feature (phase tracking tasks are visible in context), or the session is clearly a feature planning session heading toward a plan.

Keep the filled blocks structured in context and output them clearly. Signal explicitly:
> "These requirements must be incorporated into the `## Requirements` section when writing the plan."

The plan-feature orchestrator will pick them up when writing the plan in Phase 5.

### No plan mode intended (standalone clarification, exploratory conversation)

No annotation is needed. Internalize the requirements, rules, and flows so they inform any implementation or guidance that follows in this session.

---

## Quality Criteria for Requirements

Before finishing, verify each item meets the bar:

- **Functional requirements**: Has a concrete, testable acceptance criterion — not "it should be fast" but "p95 latency < 300ms"
- **Business rules**: Expressed as condition → action/constraint pairs that a developer can directly translate into an `if` statement or validation rule
- **Flows**: Every branch is accounted for; every error path has an explicit outcome; no ambiguous "and then something happens" steps
