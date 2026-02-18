---
name: document
description: Esta skill debe usarse cuando el usuario pide "documentar un patrón", "documentar un problema", "documentar una decisión", "documentar guías", "documentar la sesión", "documentar el conocimiento de la sesión", "document session knowledge", "capturar lo aprendido en la sesión", "crear documentación de", o quiere capturar conocimiento técnico de la sesión usando plantillas estructuradas.
version: 1.0.0
---

# Document Skill

Generate structured technical documentation for specific knowledge elements discovered during development sessions.

## Documentation Types

### Pattern Documentation

For reusable code patterns, techniques, or solutions.

**Template:** `references/templates/pattern.md`

**Example:** `examples/pattern-example.md` (Retry with Exponential Backoff)

### Problem-Solution Documentation

For complex bugs, race conditions, or difficult technical challenges.

**Template:** `references/templates/problem-solution.md`

**Example:** `examples/problem-solution-example.md` (Race Condition in Cache)

### Decision Documentation

For architectural decisions, technology choices, or trade-off analysis.

**Template:** `references/templates/decision.md`

**Example:** `examples/decision-example.md` (PostgreSQL vs MongoDB)

### Guidelines Documentation

For design systems, code standards, or team conventions.

**Template:** `references/templates/guidelines.md`

**Example:** `examples/guidelines-example.md` (Button Component Guidelines)

### Session Knowledge Documentation

For sessions focused on discussion, research, or analysis with no code changes.

Guard: Check your own session context. If no code was modified in this session, automatically select this type without prompting the user.

**Template:** `references/templates/session-knowledge.md`

**Storage:** `.claude/docs/sessions/`

### Free-Form Documentation

For anything that doesn't fit other categories.

**Template:** `references/templates/free-form.md`

## Documentation Process

Follow these steps to create documentation:

### Step 1: Identify Document Type

Before identifying type: if this is a session documentation request, check your own context.

- If no code was modified in this session -> automatically use Session Knowledge (no git needed).
- If code was modified -> Session Knowledge is still an option but proceed with normal type selection.

Determine which type of documentation fits the user's intent:

- **Pattern**: Reusable solution or technique
- **Problem-Solution**: Bug fix or challenge resolved
- **Decision**: Choice between alternatives with rationale
- **Guidelines**: Standards or conventions
- **Session Knowledge**: Discussion, research, or analysis session with no code changes
- **Free-Form**: Doesn't fit other categories

Ask user if type is ambiguous: "Is this a pattern, problem-solution, or decision?"

### Step 2: Load Appropriate Template

Read the corresponding template from `references/templates/{type}.md` (use absolute path `${CLAUDE_PLUGIN_ROOT}/skills/document/references/templates/{type}.md` when loading):

- `pattern.md` for patterns
- `problem-solution.md` for problems
- `decision.md` for decisions
- `guidelines.md` for guidelines
- `session-knowledge.md` for session knowledge
- `free-form.md` for free-form

Templates contain structure and field descriptions.

### Step 3: Gather Information

Extract information from session context:

**Auto-detect:**

- Current timestamp (YYYY-MM-DD HH:MM:SS)
- Project name (from git repo or directory)
- Related commit hash (if in git repo and applicable)
- Relevant files modified/discussed

**Ask user if needed:**

- Document title
- Tags for categorization
- Additional context not in session
- Custom instructions for content

**Use conversation context:**

- Code discussed during session
- Problems encountered and solutions
- Decisions made and alternatives considered
- Patterns implemented

### Step 4: Generate Document

Populate template with gathered information:

1. Fill metadata section automatically
2. Structure main content based on template
3. Include code examples from session
4. Reference relevant files
5. Add appropriate tags

**Content quality guidelines:**

- Be specific and technical
- Include code examples where applicable
- Explain rationale, not just what was done
- Document trade-offs and alternatives
- Keep it concise but complete

### Step 5: Determine Storage Location

**Default location:** `.claude/docs/{category}/{filename}.md`

**Directory structure:**

```
.claude/docs/
├── patterns/
├── problems/
├── decisions/
├── guidelines/
├── sessions/
└── free-form/
```

**Filename format:** `{YYYYMMDD-HHMMSS}-{slug}.md`

Example: `20260115-142345-retry-pattern.md`

**User can override:**

- Custom directory path
- Custom filename
- Root directory if preferred

### Step 6: Write and Confirm

1. Write document to determined location
2. Show user the path and brief summary
3. Offer to open file for review/edits

### Step 7: Git Ignore Check

After writing the file:

1. Run: `git check-ignore -q <file_path>`
2. If file IS ignored: proceed normally, nothing to do.
3. If file is NOT ignored:
   - Add the parent directory expression to `.gitignore` (e.g. `.claude/docs/`)
   - Inform the user that `.gitignore` was updated to exclude generated docs.

## Metadata Fields

All documents include standard metadata:

- **Timestamp**: Auto-generated (YYYY-MM-DD HH:MM:SS)
- **Project**: Auto-detected from git or directory name
- **Category**: Document type (Pattern/Problem-Solution/Decision/Guidelines/Session Knowledge/Free-Form)
- **Tags**: Comma-separated tags for search
- **Related Commit**: Git commit hash if available (not applicable for Session Knowledge)

### Tag Suggestions

These are suggested tag categories. Use relevant tags based on actual content.

**Technical area:** backend, frontend, database, api, infrastructure

**Technology:** go, typescript, react, postgresql, redis, docker

**Change type:** bugfix, optimization, refactoring, feature

**Complexity:** simple, moderate, complex

**Impact:** breaking-change, backward-compatible, experimental

## Examples

### Example 1: Documenting a Pattern

**User says:** "Document the retry pattern we implemented for the HTTP client"

**Actions:**

1. Identify type: Pattern
2. Load `references/templates/pattern.md`
3. Extract from session:
   - Retry implementation code
   - Configuration approach
   - Files modified
4. Auto-detect:
   - Timestamp: 2026-01-15 14:23:45
   - Project: payment-service
   - Commit: a3f7d92
5. Ask user: "What should we call this pattern?" -> "Retry with Exponential Backoff"
6. Generate document in `.claude/docs/patterns/20260115-142345-retry-pattern.md`
7. Include: context, implementation, benefits, trade-offs

### Example 2: Documenting a Problem

**User says:** "Document how we fixed that race condition in the cache"

**Actions:**

1. Identify type: Problem-Solution
2. Load `references/templates/problem-solution.md`
3. Extract from session:
   - Problem description
   - Investigation steps
   - Solution code
   - Verification approach
4. Auto-detect metadata
5. Generate document in `.claude/docs/problems/20260115-164512-cache-race-condition.md`
6. Include: problem statement, root cause, solution, prevention measures

### Example 3: Documenting a Decision

**User says:** "Document why we chose PostgreSQL over MongoDB"

**Actions:**

1. Identify type: Decision
2. Load `references/templates/decision.md`
3. Extract from session:
   - Options considered
   - Pros/cons of each
   - Decision rationale
4. Ask user about status: "Is this Proposed or Accepted?" -> "Accepted"
5. Generate document in `.claude/docs/decisions/20260114-091530-postgresql-choice.md`
6. Include: context, options, rationale, consequences, review criteria

## Additional Resources

### Template Reference Files

Detailed templates with field descriptions:

- **`references/templates/pattern.md`** - Pattern documentation template
- **`references/templates/problem-solution.md`** - Problem-solution template
- **`references/templates/decision.md`** - Decision documentation template
- **`references/templates/guidelines.md`** - Guidelines template
- **`references/templates/session-knowledge.md`** - Session knowledge template
- **`references/templates/free-form.md`** - Free-form template

Each template file includes:

- When to use guidance
- Full template structure
- Field descriptions
- Best practices

### Working Examples

Complete, real-world examples in `examples/`:

- **`examples/pattern-example.md`** - Retry with Exponential Backoff pattern
- **`examples/problem-solution-example.md`** - Race Condition in Distributed Cache
- **`examples/decision-example.md`** - Database Choice (PostgreSQL vs MongoDB)
- **`examples/guidelines-example.md`** - Button Component Design Guidelines

Refer to examples when generating documents to match quality and detail level.

## Best Practices

### Content Quality

1. **Be specific**: Include actual code, file names, specific details
2. **Include context**: Explain why, not just what
3. **Show trade-offs**: Document alternatives and their pros/cons
4. **Add examples**: Code snippets clarify better than prose
5. **Reference files**: List specific files and their roles

### Organization

1. **Use appropriate category**: Choose template that best fits content
2. **Tag consistently**: Use suggested tag categories
3. **Follow naming**: Use timestamp-slug filename format
4. **Store logically**: Use `.claude/docs/{category}/` structure

### Writing Style

1. **Technical and precise**: Assume technical audience
2. **Concise but complete**: Cover all important aspects
3. **Markdown formatting**: Use headers, lists, code blocks properly
4. **Link related docs**: Reference other patterns/decisions when relevant

## Notes

- Documentation saved in `.claude/docs/` by default (can be overridden)
- Filename format: `YYYYMMDD-HHMMSS-slug.md` for chronological sorting
- Metadata enables search and filtering later
- Templates are guidelines - adapt content to fit actual needs
- Session Knowledge type does not require git context - use session memory directly
- Free-form template for anything that doesn't fit other categories
- Always include code examples when documenting technical content
- Document trade-offs honestly - perfect solutions don't exist
