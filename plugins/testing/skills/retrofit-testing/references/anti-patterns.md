# Testing Anti-Patterns (Retrofit)

This catalog applies to writing tests for code that already exists. It does NOT assume test-first TDD — adding tests retroactively is the goal here, not a smell. What matters is that the tests, once written, actually validate behavior.

These anti-patterns map directly to the smells the `test-input-auditor` scores.

## 5 Critical Anti-Patterns

### 1. The Liar

Tests that pass but verify nothing real. They inflate coverage without validating behavior — the single most dangerous defect in a retrofit suite, because coverage numbers look healthy while regressions slip through.

**Signs:**

- Empty or trivial assertions (`assert(true)`, sole `assertNotNull`)
- Asserts the implementation detail rather than the observable behavior
- Mocks that return exactly what the test expects without verifying the interaction

**Solution:** Every test must fail if the behavior changes. Apply mutation-thinking: would this test fail if the production function body were deleted or an operator flipped? If not, it is a Liar.

### 2. The Giant

A single test that verifies many behaviors. If the test name contains "and", it is probably a giant.

**Signs:**

- Multiple unrelated assertions
- Extensive setup with many dependencies
- A failure does not clearly indicate what broke

**Solution:** One behavior per test, with a descriptive name. Structural guards (null checks, `require.NoError`) may accompany the single behavioral assertion.

### 3. The Mockery

Mock abuse: tests verify internal implementation rather than behavior, so they break on any refactor even when external behavior is unchanged.

**Signs:**

- More lines of mock setup than assertions
- Verification of internal call order
- Mocking everything except the unit under test

**Solution:** Prefer real code. Mock only at I/O boundaries (network, filesystem, databases), using the seams introduced by `testing-code-adapter`. Verify outputs, not internal interactions.

### 4. The Inspector

Tests that reach into the private internal state of the unit under test, creating fragile coupling with the implementation.

**Signs:**

- Access to private fields via reflection
- Assertions on intermediate variables that are not part of the public contract

**Solution:** Test through the public interface only. If you must inspect internal state to verify behavior, that is a signal the public API (or a missing seam) is insufficient.

### 5. The Slow Poke

Tests that depend on real I/O, timers, or external resources unnecessarily, making the suite slow and fragile. Violates Feathers' fast-unit criterion (a unit test runs in < ~100ms and touches no infrastructure).

**Signs:**

- `time.Sleep()` / `setTimeout()` / `Thread.Sleep()` in tests
- Real DB connections or HTTP calls for unit-level logic
- A single test taking more than ~100ms

**Solution:** Isolate I/O behind seams and use in-memory doubles. Reserve real integrations for separate, clearly-labeled integration tests.

## Retrofit-Specific Anti-Patterns

### Encoding a bug as correct

Writing a characterization test that pins buggy behavior and presenting it as the intended contract. The safety net is fine; the silence is not.

**Solution:** Pin current behavior for the safety net, but when it contradicts the documented contract, also add a labeled expected-failure test for the intended behavior and report the bug.

### Chasing 100%

Treating the coverage number as the goal. Diminishing returns past ~90%; some paths (panic handlers, unreachable code, trivial DTOs) are not worth covering.

**Solution:** Stop at the risk-appropriate threshold. Justify the remaining gaps explicitly rather than padding with low-value tests.

### Characterization without assertions

Calling the legacy code "to get coverage" but never pinning the observed output. This is a Liar wearing a characterization-test costume.

**Solution:** Every characterization test must assert the actual observed value, so it fails the day that value changes.

## Common Rationalizations and Reality

| Excuse | Refutation |
| ------ | ---------- |
| "It's too simple to test" | Simple code still breaks; a focused test costs little |
| "High coverage means we're done" | Coverage measures execution, not assertion strength — see `test-input-auditor` |
| "Mocks make it easier" | Over-mocking tests the mocks, not the code; refactors then break green tests |
| "The legacy behavior is weird but I'll just match it" | Match it for the safety net, but flag the discrepancy — do not bless a bug |
