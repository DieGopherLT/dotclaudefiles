# Retrofit Testing Policy

The scored smell catalog (Liar, Giant, Mystery Guest, snapshot trap, and the rest) lives in `test-input-auditor`'s body, weighted by severity. This file holds only the retrofit-specific rules that catalog does not cover.

## Encoding a bug as correct

Pin current behavior for the safety net, but when it contradicts the documented contract, also add a labeled expected-failure test for the intended behavior and report it in `bugsFound`. The net is fine; the silence is not.

## Chasing the number

Stop at the risk-appropriate threshold from `coverage.md`. Justify remaining gaps explicitly rather than padding with low-value tests.

## Characterization without assertions

Every characterization test asserts the observed value, so it fails the day that value changes. Calling legacy code "for coverage" without pinning output scores as THE_LIAR.
