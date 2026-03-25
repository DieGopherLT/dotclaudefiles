# Task tracking with TaskCreate

## When to create tasks

Create tasks with `TaskCreate` BEFORE starting work when ANY of these apply:

- The work touches 2+ files
- The work involves 3+ sequential steps
- Executing an approved plan (always, even if user didn't ask)
- The request includes non-obvious steps that are easy to skip

## What to include in the task list

Enumerate every discrete step. Include steps that are easy to overlook:

- Updating CLAUDE.md or other documentation that reflects the change
- Updating versions (package.json, plugin.json, etc.) if applicable
- Invoking skills the user requested
- As the LAST task: invoke the `simplify` skill to review all changes (required when 2+ files were modified, features were added, or non-trivial changes were made)

## Task lifecycle

- Mark `in_progress` when starting a task
- Mark `completed` immediately when done -- do not batch completions
- Never skip ahead to a blocked task

## Dependencies

Identify dependencies BEFORE creating tasks. Use `addBlockedBy`/`addBlocks` at creation time when:

- A step produces output that a later step consumes (e.g., a new type that other files import)
- A step modifies a file that a later step also modifies
- A step must verify the result of a previous step (e.g., running tests after implementation)

## What tasks are NOT for

- Do not use tasks for single-file, single-step changes
- Do not create tasks to track research or exploration -- tasks track actions with observable output
- Do not duplicate task information in memory -- tasks are conversation-scoped
