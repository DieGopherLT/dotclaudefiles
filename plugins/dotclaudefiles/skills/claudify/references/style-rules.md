# Claudify Style Rules (Reference)

Apply these when writing or rebuilding a module CLAUDE.md.

## Size budget

- **Hard ceiling**: 200 lines (official Claude Code memory ceiling).
- **Practical target**: 150 lines.

Past 150 lines, adherence drops sharply. The file becomes background noise instead of read-on-load context. If you are over budget, the fix is almost always "this section contains content the agent could infer from the code" — cut that first.

## The `file::Symbol` LSP format

Use `file::Symbol` (or `file::Class.method`) for any reference to code:

```
auth::validateToken
session-store::SessionStore.findById
config::DEFAULT_TIMEOUT_MS
```

Why this format:

- **goToDefinition**: LSP jumps directly to the exact line.
- **findReferences**: returns only real usages — no false positives from comments or strings.
- **hover**: types and docs without reading the file.
- **documentSymbol**: file structure without reading the file body.

Plain prose ("the validateToken function in auth.ts") is ambiguous and not LSP-resolvable. Use it only inside flowing sentences where the symbol notation would break readability.

## Description length

- File descriptions: under 20 words.
- Symbol descriptions: under 20 words.
- Overview: 1-2 sentences total.

If a description does not fit in 20 words, the description is doing too much. Either it is restating what the symbol name already says (cut it) or it is hiding multiple concerns (split the symbol).

## Bullets over paragraphs

Bullets scan; paragraphs do not. Default to bullets for:

- Entry points, key files, dependencies, pitfalls, env vars
- Any list of independent items

Use prose only when the items have flow that bullets would break — typically `Overview`, `Business Logic`, `Architecture`.

## "Why" beats "what"

The code tells you what. The CLAUDE.md tells you why.

| Bad ("what") | Good ("why") |
|---|---|
| "Validates the JWT and returns the user ID" | "Single trust boundary — downstream code assumes this stamp" |
| "Caches results in memory for 5 minutes" | "5-minute TTL chosen to match upstream rate-limit window" |
| "Throws if amount is negative" | "Negative amounts caused silent inversions in v1.2 — guard added in v1.3" |

If you cannot answer "why" for a line, it is probably not worth writing.

## What to omit

- Function/class signatures (LSP `hover` covers this)
- File listings that match the directory tree (the agent can `ls`)
- Generic advice ("write tests", "handle errors")
- Restating types that are visible from the code
- Self-referential ceremony ("this is a map", "I commit to update")
- Dates and verification timestamps
- Empty sections kept "for completeness"

## Heading discipline

- One `#` H1 (the module name).
- Use `##` for top-level sections from the template.
- Avoid `####` — if you need four levels of nesting, the file is too dense.
- Do not invent new top-level sections beyond the template without a clear reason.

## Code blocks in the CLAUDE.md

Keep them short. A module CLAUDE.md is not a tutorial. If an example needs more than 10-15 lines to make its point, the example is showing too much — extract the non-obvious part and link to the test or implementation that demonstrates the rest.
