# Example Patterns (Reference)

Read this for concrete archetypes of high-value rules. When classifying a CLAUDE.md section, ask: does it match one of these patterns? If yes, it almost certainly belongs in `.claude/rules/`, not in CLAUDE.md.

## Pattern 1: Workflow-enforcing rule

A rule that fires when a specific class of work begins and steers Claude into the right tooling, agent, or skill for that work. Lives best as a path-scoped rule so it loads exactly when relevant.

**Why extracting this matters**: workflow rules are imperative and prescriptive. Buried inside a multi-section CLAUDE.md they get diluted. Loaded fresh and alone when the matching files are touched, they get followed.

### Shape

```markdown
---
paths:
  - "<glob matching the work surface>"
---

# <Workflow Name>

<One sentence stating the non-negotiable: ALWAYS do X when working in this area.>

## Mandatory Workflows

- **<trigger>**: invoke `<skill or agent>` immediately before <action>. <One-line justification.>
- **<trigger>**: <action>. Do not skip this step.

## Quality Standards

When creating <component type>:
- <concrete requirement>
- <concrete requirement>
```

### When to extract a section into this shape

The CLAUDE.md section:

- Tells Claude to invoke a specific tool, skill, or agent for a class of work
- Contains "ALWAYS" / "NEVER" language tied to file types or directories
- Documents a mandatory pre-step or validation step
- Was added because Claude skipped it more than once

### Real example in this repository

`.claude/rules/plugins/use-plugin-dev.md` is exactly this pattern. It mandates invoking the `plugin-dev` plugin's resources (skills, agents) whenever plugin development happens, and forces `plugin-validator` after any change. It loads only when working in the plugin source paths, so non-plugin sessions never pay for it — but the moment plugin work starts, the rule arrives in context and the workflow is followed. This skill itself was created via `/skill-creator` because that rule fired.

## Pattern 2: Trigger-table that routes to specialists

A rule whose body is mostly a table mapping "if you change X" to "invoke agent Y." Path-scoped to the language or surface where the triggers apply. High leverage because one small rule wires up many specialist agents conditionally.

**Why extracting this matters**: trigger tables are reference material — the model needs to scan them when a matching change happens, then forget them. They are useless on a session about CSS but critical on a session that touches goroutines. Path-scoping is the whole point.

### Shape

```markdown
---
paths:
  - "<glob for the relevant language or surface>"
---

# <Topic> Review

<One sentence stating the non-negotiable: any change touching X must be reviewed by the corresponding specialist before the change is considered complete.>

## Trigger table

| Trigger | Agent |
|---------|-------|
| <specific code pattern changed> | `<specialist-agent-name>` |
| <another pattern> | `<another-agent>` |

## Non-obvious triggers — call the agent even when the change looks innocent

- <subtle change that should still trigger review> → `<agent>` (<one-line reason>)
- <another subtle case> → `<agent>` (<reason>)

## Scope rules

- <how to pass scope to the agent: package path, directory, etc.>
- <what to do for multi-package changes>
- <escalation rule for large changesets>
```

### When to extract a section into this shape

The CLAUDE.md section:

- Contains a list of "if you do X, also do Y" pairs
- Maps code patterns to specific reviewers, validators, or agents
- Includes notes about non-obvious cases that look safe but aren't
- Is specific to one language or one surface (Go concurrency, SQL migrations, IaC changes)

### Why this pattern is so valuable

It externalizes the "what could go wrong here" expertise. Without the rule, Claude makes a goroutine change and moves on. With the rule loaded — only when touching matching files — Claude routes the change to a specialist that knows the failure modes. The trigger table is the lookup; the agents are the depth.

This is a generalizable archetype: any domain with subtle correctness traps (concurrency, security, migrations, financial calculations, accessibility) benefits from a path-scoped trigger-table rule that routes to specialist reviewers.

## Pattern 3: Language style guide

The most common extraction. A block of "in TypeScript do X" or "in Go we prefer Y" that bloats CLAUDE.md and only matters when the model is actually editing that language.

### Shape

```markdown
---
paths:
  - "**/*.<ext>"
---

# <Language> Standards

## <Concept>

<Rule in one sentence.>

```<lang>
// Bad
<example>

// Good
<example>
```

```

### When to extract

The CLAUDE.md section:

- Names a language in its heading
- Contains style preferences, idioms, or conventions
- Is unused on sessions in other languages

Always extract these. They are the bread and butter of rulify.

## Pattern 4: Always-on cross-cutting standard

Naming conventions, error handling style, logging format, control flow preferences. Apply to every file but bloat CLAUDE.md.

### Shape

```markdown
# <Standard Name>

<Lead with the rule.>

## <Aspect>

```<lang>
// Bad
<example>

// Good
<example>
```

```

No frontmatter. Loaded every session, but lives in `.claude/rules/code-standards/` instead of inside CLAUDE.md so the base file stays focused on the project.

### When to extract

The CLAUDE.md section:

- Applies regardless of file type
- Is generic enough to reuse across projects
- Adds bulk that pushes CLAUDE.md past 200 lines

These are the second-most-common extraction after language guides.

## Pattern 5: High-stakes single-action reminder

A short, high-emphasis rule that locks in one critical action the model must take at a specific moment — typically before a destructive or irreversible operation. Different from Pattern 1 (multi-step workflow) and Pattern 2 (trigger table): this is one rule, one action, hammered with strong language so it cannot be skimmed past.

**Why extracting this matters**: these rules earn their loud tone by being narrow. Buried in a 500-line CLAUDE.md, the urgency is lost. As a small focused rule that loads only when relevant, the emphasis lands and the action gets taken.

### Shape

```markdown
---
paths:
  - "<glob for the surface where this matters>"
---

# WARNING: <Action Name> (<consequence prevention>)

**ALWAYS <do the action> BEFORE <the trigger event>.**

<One sentence stating the consequence of skipping. Be vivid. The point is to be unmissable.>

```bash
# 1. <step>
# 2. <step>
# 3. THEN <commit / push / deploy>
```

## <Action> Guidelines

- **<Variant A>**: <when to use it>
- **<Variant B>**: <when to use it>
- **<Variant C>**: <when to use it>

<Optional: short post-action protocol — what to do after the action lands.>

```

### When to extract a section into this shape

The CLAUDE.md section:

- Mandates one specific action tied to one specific moment (pre-commit, pre-push, pre-deploy, pre-merge)
- Was added because Claude forgot it once and broke something
- Has a clear "before X, do Y" structure
- Reads with raised voice — bold, ALL CAPS, warning emoji-equivalents

### Examples of the archetype

- Bumping a `version` field in a manifest before committing changes to that package, so consumers see the new version
- Regenerating a lockfile after dependency edits, before any commit
- Running a migration linter before a PR touching `migrations/` is opened
- Updating a CHANGELOG entry whose absence will fail CI but only at the very end

This repository has one of these for plugin version bumps — it lives at `.claude/rules/plugins/version-management.md`, scoped to plugin paths, and it loads exactly when plugin work is happening. The dramatic phrasing ("Ragnarök will occur") is intentional and works because the rule is short, focused, and only present when it matters.

### Why dramatic phrasing belongs in rules, not CLAUDE.md

Strong language ("ALWAYS", "NEVER", warnings, consequences) competes for attention. CLAUDE.md is full of competing instructions, so loud language gets normalized and ignored. A standalone rule loaded only at the relevant moment has no competition — the warning hits.

## Quick decision tree

When looking at a CLAUDE.md section:

1. Does it route work to a specific tool/agent/skill? → Pattern 1, scoped rule
2. Is it a trigger table mapping changes to reviewers? → Pattern 2, scoped rule
3. Is it tied to a language or file type? → Pattern 3, scoped rule
4. Is it a generic coding standard that bloats the base file? → Pattern 4, always-on rule
5. Is it a single critical action that must happen before a specific trigger event? → Pattern 5, scoped rule
6. Does it orient a new reader to the project in 30 seconds? → stays in CLAUDE.md

If a section matches none of patterns 1-5 but is still bulky, ask the user — it may be project context that genuinely belongs in CLAUDE.md, or it may be a sixth archetype worth extracting.
