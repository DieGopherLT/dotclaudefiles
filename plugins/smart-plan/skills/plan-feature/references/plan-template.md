# Plan Template

Use this template as the base structure when writing the plan in Phase 5 (Plan Mode). Replace all `[placeholder]` sections with actual content derived from exploration and architecture design phases.

---

# Plan: [Feature Name]

## Feature Summary

[2-3 sentence description of what is being built, why, and the chosen architecture approach. Include the key trade-offs that led to choosing this approach over alternatives.]

## Architecture Approach

**Chosen approach**: [Minimal Changes | Clean Architecture | Pragmatic Balance]

**Rationale**: [Why this approach was selected. Key constraints or requirements that drove the decision.]

**Key decisions**:

- `<decision area>`: `<chosen option and reasoning>`
- `<decision area>`: `<chosen option and reasoning>`
- `<decision area>`: `<chosen option and reasoning>`

---

## Implementation Tasks

### Task Ownership Map

| File | Action | Owner Group | Depends On |
|------|--------|-------------|------------|
| `path/to/file.ts` | Create | Group A | - |
| `path/to/other.ts` | Modify | Group A | - |
| `path/to/consumer.ts` | Create | Group B | Group A |

### Task Details

#### Group A - [Group Description]

These tasks can run in parallel.

**Task A1: [Task Name]**

- **File**: `path/to/file.ts`
- **Action**: Create | Modify
- **Purpose**: [What this file does and why it exists]
- **Key changes** (for modifications):
  - Add function `functionName` that [does X]
  - Modify `existingFunction` to [handle Y]
- **Interfaces/types consumed**: `TypeName` from `path/to/types.ts`
- **Interfaces/types exported**: `InterfaceName`
- **Recommended model**: haiku | sonnet | opus
- **Reasoning**: [Why this model was chosen for this task]

**Task A2: [Task Name]**

- **File**: `path/to/other.ts`
- **Action**: Create | Modify
- **Purpose**: [What this file does and why it exists]
- **Key changes**: [Specific changes to make]
- **Recommended model**: haiku | sonnet | opus
- **Reasoning**: [Why this model was chosen]

#### Group B - [Group Description]

These tasks depend on Group A being complete. Can run in parallel within the group.

**Task B1: [Task Name]**

- **File**: `path/to/consumer.ts`
- **Action**: Create | Modify
- **Purpose**: [What this file does]
- **Blocked by**: Task A1 (requires `InterfaceName`)
- **Recommended model**: haiku | sonnet | opus
- **Reasoning**: [Why this model was chosen]

---

## Dependency Installation

[Include this section only if external packages are needed. Otherwise remove it.]

Install the following packages before starting implementation:

```bash
# Package manager and exact command
npm install package-name@version
# or
go get github.com/org/package@version
```

**Verify installation**: [Command to verify packages installed correctly]

---

## Validation Checkpoints

### Checkpoint 1 (after Wave 1)

```bash
# Commands to verify the project compiles/builds after Wave 1
[build command]
[lint command if applicable]
```

**Expected outcome**: [What should pass or succeed]

### Checkpoint 2 (after Wave 2)

```bash
[build command]
[test command if applicable]
```

**Expected outcome**: [What should pass or succeed]

---

## Post-Implementation Procedure

After all implementation tasks are complete and the project builds successfully:

```
/smart-plan:post-implementation
```

This will execute:

- **Quality Review**: 3 parallel reviewers (simplicity, bugs, conventions) with confidence >= 80%
- **Refactoring**: Automatic fixes for high-confidence findings
- **Finalization**: Feature documentation and optional commit

Do NOT skip this step. The post-implementation procedure is critical for code quality.

---

## Template Notes

**When filling out this template:**

- Every file in the task ownership map must have a corresponding Task Detail entry
- Parallelization groups must respect the reader-writer lock pattern:
  - Multiple readers can run concurrently
  - Writers require exclusive access per file (two writers can run concurrently only if they touch no common files)
- Recommended model must be specified for every task with clear reasoning
- Validation checkpoints must include actual runnable commands for the project's tech stack
- The plan must be self-contained: anyone reading it must be able to execute it without asking for additional context
