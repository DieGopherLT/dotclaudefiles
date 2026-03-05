# Git Workflow

## File Operations

- ALWAYS use `git mv` for moving files (NEVER manual move + git add)
- ALWAYS use `git rm` for deleting tracked files (NEVER rm + git add)

## Branch Strategy

Branch naming: `<type>/<description-in-kebab-case>`

Types: `feature/`, `fix/`, `docs/`, `style/`, `refactor/`, `test/`, `chore/`

Examples: `feature/add-login`, `fix/payment-bug`, `refactor/simplify-auth`

Repository type detection:

- Personal repos: commit to main by default; use `AskUserQuestion` to confirm if user wants a branch for larger changes
- Collaborative repos: ALWAYS create a branch for features/fixes
- When unsure: use `AskUserQuestion` to ask if repo is personal or collaborative

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

## Pull Requests

- ALWAYS use `/dotclaudefiles:create-pr` skill unless user explicitly says otherwise
- NEVER create PRs manually with `gh pr create` unless specifically requested

## Project-Specific Overrides

- Check for `.claude/rules/git.md` in the project root
- Project rules take precedence over these global rules
