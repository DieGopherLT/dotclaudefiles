---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/package.json"
---

# TypeScript and JavaScript

- Before installing, updating or removing dependencies, detect the project's
  package manager (npm, yarn or pnpm) and use it consistently.
- File names: kebab-case (`auth-service.ts`, `use-auth.ts`). Never camelCase — it
  breaks on case-sensitive file systems.

## Types

- `interface` for object shapes that may be extended; `type` for unions,
  intersections and aliases.
- `unknown` + type guards over `any`; type guards over assertions (`as`) unless
  there is no alternative.
- Generics to avoid duplicating near-identical signatures.
- No inline object/array literals inside ternaries — define both branches outside.

## Promises

- Default to `Promise.allSettled()`; use `Promise.all()` only when fail-fast is the
  desired semantics.
- Never `async` callbacks inside `forEach` — map to an array of promises and await
  them collectively.