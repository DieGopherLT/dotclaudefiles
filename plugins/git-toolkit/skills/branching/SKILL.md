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

Branch names are navigation aids in `git log`, `git branch`, and PR titles. A bad name loses that value
and makes it hard to understand what a branch was for without reading the diff.

## Format

```
<type>/<description-in-kebab-case>
```

## Types

| Type | When to use |
|------|-------------|
| `feature/` | New functionality |
| `fix/` | Bug fix |
| `docs/` | Documentation changes only |
| `style/` | Formatting, linting — no logic changed |
| `refactor/` | Restructure without behavior change |
| `test/` | Test additions or corrections |
| `chore/` | Build tooling, dependencies, scripts |

## Rules

- Always kebab-case — never camelCase, snake_case, or spaces
- Be specific enough to understand without reading the diff:
  `fix/null-pointer-on-empty-cart` beats `fix/bug`
- Keep it concise: under 50 characters total is a good target

## Examples

```
feature/add-user-authentication
fix/null-pointer-on-empty-cart
refactor/extract-order-validation
docs/update-api-rate-limiting
chore/upgrade-go-dependencies
```

## Workflow

Propose the branch name to the user before executing. Once approved:

```bash
git checkout -b <type>/<description>
# or
git switch -c <type>/<description>
```

## Worktrees

The same naming convention applies to the branch created alongside the worktree. Worktrees are
placed under `.claude/worktrees/` inside the project root so they stay out of version control
(`.claude/worktrees/` must be gitignored — add the entry if it is missing) but remain easy to
locate.

The branch keeps the `<type>/<description>` format, but the worktree path flattens the `/` into
a hyphen: `<type>-<description>`. Reusing the branch name verbatim as the path would create an
extra `<type>/` nesting level under `.claude/worktrees/`, which adds nothing and makes worktrees
harder to list and clean up.

Propose the branch name first. Once approved:

```bash
git worktree add .claude/worktrees/<type>-<description> -b <type>/<description>
```

After creating the worktree, enter it with the `EnterWorktree` tool — never with `cd`:

```
EnterWorktree({ path: ".claude/worktrees/<type>-<description>" })
```
