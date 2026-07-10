---
paths:
  - "plugins/*/hooks/**"
---

# Hook Early Return Ordering

When a hook script's logic includes any condition that short-circuits the rest of the run (a
terminal state, a cached outcome, a scope mismatch), put that check as early as possible in the
script — before any other parsing, computation, or I/O that the short-circuited path doesn't need.

## Why

Hooks run on the hot path of every matched tool call. A check placed after expensive work (parsing
tool input, scanning the filesystem, reading a transcript) still pays that cost even when the
outcome was already decided. Ordering checks from cheapest-and-most-terminal to
most-expensive-and-most-conditional keeps the common case (already resolved, nothing to do) as fast
as the underlying mechanism allows.

## Example

`plugins/dotclaudehooks/hooks/lsp-nudge/lsp-nudge.sh` checks three session-scoped terminal markers
(`-used`, `-warned`, `-no-match`) immediately after extracting `session_id` — before even parsing
`tool_name` or `tool_input`, since none of that is needed once a terminal marker exists. The
project-wide extension scan and the transcript parse only run when no marker has resolved the
outcome yet.
