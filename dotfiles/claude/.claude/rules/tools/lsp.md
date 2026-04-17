---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.go"
  - "**/*.py"
---

# Code Intelligence with LSP

For supported languages (TS, JS, TSX, JSX, Go, Python): **MUST use the `LSP` tool** for code navigation. `Grep`, `Glob`, and `Read` are NOT substitutes for semantic queries — they match text, not meaning.

LSP is faster and more accurate than text search: one `hover` call replaces reading multiple files; `findReferences` finds all usages without false positives from string matches; type information is exact, not inferred. Fewer tool calls, fewer tokens, higher confidence.

## Mandatory triggers

These actions REQUIRE LSP — do not skip them:

- **Before renaming a function or type**: `findReferences` to locate every call site
- **Before deleting code**: `findReferences` to confirm nothing depends on it
- **Before refactoring**: `goToDefinition` + `hover` to understand types and data flow
- **After writing or editing code**: check diagnostics — fix type errors and missing imports before moving on
- **When uncertain about a type or signature**: `hover` first, do not infer from reading

## Operations reference

- `goToDefinition` / `goToImplementation` — jump to source
- `findReferences` — all usages across the codebase
- `workspaceSymbol` — find where something is defined
- `documentSymbol` — list all symbols in a file
- `hover` — type info and signature without opening the file
- `incomingCalls` / `outgoingCalls` — call hierarchy

## When NOT to use LSP

- Searching comments, strings, or config values — use `Grep`
- Finding files by name or pattern — use `Glob`
- Non-supported file types (CSS, YAML, Markdown, shell) — use `Grep` or `Glob`

## Disambiguation

- **The `LSP` tool**: actively invoked with operations like `hover`, `findReferences`, etc. Use it on demand.
- **Editor diagnostics**: passive feedback from the IDE after editing. These are separate — do not confuse them.

"Use LSP" always means: invoke the `LSP` tool explicitly.
