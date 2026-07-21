---
paths:
  - "plugins/*/hooks/**"
---

# Verifying a Hook Change

A hook runs headless on the hot path of a tool call. A syntax error or a wrong branch does not
surface as a stack trace — it degrades to silence, and silence looks identical to "nothing to
suggest". That is why hook work is verified mechanically at every step instead of by inspection.

This rule covers the edit-verify-test loop. Check *ordering* inside a script is a separate concern —
see `hook-early-return.md`.

## The loop

1. **Edit** the script.
2. **`bash -n <script>`** immediately, before running anything. Every edit, not just the last one.
3. **Dry-run against a fixture.** Pipe a synthetic hook-input JSON into the script with
   `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_DIR` set to point at a scratch directory (or, for a
   diagnosis, read-only at the real project). Build the fixture to exercise one behavioral gate at a
   time — the trigger case, each early-return case, the malformed-input case.
4. **Clean up the temp fixture and session-marker state** before the next iteration. Stale markers
   from a previous run are the most common source of a hook that "mysteriously stopped firing".
5. Repeat until every gate matches.

For a hook whose input is a session transcript, the fixture that matters most is a *real* transcript
from `~/.claude/projects/`, not only a synthetic one — the JSONL shape has surprises (assistant
messages split across lines, repeated `usage` fields) that a hand-written fixture will not reproduce.

## JSON gates

Every edit to `hooks.json` is followed by `jq . hooks.json`. More generally, run `jq empty <files>`
over every touched JSON file before staging — a plugin with malformed JSON fails to load with no
useful error.

Structural validation of the plugin after the change is already mandatory under `use-plugin-dev.md`;
this rule does not repeat it.
