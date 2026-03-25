# Code Intelligence with LSP

Prefer `LSP` tool over `Grep`, `Glob`, or `Read` for code navigation. LSP provides semantic understanding of the code -- not just text matching.

## Operations reference

- `goToDefinition` / `goToImplementation` -- jump to source
- `findReferences` -- all usages across the codebase
- `workspaceSymbol` -- find where something is defined
- `documentSymbol` -- list all symbols in a file
- `hover` -- type info without reading the file
- `incomingCalls` / `outgoingCalls` -- call hierarchy

## When to use LSP

- **Before renaming or changing a function signature**: use `findReferences` to find all call sites first
- **Before deleting code**: use `findReferences` to verify nothing depends on it -- this prevents false positives where text search would miss indirect usages or match irrelevant strings
- **When refactoring**: use `goToDefinition` and `hover` to understand types, interfaces, and data flow before making structural changes. LSP reveals the actual type relationships that reading code alone can miss
- **To understand types quickly**: use `hover` to inspect types, return values, and signatures without opening the file. This is faster and more accurate than inferring types from reading code
- **To verify gathered information**: use LSP as a double-check when you have collected information about the code from other sources (Read, Grep, context). `hover`, `goToDefinition`, and `findReferences` confirm that your understanding of types, signatures, and relationships is correct before acting on it
- **After writing or editing code**: check `LSP` diagnostics before moving on. Fix any type errors or missing imports immediately

## When NOT to use LSP

- Text/pattern searches (comments, strings, config values) -- use `Grep` or `Glob`
- File discovery by name -- use `Glob`
- If no LSP is available for the file type, fallback to `Grep` or `Glob`

## Disambiguation

Do not confuse the `LSP` tool with editor diagnostics. They are separate things:

- **Editor diagnostics**: errors, warnings, and type issues that appear automatically after editing a file or that you can query via IDE integration tools. These are passive feedback from the environment.
- **The `LSP` tool**: a tool in your toolset that you actively invoke with operations like `hover`, `goToDefinition`, `findReferences`, etc. This is for querying code structure and relationships on demand.

When these rules say "use LSP", they always mean: invoke the `LSP` tool explicitly.
