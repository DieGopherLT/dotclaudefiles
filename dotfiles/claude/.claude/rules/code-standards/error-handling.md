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

# Error Handling

- Fail fast: validate inputs at system boundaries (user input, external APIs) and
  return errors immediately. Trust internal code and framework guarantees — only
  validate at boundaries.
- Error messages carry actionable context: which operation failed, with which
  values, and why. Prefix with the failing function name
  (`fetchUser: userId="abc" not found`), never a bare `Failed` or `Invalid input`.
- Never swallow errors silently. If you catch, either handle it or re-throw/wrap
  with added context.