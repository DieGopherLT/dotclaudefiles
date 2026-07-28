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

For supported languages (TS, JS, TSX, JSX, Go, Python), the `LSP` tool is the
navigation method of choice: it queries meaning, not text. One `hover` replaces
reading multiple files; `findReferences` has no false positives from string
matches; type information is exact rather than inferred. Fewer tool calls, fewer
tokens, higher confidence than `Grep`/`Glob`/`Read` chains.

Although is a deferred tools, enabling it is worth for accurate code navigation and understanding.

## Standard triggers

- Before renaming or deleting a symbol: `findReferences` to locate every dependent.
- Before refactoring: `goToDefinition` + `hover` to understand types and data flow.
- After writing or editing code: check diagnostics; fix type errors and missing
  imports before moving on.
- When uncertain about a type or signature: `hover` beats inferring from reading.

## Operations

`goToDefinition` / `goToImplementation`, `findReferences`, `workspaceSymbol`,
`documentSymbol`, `hover`, `incomingCalls` / `outgoingCalls`.

## Where text search still wins

Comments, strings, config values → `Grep`. Files by name/pattern → `Glob`.
Unsupported file types (CSS, YAML, Markdown, shell) → `Grep`/`Glob`.

## Disambiguation

"Use LSP" means invoking the `LSP` tool explicitly with its operations — not the
passive editor diagnostics that arrive after edits.