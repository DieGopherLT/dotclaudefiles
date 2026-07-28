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

# Code Organization

- Public API at the top of the file; private implementation details below.
- Stepdown Rule: declare each private function just below its first caller, so the
  file reads top-to-bottom — abstractions first, details last. Never order
  alphabetically. Pure utilities with no dependencies go at the bottom.
- Element order within a file: constants → types/interfaces → classes/structs →
  exported functions → private functions (by call hierarchy).
- Split a file by functionality when it grows beyond ~200 lines.
- Use a config object/struct when a function takes 3+ parameters — call sites
  become self-documenting.
- Comments only for non-obvious technical decisions (e.g. why a raw query avoids an
  ORM-induced N+1). Never narrate self-explanatory code.

## Naming

- Names state intent. Avoid unqualified generics: `data`, `info`, `handler`,
  `manager`, `helper`, `utils`.
- Booleans read as predicates: `is`/`has`/`should` prefixes.
- No abbreviations unless universally known (`url`, `id`, `http` yes; `usr`, `mgr`,
  `prod` no).