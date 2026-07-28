---
paths:
  - "**/*.go"
  - "**/go.mod"
---

# Go Standards

- Ensure code compiles and tests pass before submitting changes.
- Compiled binaries go to a `bin/` directory.

## Naming

- Packages: one concise word, by functionality (`http`, `json`) or domain (`auth`,
  `payment`). Design symbols for how they read from outside — the package is the
  namespace, so no redundant prefixes (`http.Client`, not `httputil.HTTPClient`).
- Constructors: `New<Type>`, or bare `New` when the package name disambiguates
  (`database.New`, not `database.NewDB`).
- GoDoc comments on all exported symbols.
- File names: snake_case.

## Errors and control flow

- Never ignore errors with `_`. Wrap with the calling function's context:
  `fmt.Errorf("processOrder: %w", err)`.
- Guard clauses everywhere: return early on `err != nil` and on `!ok` (map lookups,
  channel receives, type assertions). The happy path stays at the outermost
  indentation; no `else` after a return or error check.
- When a condition needs more than one level of nesting, extract it into a named
  predicate function — the name documents intent.
- Type switches over chains of repeated type assertions.

## Interfaces

- Define interfaces where they are consumed, not where implemented. Keep them at
  one or two methods; compose larger ones from small ones.

## Concurrency

- Name goroutines for long-running tasks (better stack traces); pass
  `sync.WaitGroup` by pointer.

## File organization

- Element order follows the Stepdown Rule from code-organization, with Go
  specifics: `package` + `import` first, then `init()` if unavoidable (avoid it),
  then const → type → exported funcs → unexported funcs by call hierarchy. Do NOT
  group by declaration kind (`var`/`type`/`func` blocks) as the community commonly
  does.
- All package types live in a single `types.go`; past ~200 lines, convert to a
  `types/` directory with one focused file per domain.

## Libraries

- On personal projects, install [samber/lo](https://github.com/samber/lo) for
  collection utilities — confirm with the user first.