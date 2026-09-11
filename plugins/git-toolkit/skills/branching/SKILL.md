---
name: branching
description: >
  Apply the correct branch naming convention before creating a new git branch or worktree. Invoke
  whenever the user says "create a branch", "new branch", "branch off", "checkout -b",
  "switch to a new branch", "create a worktree", "new worktree", "worktree for X", or any phrase
  where a new branch or worktree is about to be created. Also invoke when the user wants to rename
  or review an existing branch whose name does not follow the convention. Propose the name before
  executing.
---

# Branching

## Format

```
<type>/<description-in-kebab-case>
```

## Types

`feature/` `fix/` `docs/` `test/` — literal. `style/` formatting and linting, no logic changed.
`refactor/` restructure without behavior change. `chore/` build tooling, dependencies, scripts.

## Rules

- Be specific enough to understand without reading the diff:
  `fix/null-pointer-on-empty-cart` beats `fix/bug`
- Keep it concise: under 50 characters total is a good target

## Workflow

Propose the branch name to the user before executing `git checkout -b` (or `git switch -c`).

## Worktrees

The same naming convention applies to the branch created alongside the worktree. Worktrees are
placed under `.claude/worktrees/` inside the project root so they stay out of version control
(`.claude/worktrees/` must be gitignored — add the entry if it is missing) but remain easy to
locate.

The branch keeps `<type>/<description>`; the worktree path flattens the `/` into a hyphen
(`<type>-<description>`) to avoid an extra nesting level under `.claude/worktrees/`. Once the
name is approved:

```bash
git worktree add .claude/worktrees/<type>-<description> -b <type>/<description>
```

After creating the worktree, enter it with the `EnterWorktree` tool
(`EnterWorktree({ path: ".claude/worktrees/<type>-<description>" })`) — never with `cd`.
