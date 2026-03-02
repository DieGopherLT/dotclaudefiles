---
name: tdd-workflow
description: "Esta skill debe usarse cuando el usuario pide \"aplicar TDD\", \"desarrollo guiado por tests\", \"test-driven development\", \"red green refactor\", \"ciclo RGR\", \"escribir tests primero\", \"nueva feature con TDD\", \"mejorar testabilidad\", \"filosofia TDD\", o menciona Iron Laws, TDD philosophy, o quiere entender el proceso TDD. NO usar cuando el usuario pide agregar tests a un proyecto existente o setup de testing — eso es testing:add-testing."
user-invocable: true
---

# TDD Workflow — Navigation Index

Read `metadata.json` in this directory to load the system abstract and resource map.

## Delegation

Before proceeding, evaluate the user's intent:

- **Adding tests to an existing project** (setup, coverage, pipeline): delegate to `testing:add-testing`
- **New feature development with strict TDD** (write tests first, then implement): delegate to `testing:tdd-feature`
- **TDD philosophy, Iron Laws, cycle mechanics, anti-patterns**: continue here and use the reference map below

## Iron Laws (Quick Reference)

Three non-negotiable rules that define TDD:

1. **Never write production code without a failing test first.** All code is born from a red test.
2. **Never write more test than necessary to produce a failure.** One minimal test, one behavior.
3. **Never write more production code than necessary to pass the test.** The simplest solution that makes the test pass.

Violating any law invalidates the entire process. See `../../references/anti-patterns.md` for detailed consequences and examples.

## Red-Green-Refactor Cycle (Quick Reference)

Each iteration produces a minimal increment of verified functionality:

1. **RED**: Write a failing test. Run it. Confirm it fails for the right reason.
2. **GREEN**: Write the minimum code to pass the test. Run the full suite. Confirm zero regressions.
3. **REFACTOR**: Improve code and tests without changing behavior. Run the suite after each change.

Each cycle: 1-10 minutes. If a cycle exceeds 15 minutes, the increment is too large — split it.

See `../../references/rg-refactor.md` for detailed examples in Go, TypeScript, and C#.

## Reference Map

| Concept | Impact | File |
|---------|--------|------|
| Anti-patterns and Iron Laws | Avoid the 5 critical TDD failures | `../../references/anti-patterns.md` |
| Red-Green-Refactor mechanics | Step-by-step cycle with multi-language examples | `../../references/rg-refactor.md` |
| Coverage strategies | Tools per language, report interpretation, 80%+ strategies | `../../references/coverage.md` |
| Project rules template | Template for generating `.claude/rules/testing.md` in target project | `../../references/project-rules-template.md` |

## Available Agents

| Agent | Function | When to invoke |
|-------|----------|----------------|
| `testability-auditor` | Analyzes code testability, score 0-100 | Before writing tests for existing code |
| `code-adapter` | Refactors for testability without changing behavior | When testability score is below 80 |
| `testing-deps-investigator` | Investigates and recommends testing dependencies | When project has no test infrastructure |
| `test-implementer` | Implements tests with strict TDD | To write tests following Red-Green-Refactor |
