# Problem-Solution Template

Use this template for documenting difficult problems that were solved, including complex bugs, race conditions, or significant technical challenges.

## When to Use

- Documenting a complex bug fix
- Recording resolution of a race condition or concurrency issue
- Capturing solution to a difficult technical challenge
- Sharing lessons learned from debugging a hard problem

## Template Structure

```markdown
# {problem_title}

## Metadata

- **Timestamp**: {YYYY-MM-DD HH:MM:SS}
- **Project**: {project_name}
- **Category**: Problem-Solution
- **Tags**: {comma_separated_tags}
- **Related Commit**: {commit_hash if available}
- **Severity**: {Low/Medium/High/Critical}

## Problem Statement

Clear problem description:

- What was failing?
- What was the observable symptom?
- What was the impact?

## Context

Context information:

- When did it occur?
- Under what conditions?
- Which components were involved?

### Environment

- Runtime/language version
- OS or platform
- Relevant dependency versions

## Reproduction Steps

Steps to reliably trigger the problem:

1. Step 1
2. Step 2
3. Expected vs actual result

## Investigation Process

Steps taken to investigate:

1. Step 1: findings
2. Step 2: findings
3. Step 3: findings

### Root Cause

Detailed explanation of the problem's root cause.

## Solution

### Approach

Solution approach description:

- Why was this solution chosen?
- What alternatives were considered?

### Implementation

\`\`\`{language}
// Code showing the solution
\`\`\`

### Files Modified

- `path/to/file1.ext` - Changes made
- `path/to/file2.ext` - Changes made

## Verification

How the problem resolution was verified:

- Tests added
- Manual validation
- Metrics monitored

## Prevention

Measures to prevent similar problems in the future:

- Process changes
- Additional tests
- Updated documentation

## Lessons Learned

- Lesson 1
- Lesson 2
- Lesson 3
```

## Field Guidance

Notes that add context beyond what the template structure already shows:

- **Metadata**: Timestamp and Project are auto-detected. Severity reflects user-facing impact, not code complexity.
- **Environment**: Include only versions relevant to the bug. Skip if the problem is environment-independent.
- **Reproduction Steps**: Minimal steps to trigger the issue. If non-deterministic, describe the conditions that increase likelihood.
- **Investigation Process**: Include dead ends explored -- they save time for anyone encountering a similar issue. Mention tools used (logs, profilers, debuggers).
- **Root Cause**: Be specific and technical. "Race condition" is not enough; explain which operations race and why.
- **Lessons Learned**: What would you do differently next time? What signals did you miss early on?
