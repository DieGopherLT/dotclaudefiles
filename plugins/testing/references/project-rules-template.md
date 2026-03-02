# Testing

## How to Run Tests

- **Run tests**: `[command]`
- **Run with coverage**: `[command]`
- **Watch mode**: `[command, if applicable]`

## Test Organization

- **Location**: `[co-located with source / separate test directory / other]`
- **Naming convention**: `[e.g. foo_test.go / foo.test.ts / FooTests.cs]`
- **Structure**: `[describe/it / t.Run / Fact+Theory / etc.]`

## Coverage

- **Target**: [X]% line coverage
- **Coverage report**: `[command]`
- **Exclusions**: `[generated code, DTOs, bootstrapping, etc.]`

## Patterns Established

[Brief description of patterns implemented during the testing pipeline]

## What to Test

- [Priority 1]
- [Priority 2]

## What NOT to Test

- [e.g. framework-generated code]
- [e.g. data models without logic]
- [e.g. entry points and bootstrapping]
