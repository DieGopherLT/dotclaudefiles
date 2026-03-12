---
name: smart-delegation
description: Esta skill debe usarse cuando Claude detecta que una implementacion es lo suficientemente grande como para dividirla en sub-agentes (5+ archivos, dependencias entre cambios, nuevas abstracciones que otros archivos consumen), cuando el usuario pide "delega la implementacion", "orquesta los implementadores", "usa sub-agentes", "delegate to sub-agents", "orchestrate implementers", o cuando plan-feature invoca la delegacion tras aprobar un plan.
---

# Smart Delegation - Sub-Agent Orchestration Guidelines

Apply these orchestration guidelines to execute an existing implementation plan using specialized code-implementer sub-agents.

## Step 1: Decide Delegation Strategy

Evaluate whether to delegate to sub-agents or implement directly:

- **Delegate** when ANY of these apply: 5+ files to create/modify, dependencies between changes (file A must exist before file B imports it), new abstractions consumed by other files
- **Implement directly** when none of the above apply. A TODO list is still required either way

If implementing directly, skip steps 2-4 and write the code following project conventions.

## Step 2: Install Dependencies

If the plan includes external dependencies, install them directly using Bash:

- Check the exact package manager and command from the plan (e.g. npm install, pnpm add, go get)
- Verify installation succeeded before proceeding

## Step 3: Create Implementation Tasks

Group plan tasks by semantic domain before creating Task entries. A semantic batch is a set of files that belong to the same module, layer, or feature slice and are implemented as a unit by a single sub-agent. **Never create a sub-agent per file.**

Use TaskCreate for each semantic batch:

- Set up dependencies with addBlockedBy/addBlocks matching the plan
- Include the parallelization group and the list of files in the batch in task metadata

## Step 4: Launch Parallel Implementers

For each parallelization group, launch code-implementer sub-agents (Agent tool, subagent_type=smart-plan:code-implementer) for all tasks in that group simultaneously.

Each implementer receives:

```
Implement the following semantic batch from the approved plan:

Task ID: [task id from TaskCreate]
Batch description: [what this batch accomplishes as a unit]
Files to create: [list]
Files to modify: [list]

Architecture context:
[relevant portion of the architecture blueprint]

Project conventions:
[key conventions from exploration]

IMPORTANT:
- Use TaskGet at the start to read your task state, then TaskUpdate to mark it in-progress
- Update the task with TaskUpdate after completing each file in the batch
- Mark the task completed with TaskUpdate when all files in the batch are done
- Use TaskList to check sibling tasks if you need coordination context
- Use TaskCreate only if you discover genuinely unplanned work that must be tracked
- ONLY modify the files listed above
- Do NOT compile or run tests during intermediate steps
- Do NOT install dependencies
- Follow existing project conventions exactly
- Use LSP (goToDefinition, findReferences, hover) for codebase navigation instead of reading full files
- Report all files created/modified when done
```

### Model Selection Per Task

- **haiku**: Mechanical, repetitive tasks with minimal reasoning. Also suitable for read-only operations
- **sonnet**: Individual module, few files, standard business logic (DEFAULT)
- **opus**: Multiple new files or dependencies that need to be connected, or tasks demanding high reasoning to avoid mistakes

## Step 5: Wave Execution

Execute each parallelization wave sequentially:

1. Wait for the current parallel group to complete
2. Verify the project compiles/bundles after each wave completes (not during intermediate steps within a wave). Minimize Bash calls for build checks
3. Update tasks with TaskUpdate (mark completed)
4. Launch the next group of implementers (tasks that are now unblocked)
5. Repeat until all groups are done

---

## Concurrency Model

Parallelization follows the **readers-writer lock pattern** at the semantic batch level — never at the individual file level:

- **Readers** (read-only tasks): any number can run concurrently
- **Writers** (tasks that modify files): require exclusive access per file. Two writers can run concurrently only if their batches touch no common files

---

## Rules

- **Always track progress**: Update tasks (TaskUpdate) as each step starts and completes
- **Semantic batching is mandatory**: Never create a sub-agent per file. Group by module/layer/feature slice. One sub-agent handles an entire semantic batch
- **Prefer delegation for 5+ files**: Implement directly only for simple changes; delegate to code-implementer sub-agents otherwise
- **Consolidate agent outputs**: After agents return, synthesize their findings before presenting to user
- **Fail gracefully**: If an agent fails or returns poor results, inform user and offer to retry or adjust
- **Be transparent**: Show the user what is happening at each step; do not work silently
