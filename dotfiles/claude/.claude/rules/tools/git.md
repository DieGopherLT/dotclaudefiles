# Git Workflow

## File Operations

- **ALWAYS** use `git mv` for moving files (NEVER manual move + git add)
- **ALWAYS** use `git rm` for deleting tracked files (NEVER rm + git add)

## Branch Strategy

**Branch naming convention**: `<type>/<description-in-kebab-case>`

Types: `feature/`, `fix/`, `docs/`, `style/`, `refactor/`, `test/`, `chore/`

Examples:

- `feature/add-login`
- `fix/payment-bug`
- `refactor/simplify-auth`

**Repository type detection:**

- **Personal repos**: Commit to main by default; use `AskUserQuestion` to confirm if user wants a branch for larger changes
- **Collaborative repos**: ALWAYS create a branch for features/fixes
- **When unsure**: Use `AskUserQuestion` to ask if repo is personal or collaborative

## Commit Messages

**MANDATORY FORMAT:**

- Single line ONLY (max 96 chars)
- NEVER add multi-line bodies or bullet points after the summary
- Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `wip:`

**Examples:**

```
feat: add user authentication with JWT
fix: resolve payment processing bug
refactor: simplify error handling logic
docs: update API documentation
test: add unit tests for auth service
chore: update dependencies
```

**FORBIDDEN:**

- Multi-line commit messages with body/footer
- CLAUDE co-authoring information or attribution
- Emojis in commit messages
- Generic messages like "fix bug" or "update code"

## Commit Process

**CRITICAL RULES:**

1. **NEVER commit without explicit user approval**
2. Before committing:
   - Ensure all modified files are linted/formatted
   - Verify tests pass (if applicable)
   - Review changes with `git diff` or `git diff --staged`
3. When staging files:
   - **PREFER staging specific files by name** over `git add .` or `git add -A`
   - Avoid accidentally staging sensitive files (.env, credentials, etc.)
   - Avoid staging large binaries unless intentional
4. After committing:
   - Run `git status` to verify commit success

## Pull Requests

- **ALWAYS** use `/dotclaudefiles:create-pr` skill unless user explicitly says otherwise
- NEVER create PRs manually with `gh pr create` unless specifically requested
- The skill provides structured format adapted to change size

## Project-Specific Overrides

- Check for `.claude/rules/git.md` in the project root
- Project rules take precedence over these global rules
- Common project overrides: hooks behavior, commit message format, additional validation
