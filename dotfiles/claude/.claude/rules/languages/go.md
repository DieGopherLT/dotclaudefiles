---
paths:
  - "**/*.go"
---

# Go Standards

## General

- Always ensure code compiles and passes tests before submitting changes.
- Use a `bin` directory in projects to output compiled binaries.

## Package naming

Choose one of:

- Functionality: single concise word (`http`, `json`, `storage`)
- Domain/context: (`auth`, `payment`, `storage`)

### Symbol naming inside a package

- Think of the package as a namespace — avoid redundant prefixes (`util.UtilFunction` is bad)
- Think how the symbol looks when used outside (`http.Client`, `json.Marshal`)
- Exported symbols: PascalCase (`GetUser`, `ProcessData`)
- Unexported symbols: camelCase (`calculateSum`, `fetchData`)
- Constructors: `New<Type>` (`NewClient`, `NewServer`) — unless package name makes it obvious (`database.New` not `database.NewDB`)
- Always add GoDoc comments to exported symbols.

## Error handling

- Always handle errors; never ignore them with `_`.
- Wrap errors with context using `fmt.Errorf("doing X: %w", err)` to preserve the chain.
- Return early on error — do not nest the happy path inside `if err == nil`.

```go
// Bad - ignored error
result, _ := doSomething()

// Bad - nested happy path
result, err := doSomething()
if err == nil {
  // logic...
}

// Good - early return with context
result, err := doSomething()
if err != nil {
  return fmt.Errorf("processOrder: %w", err)
}
// happy path continues...
```

## Interfaces

- Define interfaces where they are consumed, not where they are implemented.
- Keep interfaces small — one or two methods is ideal.
- Use composition to build larger interfaces from smaller ones.

```go
// Bad - large monolithic interface
type Storage interface {
  Get(id string) (Item, error)
  Set(id string, item Item) error
  Delete(id string) error
  List() ([]Item, error)
}

// Good - small, composable
type Reader interface { Get(id string) (Item, error) }
type Writer interface { Set(id string, item Item) error }
type ReadWriter interface { Reader; Writer }
```

## Concurrency

- Do not use anonymous goroutines for long-running tasks; name them for better stack traces.
- When using `sync.WaitGroup`, pass it by pointer to goroutines.

## File organization

- Use a single `types.go` file for all package types.
- If `types.go` exceeds ~200 lines, convert it to a `types/` directory with focused files per domain (e.g., `types/user.go`, `types/payment.go`).

## Libraries

Always install on personal projects (confirm with user first):

- [samber/lo](https://github.com/samber/lo) — lodash-like collection utilities for Go.
