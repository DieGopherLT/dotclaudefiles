---
name: post-implementation
description: Esta skill debe usarse cuando el usuario pide "haz review de los cambios", "review the changes", "aplica el post-implementacion", "apply post-implementation", "run post-implementation", o cuando el plan aprobado instruye "invoke /smart-plan:post-implementation". Ejecuta workflow post-implementacion despues de que el codigo este completo con quality review (3 reviewers paralelos), auto-fix de issues (confianza >= 80%), documentacion del feature, y commit opcional. Puede usarse despues de cualquier implementacion, no solo smart-plan.
---

# Post-Implementation Procedure

Execute quality review, refactoring, and finalization after code implementation is complete.

## Prerequisites

- Code implementation complete (files created/modified)
- Working directory in project root
- Optional: List of files to review (if not provided, detect from git status)

## Phase 1: Quality Review

**Goal**: Find real issues in implemented code with confidence-scored findings.

### Step 1: Collect modified files

Obtain list of all created/modified files:

```bash
git status --short
git diff --name-only HEAD
```

Or use file list provided by plan/user.

### Step 2: Launch parallel reviewers

Launch 3 code-reviewer agents simultaneously with different review focuses:

#### Reviewer 1 - Simplicity / DRY / Elegance

```
Task(
  subagent_type: "smart-plan:code-reviewer",
  prompt: "Review the following files for code quality:
[list of files]

Focus: simplicity, DRY principle, code elegance, unnecessary complexity.
Only report findings with confidence >= 80%.
Include concrete fix suggestions for each finding."
)
```

#### Reviewer 2 - Bugs / Functional Correctness

```
Task(
  subagent_type: "smart-plan:code-reviewer",
  prompt: "Review the following files for bugs and logic errors:
[list of files]

Focus: bugs, logic errors, edge cases, error handling, race conditions, null safety.
Only report findings with confidence >= 80%.
Include concrete fix suggestions for each finding."
)
```

#### Reviewer 3 - Conventions / Abstractions

```
Task(
  subagent_type: "smart-plan:code-reviewer",
  prompt: "Review the following files for convention adherence:
[list of files]

Project conventions:
[key conventions from project CLAUDE.md, package.json, or codebase patterns]

Focus: naming conventions, architectural patterns, import organization, abstraction quality.
Only report findings with confidence >= 80%.
Include concrete fix suggestions for each finding."
)
```

### Step 3: Consolidate findings

1. Collect all findings from 3 reviewers
2. Deduplicate overlapping issues
3. Filter: keep only findings with confidence >= 80%
4. Present consolidated review to user

### Step 4: Display results

Present consolidated findings to user with:

- File path and line number
- Issue description
- Confidence score
- Concrete fix suggestion

## Phase 2: Refactoring

**Goal**: Auto-fix review findings with high confidence.

### Step 1: Evaluate findings

If findings with confidence >= 80% exist from Phase 1:

Launch code-refactorer agent:

```
Task(
  subagent_type: "smart-plan:code-refactorer",
  prompt: "Apply the following corrections to the codebase:

[list of findings with confidence >= 80%, including file paths, line numbers, and suggested fixes]

After applying ALL corrections:
1. Run build/compile check
2. Run tests (if test suite exists)
3. Run linter (if configured)

Report all changes made and validation results."
)
```

### Step 2: Review refactorer report

Review refactorer's report:

- If validation passed: proceed to finalization
- If validation failed: present failures to user for decision

If no findings >= 80%:

- Skip this phase
- Inform user code passed review without critical issues

## Phase 3: Finalization

**Goal**: Document, summarize, and optionally commit.

### Step 1: Write feature summary

Derive kebab-case name from feature description (e.g., "add-user-authentication").

If feature was planned with smart-plan, use plan name. Otherwise, generate descriptive name.

Write summary to `.claude/features/<feature-name>.md`:

```markdown
# <Feature Name>

## What Was Built

- [Feature description and scope]

## Files Created

- [List with brief description of each]

## Files Modified

- [List with brief description of changes]

## Review Results

- [Summary of review findings and fixes applied]
- [Number of issues found and auto-fixed]
- [Manual fixes needed (if any)]

## Dependencies Added

- [New packages installed, if any]

## Next Steps

- [Suggested follow-up actions]
- [Tests to add or expand]
- [Documentation to write or update]
```

### Step 2: Present summary to user

Show feature summary file path and brief summary of accomplishments.

### Step 3: Ask about committing changes

Use AskUserQuestion to determine if user wants to commit:

If yes:

1. Follow user's git conventions (conventional commits)
2. Stage specific files (avoid `git add .` or `git add -A`)
3. Single-line commit message (max 96 chars)
4. Execute `git status` to verify commit success

If no:

- Inform user changes are ready for manual review

### Step 4: Suggest next steps

Provide potential follow-up actions:

- Tests to add or expand
- Documentation to write or update
- Related features to consider
- Performance optimizations
- Security hardening

## Orchestration Rules

**Progress tracking:**

- If tasks created for phases exist, update status (in_progress/completed) at phase start/end
- Consolidate agent outputs before presenting to user

**User interaction:**

- Be transparent about current phase and actions
- Present consolidated findings, not raw agent outputs
- Request approval at key decision points (commit in Phase 3)

**Failure handling:**

- If agent fails, inform user and offer retry or adjustment
- If build/test validation fails, present failures and request guidance
- Never proceed silently when errors occur

## Common Issues

**Issue**: Cannot find modified files

**Solution**: Execute `git status` to detect changes, or ask user for file list

**Issue**: Review produces too many low-confidence findings

**Solution**: Filter strictly for confidence >= 80%; present only actionable issues

**Issue**: Refactorer breaks tests

**Solution**: Refactorer should run tests; if tests fail, present to user for manual fix

**Issue**: No detectable project conventions

**Solution**: Search for CLAUDE.md, README.md, or analyze codebase patterns; ask user if needed

## Summary

This skill executes a structured post-implementation workflow:

1. **Quality Review**: Review code with 3 parallel reviewers (confidence >= 80%)
2. **Refactoring**: Auto-fix findings with code-refactorer agent
3. **Finalization**: Document feature, optionally commit, suggest next steps

Can be used after any implementation, not just smart-plan. Be transparent with user. Fail gracefully when issues occur.
