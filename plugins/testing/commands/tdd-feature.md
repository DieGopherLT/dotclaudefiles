---
description: "Desarrollo de una feature nueva usando TDD estricto"
argument-hint: "<descripcion de la feature>"
---

# TDD Feature - Test-Driven Feature Development

Develop a new feature using strict TDD with the Red-Green-Refactor cycle.

**Feature to develop:** $ARGUMENTS

## Execution Pipeline

### Step 1: Quick Testability Scan

Invoke the `testability-auditor` agent focused on the area of the project where the feature will be implemented:

- Quick scan of the relevant module or directory
- Identify whether the area is testable or needs adaptation
- If the score is below 80, invoke `code-adapter` before continuing

### Step 2: Dependency Verification

Verify whether the project has testing infrastructure:

- Search for existing test files
- Verify installed testing frameworks
- If no infrastructure exists, invoke `testing-deps-investigator`
- Use `AskUserQuestion` before installing new dependencies

### Step 3: Feature Decomposition

Before writing any code, decompose the feature into testable behaviors:

1. Identify the atomic behaviors that make up the feature
2. Order them by complexity (degenerate -> simple -> general -> edge -> error)
3. Present the implementation plan to the user

### Step 4: Strict TDD Cycle

Invoke the `test-implementer` agent to implement the feature:

- For each behavior identified in Step 3:
  1. **RED**: Write a failing test
  2. Run and verify it fails for the right reason
  3. **GREEN**: Implement minimum code
  4. Run and verify it passes (full suite)
  5. **REFACTOR**: Improve if necessary
  6. Run and verify it stays green

### Step 5: Coverage Report

After the feature is complete:

- Run the language's coverage tool
- Report coverage for new/modified files
- Verify the feature reaches 80%+ coverage
- List all created tests with their names
