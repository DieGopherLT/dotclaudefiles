---
paths:
  - "**/*.go"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.sh"
  - "**/*.py"
---

# Logging

- Wide events over scattered log lines: emit one context-rich structured event per
  request per service, at request completion (in a `finally`/`defer`), instead of
  multiple log calls throughout the handler.
- Every event carries business context (who, what, how much — "a premium customer
  couldn't complete a $2,499 purchase", not just "checkout failed") and environment
  characteristics (commit hash, version, region, instance).
- Favor high cardinality (user IDs, request IDs) and high dimensionality (many
  fields): design events to answer questions not yet anticipated. Propagate the
  request ID across services to correlate events.
- One logger instance configured at startup, imported everywhere. JSON format,
  consistent field names across services, two levels only: `info` and `error`.
  Never log unstructured strings.

For implementation details — middleware pattern, event schemas, and common
pitfalls — invoke the `logging-best-practices` skill.