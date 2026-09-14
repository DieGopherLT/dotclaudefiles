---
# Path-scoped rule: loads only when working on test files.
paths:
  - "[test file glob for the language]"
---

# Testing

## How to Run Tests

- **Run tests**: `[command]`
- **Run with coverage**: `[command]`
- **Watch mode**: `[command, if applicable]`

## Test Organization

- **Location**: `[co-located with source / separate test directory / other]`
- **Naming convention**: `[e.g. foo_test.go / foo.test.ts / FooTests.cs]`
- **Structure**: `[describe/it / t.Run / Fact+Theory / etc.]`

## Test Utilities

- **Location**: `[where shared builders/helpers/fixtures live]`
- **Available**: `[one bullet per utility: name, kind, usage]`
- **Convention**: reuse these before writing new setup; extract a new builder/helper/custom assertion as soon as two tests share arrangement. Avoid one-size-fits-all fixtures and external-resource dependencies.

## Coverage

- **Target**: [X]% line coverage
- **Coverage report**: `[command]`
- **Exclusions**: `[generated code, DTOs, bootstrapping, etc.]`

## Patterns Established

[One bullet per pattern actually used: characterization tests, table-driven Go, describe+it TS, Fact+Theory C#, MSW for frontend network, etc.]

## What to Test

- [Priority 1]
- [Priority 2]

## What NOT to Test

- [e.g. framework-generated code]
- [e.g. data models without logic]
- [e.g. entry points and bootstrapping]

## Known Bugs (Expected-Failure Tests)

[Only when bugs were found. One bullet per bug: module, description, name of the expected-failure test that documents it.]
