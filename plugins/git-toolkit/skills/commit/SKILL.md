---
name: commit
description: >
  Execute a complete, standards-compliant git commit. Invoke immediately whenever the user says
  "commit", "make a commit", "commit these changes", "let's commit", "ship this", "stage and commit",
  or any phrase that signals they want to record changes to git history. Do not wait for the user to
  specify format details — own the full workflow: staging, linting, message authoring, approval when
  the commit is standalone, and execution. If in doubt, invoke it — a bad commit message is permanent
  history.
---

# Commit

You are about to create a permanent entry in git history. Your job is to make it correct, specific, and
auditable. Work through the steps below in order.

## Step 1 — Understand what's available

Run `git status` and `git diff` to see all unstaged changes. Run `git diff --staged` to see what's
already staged. Present this picture to the user if staging decisions are unclear — never assume what
belongs in this commit.

## Step 2 — Stage deliberately

Prefer specific file names over `git add .` or `git add -A`. Blanket staging risks including unrelated
changes that belong in a separate commit, or sensitive files that should never be committed.

Before staging anything, inspect and exclude:
- `.env`, `.env.*`, `*.secret`, credentials files
- Large binaries or generated artifacts unrelated to the change
- Changes that are logically unrelated to the commit's intent — these belong in their own commit

If the user says "add everything", still inspect the list before executing. Explain any exclusions.

## Step 3 — Lint and format modified files

Run formatters and linters for the languages in scope before committing:
- TypeScript / JavaScript: ESLint, Prettier (if configured)
- Go: `gofmt` or `goimports`
- Markdown: `markdownlint` (if configured)

If a formatter produces changes, stage those changes too before proceeding. A commit with
unformatted code is already behind.

## Step 4 — Craft the commit message

### Format

Single line only. Maximum 96 characters. No body. No bullet points.

```
<prefix>: <description>
```

### Prefixes

| Prefix | When to use |
|--------|-------------|
| `feat:` | New capability that didn't exist before |
| `fix:` | Corrects a bug or broken behavior |
| `docs:` | Documentation only — no production logic changed |
| `style:` | Formatting, whitespace — no logic changed |
| `refactor:` | Restructure without adding features or fixing bugs |
| `test:` | Test files only |
| `chore:` | Build tooling, dependencies, scripts |
| `wip:` | Intentionally incomplete checkpoint — use sparingly |

### Good message anatomy

Describe *what changed and why*, not *how*. Specificity is what makes `git log` useful six months later.

Good:
- `feat: add JWT expiry validation to auth middleware`
- `fix: resolve N+1 query on user list endpoint`
- `refactor: extract order validation into dedicated service`
- `docs: document rate limiting behavior in API reference`

Forbidden — these make the history useless:
- Generic messages: `fix bug`, `update code`, `changes`, `misc`
- Emojis anywhere in the message
- Co-author or attribution lines: `Co-authored-by: Claude <...>` or similar
- Multi-line messages with a body or bullet points

### Atomicity check

Before proposing the message, ask: could `git bisect` use this commit to isolate a specific bug or
feature in the future? If the staged diff touches two unrelated concerns, recommend splitting before
committing. One logical change per commit is the rule — not one file, not one session.

## Step 5 — Get explicit approval, then commit

Present the staged files and the proposed message. Do not commit until the user explicitly approves.
Phrases like "go ahead", "yes", "do it", "looks good" count as approval. Silence or ambiguity does not.

**Exception — orchestrated context.** When this skill runs as part of executing an already-approved
plan, or a user-approved multi-task orchestration that commits at task or group boundaries, that prior
approval counts as authorization for its commits. Do not pause to ask for confirmation: commit directly
and report the message and hash. The explicit approval gate above is reserved for standalone commits
initiated by the user.

Everything else in this step — the heredoc, the flag restrictions, the post-commit verification —
applies in both modes.

Execute using a heredoc to avoid quoting issues:

```bash
git commit -m "$(cat <<'EOF'
feat: your message here
EOF
)"
```

Never use `--no-verify`, `--no-gpg-sign`, or `--amend` unless the user explicitly requests it.

After committing, run `git status` to confirm success and report the commit hash.
