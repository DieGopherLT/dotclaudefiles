# Storage Decision Guide

Full spec for each Claude Code memory destination available within a project.

---

## CLAUDE.local.md

### When to use

Information that is true for this project but only on your local machine:

- Local server URLs (`localhost:5173`, `127.0.0.1:3000`)
- Local filesystem paths specific to your machine
- Personal dev preferences that override the project defaults (e.g., a flag you always pass locally)
- Credentials or tokens that must stay off version control — though prefer a `.env` file or secret manager over CLAUDE.local.md for actual credentials

### When NOT to use

- Anything the team should also know → use `CLAUDE.md`
- Project conventions or coding standards → use `.claude/rules/`
- Machine-level Claude preferences that apply across all projects → use `~/.claude/CLAUDE.md` (out of scope for this skill)

### Write format

If the file exists, append at the end. If it does not exist, create it.

No required frontmatter or heading structure. A single line or bullet is enough for simple facts:

```markdown
- Dev server: localhost:5173
- Use `--skip-auth` flag when running integration tests locally
```

For longer entries, add a minimal section heading:

```markdown
## Local Environment

- API base: http://localhost:8080
- DB: postgres://localhost:5432/myapp_dev
```

### Important

`CLAUDE.local.md` must be in `.gitignore`. If it isn't, warn the user before writing.

---

## CLAUDE.md

### When to use

Information Claude needs on every session entry for this project, regardless of which file it opens:

- Project overview and purpose (1-2 sentences)
- Repository structure and key directories
- Build, test, and run commands
- Module descriptions at the project root level
- Cross-project conventions that differ from the user's global defaults

### When NOT to use

- Language or framework conventions → use `.claude/rules/` (they don't need to load every session)
- Module-specific documentation → use a subdirectory `CLAUDE.md` via `claudify`
- Local-only information → use `CLAUDE.local.md`
- Information only relevant when working on a specific file type → use path-scoped `.claude/rules/`

### Write format

Insert under the most relevant existing section heading. Do not create new top-level sections unless the information genuinely doesn't fit any existing one.

**Size gate**: If the file is at or above 180 lines, stop. Tell the user the file is approaching the 200-line ceiling and suggest running `rulify` first to make room. Writing past 200 lines degrades adherence.

After insertion, verify the file stays under 200 lines.

### Example

```markdown
## Testing

- Run `go test ./...` for unit tests
- Integration tests require a running Postgres instance: `make db-up` before running `make test-integration`
```

---

## .claude/rules/ — path-scoped (with `paths` frontmatter)

### When to use

Conventions or standards tied to a specific file type, directory, or subsystem:

- TypeScript/JavaScript coding conventions → trigger on `**/*.ts`, `**/*.tsx`
- React component patterns → trigger on `src/components/**/*`
- API handler conventions → trigger on `src/api/**/*.ts`
- Test file patterns → trigger on `**/*.test.*`, `**/*.spec.*`
- Go-specific standards → trigger on `**/*.go`

These rules load on demand — only when Claude reads a matching file. This keeps context lean.

### When NOT to use

- The convention applies to all code in the project regardless of type → use always-on rule (no frontmatter)
- The information is project orientation that Claude needs before opening any file → use `CLAUDE.md`

### Write format

Check `.claude/rules/` recursively for an existing rule whose `paths` already covers the same scope. If found, merge the new content into it, preserving the existing frontmatter.

If no matching rule exists, create `.claude/rules/<category>/<topic>.md`. Use these category names for consistency:

- `code-standards/` — language or style conventions
- `languages/` — language-specific patterns
- `frameworks/` — framework-specific patterns
- `tools/` — build tools, linters, formatters
- `testing/` — test patterns and conventions

File structure:

```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Conventions

- Prefer `interface` over `type` for object shapes
- Use `unknown` instead of `any`; narrow explicitly
```

Rules with `paths` frontmatter must have both opening and closing `---` delimiters.

### Glob patterns reference

| Pattern | Triggers when |
|---|---|
| `**/*.ts` | Any TypeScript file |
| `src/**/*` | Any file under `src/` |
| `**/*.test.*` | Any test file |
| `src/components/**/*.tsx` | React components in components/ |
| `**/*.{ts,tsx}` | TypeScript and TSX |

---

## .claude/rules/ — always-on (no frontmatter)

### When to use

Cross-cutting coding standards that apply to all project code regardless of file type or location:

- Naming conventions (variables, functions, classes, files)
- Error handling patterns
- Control flow rules (guard clauses, no else, early returns)
- Immutability preferences
- Logging and observability standards

These rules load every session alongside `CLAUDE.md`. Keep them focused — one topic per file.

### When NOT to use

- The standard only makes sense for a specific language or framework → use path-scoped rule
- The information is project orientation → use `CLAUDE.md`

### Write format

Omit `paths`. A rule without `paths` loads every session; plain markdown with no frontmatter is the simplest form.

Check for an existing always-on rule covering the same standard. Merge into it if found; create new if not.

```markdown
# Naming Conventions

- Variables and functions: descriptive intent (`calculateTotalPrice`, not `process`)
- Booleans: `is`/`has`/`should` prefix (`isActive`, `hasPermission`)
- No abbreviations unless universally known (`url`, `id` are fine; `usr`, `mgr` are not)
```

---

## Skill (.claude/skills/)

### When to use

Step-by-step procedures or workflows that Claude should be able to execute reproducibly on demand:

- Deploying to a specific environment (staging, production)
- Setting up the local dev environment from scratch
- Running a data migration or seeding procedure
- Executing a multi-step release checklist
- Any repeated process where the exact sequence of steps matters

The key signal: the user is describing a **how-to** — a flow with ordered steps — not a fact, a convention, or a configuration value.

### When NOT to use

- The information is a single-step fact or command → use `CLAUDE.md`
- The information is a coding convention or standard → use `.claude/rules/`
- The flow applies to all projects, not just this one → use `~/.claude/skills/` (out of scope for this skill)
- The information describes the project state or a decision → use `Memory`

### Write format

Check `.claude/skills/` for an existing skill covering the same flow. If found, merge the new steps into the existing `SKILL.md`, preserving the frontmatter.

If no matching skill exists, create `.claude/skills/<skill-name>/SKILL.md`. Use a kebab-case name that reflects the flow's purpose (`deploy-to-staging`, `setup-dev-environment`, `run-migration`).

File structure:

```markdown
---
name: deploy-to-staging
description: Despliega la aplicación a staging. Úsala cuando el usuario pide "deploy to staging", "despliega a staging", o quiere ejecutar el proceso de deploy al ambiente de staging.
---

# Deploy to Staging

## Workflow

1. Run the test suite: `go test ./...`
2. Build the Docker image: `docker build -t myapp:staging .`
3. Push to the registry: `docker push registry.example.com/myapp:staging`
4. Apply migrations: `kubectl apply -f k8s/migrations.yaml`
5. Rollout the deployment: `kubectl rollout restart deployment/myapp -n staging`
6. Verify rollout: `kubectl rollout status deployment/myapp -n staging`
```

Write the body in imperative form — verb-first steps, no second person.

### Writing the description

The `description` field is how Claude decides when to auto-invoke the skill. Quality matters: a vague description means the skill never triggers automatically.

State what the skill does and when to use it, key use case first (the description is truncated past 1,536 characters):

```
<What it does>. Use when the user asks to "<phrase 1>", "<phrase 2>", "<phrase 3>".
```

Rules:

- **Specific trigger phrases** — quote the exact words a user would say; avoid generic descriptions like "deploys the app"
- **Bilingual when relevant** — include the Spanish phrasing if the user is likely to ask in Spanish (`"deploy to staging"`, `"despliega a staging"`)
- **Concrete over abstract** — "deploy to staging", "run the migration", "set up local dev" not "deployment", "migration tasks", "environment setup"

Bad description:

```yaml
description: Deploys the application.
```

Good description:

```yaml
description: Runs the full staging release flow. Use when the user asks to "deploy to staging", "despliega a staging", or "run the staging deploy".
```

### Glob patterns

Skills accept an optional `paths` frontmatter with globs: the skill auto-loads only when working with matching files. Without it, the skill is invoked by the user or by Claude when the trigger matches the `description`.

---

## Memory

### When to use

Project context that is not derivable from the code, not versioned with the project, and not needed on every session:

- Infrastructure details (hosting provider, environment names, deployment pipeline)
- Stakeholder names and roles relevant to decisions
- Historical decisions and the reasoning behind them
- External constraints (compliance requirements, SLA agreements, vendor limitations)
- Non-obvious facts about the project's operating environment

Memory is machine-local and not shared through version control. It persists across conversations for the same project.

### When NOT to use

- Coding conventions → use `.claude/rules/`
- Always-needed project context → use `CLAUDE.md`
- Local environment config → use `CLAUDE.local.md`
- Secrets or credentials → do not store anywhere in Claude Code memory

### Write format

Write to a topic file at `~/.claude/projects/<project>/memory/<topic>.md`. Use these `type` values:

- `project` — facts about the project's state, infrastructure, or decisions
- `reference` — pointers to external systems, dashboards, or resources
- `user` — facts about the user's role or preferences related to this project
- `feedback` — behavioral guidance specific to this project

Topic file structure:

```markdown
---
name: <kebab-case-slug>
description: <one-line summary — used to judge relevance in future sessions>
stale_when: <only for transient facts: a date, a branch event, or one line; omit for evergreen knowledge>
metadata:
  type: project
---

<fact or decision>

**Why:** <the reason this is worth remembering>
**How to apply:** <when this should influence suggestions>
**Reference:** <file path at minimum; `path::Symbol` when tied to a symbol; commit SHA when about a specific change>
```

After writing the topic file, add or update the pointer in `MEMORY.md`:

```markdown
- [Title](topic-file.md) — one-line hook, concise enough to judge relevance at a glance
```

Place the pointer under the most relevant existing section in `MEMORY.md`, or create a new section if none fits.

### Finding the project memory path

Write to the memory directory named in the session's system prompt; never derive it. All worktrees of a repo share one memory directory, and the `autoMemoryDirectory` setting can relocate it, so a path built from `git rev-parse --show-toplevel` points at an orphan directory inside a worktree.

If the system prompt names no memory directory, ask the user to confirm the intended path before writing.
