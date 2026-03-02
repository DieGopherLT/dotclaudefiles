# Coverage Strategies by Language

## Coverage Goal

The base target is **80%+ line coverage** for production code. This number is not an end in itself, but an indicator that TDD is being applied correctly. If strict TDD is followed, high coverage is a natural consequence.

## What to Measure and What Not To

### Measure

- Line coverage: primary metric
- Branch coverage: complementary for conditionals
- Business logic code: top priority
- Public functions of libraries/packages

### Do Not Measure (exclude from reports)

- Configuration files
- Automatically generated code
- DTOs/models without logic
- Entry points (main, bootstrap)
- Trivial infrastructure adapters (direct wrappers)

## Go

### Tools

**go test (built-in):**

```bash
# Basic coverage
go test -cover ./...

# Generate coverage profile
go test -coverprofile=coverage.out ./...

# View coverage per function
go tool cover -func=coverage.out

# Interactive HTML report
go tool cover -html=coverage.out -o coverage.html
```

**Advanced options:**

```bash
# Coverage with race detector across multiple packages
go test -race -coverprofile=coverage.out -covermode=atomic ./...

# Exclude specific packages
go test -coverprofile=coverage.out $(go list ./... | grep -v /generated/ | grep -v /mocks/)
```

### Go Coverage Patterns

- Use `t.Run` for subtests that cover multiple branches
- Table-driven tests generate high coverage naturally
- `testdata/` for file fixtures
- Build tags `//go:build integration` to separate integration tests

### Interpretation

```
ok    mypackage    0.003s    coverage: 85.2% of statements
```

- `85.2%` is the package statement coverage
- Packages below 60% need immediate attention
- `coverage.html` shows uncovered lines in red

## TypeScript

### Tools

**Vitest (recommended):**

```bash
# Coverage with vitest
vitest run --coverage

# With specific provider
vitest run --coverage --coverage.provider=v8

# With thresholds
vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.branches=75
```

Configuration in `vitest.config.ts`:

```typescript
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.d.ts',
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/**/index.ts',
                'src/types/**',
            ],
            thresholds: {
                lines: 80,
                branches: 75,
                functions: 80,
                statements: 80,
            },
        },
    },
});
```

**Jest:**

```bash
# Coverage with jest
jest --coverage

# With thresholds in jest.config.ts
coverageThreshold: {
    global: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
    },
},
```

**c8 (standalone for Node.js):**

```bash
c8 node --test
c8 report --reporter=html
```

### TypeScript Coverage Patterns

- Co-locate tests (`feature.test.ts` alongside `feature.ts`)
- `describe`/`it` to organize by behavior
- AAA pattern (Arrange-Act-Assert) in each test
- Testing Library for UI components

### Interpretation

```
-----------|---------|----------|---------|---------|
File       | % Stmts | % Branch | % Funcs | % Lines |
-----------|---------|----------|---------|---------|
All files  |   87.23 |    75.00 |   90.00 |   87.23 |
 utils.ts  |   95.00 |    85.71 |  100.00 |   95.00 |
 api.ts    |   72.00 |    60.00 |   80.00 |   72.00 |
-----------|---------|----------|---------|---------|
```

- Low `% Branch` files have untested conditionals
- Low `% Funcs` indicates exported functions without tests

## C #

### Tools

**coverlet (recommended with xUnit):**

```bash
# Basic coverage
dotnet test --collect:"XPlat Code Coverage"

# With reportgenerator for HTML
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage
reportgenerator -reports:"coverage/**/coverage.cobertura.xml" -targetdir:"coverage/report" -reporttypes:Html

# With thresholds
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line
```

Configuration in `.runsettings`:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<RunSettings>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector friendlyName="XPlat code coverage">
        <Configuration>
          <Format>cobertura</Format>
          <Exclude>[*]*.Migrations.*,[*]*.Program,[*]*.Startup</Exclude>
          <ExcludeByAttribute>GeneratedCodeAttribute,CompilerGeneratedAttribute</ExcludeByAttribute>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>
```

**dotnet-coverage (alternative):**

```bash
dotnet-coverage collect "dotnet test" --output coverage.xml --output-format cobertura
```

### C# Coverage Patterns

- `[Fact]` for simple tests, `[Theory]` with `[InlineData]` for parameterized tests
- Separate test projects (`MyProject.Tests`)
- `FluentAssertions` for readable assertions
- `Moq` or `NSubstitute` for I/O dependencies

### Interpretation

```
+----------+------+--------+--------+
| Module   | Line | Branch | Method |
+----------+------+--------+--------+
| MyApp    | 82%  | 71%    | 88%    |
+----------+------+--------+--------+
```

- Low `Branch` indicates `if`/`switch` without all branches covered
- Low `Method` indicates untested public methods

## Strategies to Reach 80%+

### 1. Identify Uncovered Code

Generate HTML report and review files with lower coverage. Prioritize:

- Critical business logic
- Public functions of APIs
- Code with complex conditionals

### 2. Apply TDD for New Code

All new code must follow Red-Green-Refactor. Coverage for new code should be 90%+.

### 3. Add Tests to Existing Code (Retrofit)

For existing code without tests:

1. Write characterization tests that document current behavior
2. Refactor for testability if necessary
3. Add focused behavior tests

### 4. Do Not Chase 100%

- 100% coverage does not guarantee absence of bugs
- Diminishing returns after 90%
- Focus effort on high-risk code
- Some paths (panic handlers, unreachable code) are not worth covering

### 5. CI/CD Integration

Configure coverage thresholds in CI to prevent regressions:

- Pull requests cannot reduce overall coverage
- New code must meet minimum threshold
- Coverage reports as PR comments
