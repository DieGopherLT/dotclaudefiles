# Red-Green-Refactor Cycle

## Cycle Philosophy

The Red-Green-Refactor cycle is the heart of TDD. Each iteration produces a minimal increment of verified functionality. The discipline lies in respecting each phase without skipping any.

## RED Phase: Write a Failing Test

### Goal

Define the desired behavior through an executable test that fails.

### Process

1. Identify the next minimal behavior to implement
2. Write a test that demonstrates that behavior
3. Run the test and confirm it fails
4. Verify it fails for the right reason (missing feature, not a syntax error)

### Criteria for a Good RED Test

- Descriptive name of the expected behavior
- One behavior per test
- Shows the desired API (the test defines the design)
- Fails for the right reason

### Example by Language

**Go:**

```go
func TestCalculateDiscount_AppliesTenPercentForOrdersAboveHundred(t *testing.T) {
    order := NewOrder(150.00)

    discount := order.CalculateDiscount()

    assert.Equal(t, 15.00, discount)
}
```

**TypeScript:**

```typescript
describe('calculateDiscount', () => {
    it('should apply 10% discount for orders above 100', () => {
        const order = new Order(150.00);

        const discount = order.calculateDiscount();

        expect(discount).toBe(15.00);
    });
});
```

**C#:**

```csharp
[Fact]
public void CalculateDiscount_AppliesTenPercentForOrdersAboveHundred()
{
    var order = new Order(150.00m);

    var discount = order.CalculateDiscount();

    Assert.Equal(15.00m, discount);
}
```

## GREEN Phase: Minimum Code to Pass

### Goal

Write the simplest possible implementation that makes the test pass.

### Process

1. Implement the simplest solution (even hard-coded for a first test)
2. Run the test and confirm it passes
3. Run the full suite and confirm no regressions
4. Verify clean output (no warnings or errors)

### Strict Rules

- Do not add extra functionality "because we'll need it"
- Do not refactor during this phase
- Do not optimize prematurely
- If the solution seems trivial, it probably is (and that's fine)

### Example by Language

**Go:**

```go
func (o *Order) CalculateDiscount() float64 {
    if o.Total > 100 {
        return o.Total * 0.10
    }
    return 0
}
```

**TypeScript:**

```typescript
calculateDiscount(): number {
    if (this.total > 100) {
        return this.total * 0.10;
    }
    return 0;
}
```

**C#:**

```csharp
public decimal CalculateDiscount()
{
    if (Total > 100m)
        return Total * 0.10m;
    return 0m;
}
```

## REFACTOR Phase: Improve Without Changing Behavior

### Goal

Improve the quality of the code (production and tests) while keeping all tests green.

### Process

1. Identify improvement opportunities (duplication, names, structure)
2. Apply one refactor at a time
3. Run tests after each change
4. Confirm everything remains green

### What to Refactor

- Remove duplication (DRY applied with judgment)
- Improve names of variables, functions, types
- Extract helper functions when there is reusable logic
- Simplify complex conditionals
- Improve test structure (extract shared setup)

### What NOT to Do During Refactor

- Add new functionality
- Change observable behavior
- Introduce new dependencies
- "Prepare" code for future features

## Cycle Speed

### Fast Iterations

Each complete cycle should take between 1 and 10 minutes. If a cycle takes more than 15 minutes, the increment is too large. Split into smaller steps.

### Complexity Order

Attack cases in this order:

1. **Degenerate case**: Empty input, null, zero
2. **Simple case**: Single element, basic value
3. **General case**: Multiple elements, varied values
4. **Edge cases**: Boundaries, overflow, special characters
5. **Error cases**: Invalid inputs, unexpected states

## Bug Fixes with TDD

Never fix a bug without a test:

1. Write a test that reproduces the bug (must fail)
2. Confirm it fails for the right reason (the bug)
3. Fix the minimum code to pass the test
4. Confirm the test passes and no regressions exist
5. The test prevents future regression of the same bug

## Verification Checklist

Before considering the work complete:

- [ ] Every function has a test that was seen failing before implementation
- [ ] Minimum code written to pass each test
- [ ] All tests pass with clean output
- [ ] Real code tested (mocks minimized)
- [ ] Edge and error cases covered
- [ ] Refactoring applied without breaking tests

If any item remains unchecked: restart with TDD.
