---
name: commit
description: >
  Execute a complete, standards-compliant git commit. Invoke immediately whenever the user says
  "commit", "make a commit", "commit these changes", "let's commit", "ship this", "stage and commit",
  or any phrase that signals they want to record changes to git history. Do not wait for the user to
  specify format details — own the full workflow: staging, linting, message authoring, and execution.
  If in doubt, invoke it — a bad commit message is permanent history.
---

# Commit

Work through the steps below in order.

## Step 1 — Understand what's available

Inspect the working tree and the index before deciding anything. If the staging boundary is unclear,
present the picture to the user — never assume what belongs in this commit.

## Step 2 — Stage deliberately

Prefer specific file names over `git add .` or `git add -A`. Blanket staging risks including unrelated
changes that belong in a separate commit, or sensitive files that should never be committed.

Before staging anything, inspect and exclude:
- `.env`, `.env.*`, `*.secret`, credentials files
- Large binaries or generated artifacts unrelated to the change
- Changes that are logically unrelated to the commit's intent — these belong in their own commit

If the user says "add everything", still inspect the list before executing. Explain any exclusions.

## Step 3 — Lint and format modified files

Run whatever formatters and linters the repo configures for the languages in scope. If a formatter
produces changes, stage those too. A commit with unformatted code is already behind.

## Step 4 — Craft the commit message

### Format

Conventional Commits, enforced by the plugin's `commit-guard` hook with these exact limits:

```
<type>(<scope>)?!?: <description>

<body, only when the why does not fit the subject>
```

- Subject: at most 72 characters, imperative mood, lowercase first word, no trailing period.
- `type` is one of `feat` `fix` `docs` `style` `refactor` `test` `chore`, plus `wip` for an
  intentionally incomplete checkpoint — use sparingly. `scope` is optional kebab-case naming the
  plugin or module. `!` marks a breaking change.
- Body: none by default. When the subject cannot carry the why, add one blank line and at most 6
  lines of prose wrapped at 72 characters. The body explains the reason, never the steps or the
  files touched — a commit is not a changelog. `BREAKING CHANGE:` footers are allowed.

### Good message anatomy

Describe *what changed and why*, not *how*. Specificity is what makes `git log` useful six months later.

Forbidden — these make the history useless:
- Generic messages: `fix bug`, `update code`, `changes`, `misc`
- Messages that name the trigger instead of the change: `fix: address code review findings`,
  `apply PR feedback`, `implement step 3 of the plan`, `fix issues from QA`. Describe what the
  diff does to the code; the review that prompted it is invisible to the reader
- Emojis anywhere in the message
- Co-author or attribution lines: `Co-authored-by: Claude <...>` or similar
- Bullet points anywhere in the body

### Atomicity check

Before proposing the message, ask: could `git bisect` use this commit to isolate a specific bug or
feature in the future? If the staged diff touches two unrelated concerns, recommend splitting before
committing. One logical change per commit is the rule — not one file, not one session.

## Step 5 — Commit

Commit directly, without asking for confirmation. Staging (Steps 1-2) and the atomicity check
(Step 4) are the only points where the user is consulted.

Execute with `git commit -m '<subject>'`. When the message has a body, or the subject contains an
apostrophe, use the heredoc form instead, which the hook also validates:

```bash
git commit -m "$(cat <<'EOF'
<subject>

<body>
EOF
)"
```

If `commit-guard` denies the commit, fix exactly what its reason names and retry; do not work
around it with `-F`, `--no-verify`, or by splitting the message across other flags.

Never use `--no-verify`, `--no-gpg-sign`, or `--amend` unless the user explicitly requests it.

After committing, run `git status` to confirm success and report the message and commit hash.
