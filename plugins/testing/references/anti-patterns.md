# Testing Anti-Patterns and Iron Laws

## The 3 Iron Laws of TDD

### 1. Never write production code without a failing test first

This is the fundamental law. All production code must be born from a failing test. If code was written before tests, that code must be deleted entirely and reimplemented from tests. No exceptions for "reference" or "adaptation".

### 2. Never write more test than necessary to produce a failure

Write a single minimal test that demonstrates the desired behavior. Do not write multiple tests at once. Confirm it fails for the right reason before proceeding.

### 3. Never write more production code than necessary to pass the test

Implement the simplest possible solution that makes the test pass. Avoid over-engineering, YAGNI violations, or feature creep. Do not refactor other code during this phase.

## 5 Critical Anti-Patterns

### 1. The Liar

Tests that pass but verify nothing real. They appear to provide coverage without validating behavior.

**Signs:**

- Empty or trivial assertions (`assert(true)`)
- Tests that verify the implementation rather than the behavior
- Mocks that return exactly what the test expects without verifying interaction

**Solution:** Every test must be able to fail if the behavior changes. Apply mutation testing to detect liar tests.

### 2. The Giant

Tests that verify too many behaviors in a single case. If the test name contains "and", it is probably a giant.

**Signs:**

- Multiple unrelated assertions
- Extensive setup with many dependencies
- Test name describes multiple actions
- Test failure does not clearly indicate what broke

**Solution:** One behavior per test. Split into focused tests with descriptive names.

### 3. The Mockery

Mock abuse that results in tests verifying internal implementation rather than behavior. Tests break on any refactor even when external behavior does not change.

**Signs:**

- More lines of mock setup than assertions
- Tests break when refactoring without changing behavior
- Verification of internal call order
- Mocking everything except the unit under test

**Solution:** Prefer real code over mocks. Use mocks only for I/O boundaries (network, filesystem, databases). Verify outputs, not internal interactions.

### 4. The Inspector

Tests that access private internal state of the unit under test. They create fragile coupling with the implementation.

**Signs:**

- Access to private fields via reflection
- Tests that know the internal structure of the class
- Verification of intermediate variables that are not part of the public contract

**Solution:** Test only through the public interface. If you need to inspect internal state, it is a sign that the public API is insufficient.

### 5. The Slow Poke

Tests that depend on real I/O, timers, or external resources unnecessarily. They make the test suite slow and fragile.

**Signs:**

- `time.Sleep()` / `setTimeout()` / `Thread.Sleep()` in tests
- Real database connections for unit tests
- Real HTTP calls for business logic
- Tests that take more than 100ms individually

**Solution:** Isolate I/O behind interfaces. Use in-memory implementations for tests. Reserve real integrations for separate integration tests.

## Common Rationalizations and Reality

| Excuse | Refutation |
|--------|------------|
| "It's too simple to test" | Simple code breaks; testing takes minimal effort |
| "I'll test it later" | A test that passes immediately proves nothing about the function |
| "Manual testing is enough" | Ad-hoc testing lacks systematic coverage and repeatability |
| "Deleting X hours of work is waste" | Sunk cost fallacy; unverified code is technical debt |
| "Tests after = same result" | Tests-first answer "what should happen"; tests-after answer "what I built" |

## Red Flags That Require Restart

- Writing code before tests
- Tests that pass immediately when written
- Tests added retroactively
- "Just this once" rationalizations
- "I've already spent X hours on this"
- Keeping code as reference while writing tests
