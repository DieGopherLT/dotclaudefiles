---
name: add-testing
description: "Esta skill debe usarse cuando el usuario pide \"agregar tests a proyecto existente\", \"add testing to existing project\", \"setup de testing\", \"configurar infraestructura de tests\", \"pipeline completo de testing\", \"quiero tests para este modulo\", \"agregar cobertura de tests\", \"add test coverage\", \"integrar testing al proyecto\". Ejecuta pipeline completo de 7 pasos: auditoria de testabilidad, adaptacion condicional de codigo, investigacion de dependencias, implementacion de tests, auditoria de calidad de inputs, reporte de cobertura y generacion de reglas del proyecto."
user-invocable: true
---

# Add Testing - Full TDD Pipeline

Execute the complete TDD pipeline to add tests to an existing project or module.

**Target path:** `$ARGUMENTS` (if empty, use the current project directory)

## Pipeline

### Step 1: Testability Audit

Invoke the `testability-auditor` agent on the target path:

- Analyze coupling, global state, hidden dependencies
- Generate report with score 0-100
- Identify critical and moderate issues per file

### Step 2: Conditional Code Adaptation

If the testability score is **less than 80**:

- Invoke the `code-adapter` agent with the report from Step 1
- Apply refactorings: interface extraction, dependency injection, I/O separation
- Verify compilation after each change
- Re-evaluate score if necessary

If the score is **80 or higher**, skip to Step 3.

### Step 3: Dependency Setup

Invoke the `testing-deps-investigator` agent:

- Detect project language and ecosystem
- Evaluate existing testing dependencies
- Recommend frameworks, assertion libraries, and coverage tools
- Research recommended testing workflow for the detected stack

Use `AskUserQuestion` to confirm which dependencies to install before proceeding.

### Step 4: Test Implementation

Invoke the `test-implementer` agent module by module:

- Follow strict TDD: RED -> GREEN -> REFACTOR
- Run each test and confirm it fails before implementing
- Verify the entire suite passes after each implementation
- Cover: degenerate, simple, general, edge, and error cases

Consult `../../references/anti-patterns.md` and `../../references/rg-refactor.md` during implementation.

If the path contains multiple independent modules, process them in parallel when possible.

### Step 4.5: Test Input Quality Audit

Invoke the `test-input-auditor` agent on all test files generated in Step 4:

- Score each file from 0 to 100
- Detect anti-patterns: The Liar, The Giant, tautological assertions, hardcoded mirroring, multiple behavioral assertions per test case
- Verify input category coverage per function: degenerate, simple, edge, and error cases

If any file scores **below 80**:

- Invoke `test-implementer` again targeting only those files
- Pass the `test-input-auditor` report as context so the implementer knows which input categories and anti-patterns to address
- After re-generation, invoke `test-input-auditor` again on the re-generated files only
- Repeat until all files score 80 or higher, or until two re-generation attempts have been made — whichever comes first

If all files score **80 or higher**, proceed to Step 5.

### Step 5: Coverage Report

Run the language's coverage tool and report:

- Total coverage for the project/module
- Coverage per file
- Files below 80%
- Number of tests created
- Summary of applied refactorings (if any)

Consult `../../references/coverage.md` to interpret the report and identify files below the 80% threshold.

### Step 6: Generate Project Testing Rules

Read `../../references/project-rules-template.md` and generate `.claude/rules/testing.md` in the target project:

- Fill in the template with data discovered across Steps 1-5:
  - How to run tests and coverage (from Step 3 investigation)
  - Test organization and naming conventions (from Step 4 implementation)
  - Coverage target and exclusions (from Step 5 report)
  - Patterns established during the pipeline
- Create `.claude/rules/` directory if it does not exist
- Report the file path created to the user

## Reference Material

- **[Testing Anti-Patterns](../../references/anti-patterns.md)**: 5 critical anti-patterns and the 3 iron laws
- **[Red-Green-Refactor Cycle](../../references/rg-refactor.md)**: Detailed cycle with examples in Go, TypeScript, and C#
- **[Coverage Strategies](../../references/coverage.md)**: Tools per language, report interpretation, strategies for 80%+
- **[Project Rules Template](../../references/project-rules-template.md)**: Template for generating `.claude/rules/testing.md`
