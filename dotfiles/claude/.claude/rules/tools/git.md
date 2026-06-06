# Git Workflow

## Ignoring files

Local resources too coupled to the user's environment should not be committed: use `.gitignore` for regenerable artifacts, `.git/info/exclude` for user-specific ones 
(e.g. environment-specific `.claude/agents/` or `.claude/skills/`).

## File Operations

- ALWAYS use `git mv` for moving files (NEVER manual move + git add)
- ALWAYS use `git rm` for deleting tracked files (NEVER rm + git add)
- When `EnterWorktree` is unavailable, create worktrees via git under `.claude/worktrees/` — keep that path in `.gitignore` to avoid committing worktree metadata.

## Branch Strategy

Branch naming: `<type>/<description-in-kebab-case>`
Types: `feature/`, `fix/`, `docs/`, `style/`, `refactor/`, `test/`, `chore/`
Examples: `feature/add-login`, `fix/payment-bug`, `refactor/simplify-auth`

## Commit Messages

MANDATORY FORMAT: single line only (max 96 chars), never multi-line bodies or bullet points.

Prefixes: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `wip:`

Examples: `feat: add user authentication with JWT`, `fix: resolve payment processing bug`

FORBIDDEN:

- CLAUDE co-authoring information or attribution
- Emojis in commit messages
- Generic messages like "fix bug" or "update code"

## Commit Process

CRITICAL: NEVER commit without explicit user approval.

Before committing: lint/format modified files, verify tests pass, review with `git diff --staged`.

When staging: prefer specific files by name over `git add .`; avoid .env, credentials, large binaries.

After committing: run `git status` to verify success.

### Atomocity level

A commit's ideal atomicity is whatever makes it auditable by `git bisect`: one logical change per commit, semantically related changes grouped together, unrelated changes separated. Mixing unrelated changes makes it harder to isolate what introduced a bug.

## Pull Requests

- Always search for an exsisting PR templaet on the project and use it if available.
- User expects you to create a file on the project root with the PR & not to commit it, it's a temporary file.

## Project-Specific Overrides

- Check for `.claude/rules/git.md` in the project root
- Project rules take precedence over these global rules
