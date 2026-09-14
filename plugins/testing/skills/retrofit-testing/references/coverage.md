# Coverage Policy

No universal number. The orchestrator sets the target per module from risk: money/auth/data-integrity 0.85-0.90, standard logic 0.80, wrappers and DTOs excluded. Coverage proves execution, not assertion strength; `test-input-auditor` answers the second question, and a high-coverage suite of Liars is worse than a smaller honest one.

## Exclude from the coverage denominator

- Configuration files
- Generated code
- DTOs/models without logic
- Entry points (main, bootstrap)
- Trivial infrastructure adapters (direct wrappers)

## Prioritize

Risk and churn first: use version-control history to find the most-changed files and put those under test before low-traffic code. A small set of tests on critical paths beats broad shallow coverage. Diminishing returns past ~90%; panic handlers and unreachable code are not worth covering.

Run and coverage commands come from `testing-deps-investigator` at runtime (`runCommand`/`coverageCommand`) or from the project's existing setup, not from this file.
