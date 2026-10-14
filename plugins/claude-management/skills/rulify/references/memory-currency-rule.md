# Memory-Currency Rule (Asset)

This file is the **content** that rulify writes into target projects at `.claude/rules/memory/keep-current.md` during Step 0 of the workflow. It is not a reference about how rulify works — it is the literal payload.

When Step 0 runs:

1. Check whether `<project>/.claude/rules/memory/keep-current.md` already exists.
2. If yes, leave it alone (idempotent — the user may have customized it).
3. If no, write the file below verbatim.

## Why this rule belongs in every project

Module CLAUDE.md and AGENTS.md files rot. They describe the code when they were written; the code keeps moving. Once they drift, they are worse than no documentation: they mislead the agent.

Putting the "keep me updated" reminder inside each generated CLAUDE.md pays its cost once per file, in every session that touches the module. One shared rule pays it once and covers every CLAUDE.md and AGENTS.md in the project, not only the ones claudify generated.

The rule has no `paths` on purpose. A path-scoped rule loads only when Claude reads, writes, or edits a matching file, and a CLAUDE.md that enters context by auto-load does not count. Editing code in a module would never trigger a `**/CLAUDE.md` rule, and that is the moment the update is owed. The payload is short to keep the always-on cost low.

## The file rulify writes

Write this exact content (everything between the fences below) to `<project>/.claude/rules/memory/keep-current.md`:

```markdown
# Memory File Currency

CLAUDE.md and AGENTS.md files are the map this agent navigates by. A wrong map means broken assumptions and bugs introduced because the documented behavior no longer matches the code.

- When you read one, treat it as a hypothesis: check that the symbols and paths it cites still exist, and spot-check one claim against the code. If the file disagrees with the code, the code wins and the file is now yours to fix.
- When you change code in a module that has one, update it in the same change: references to changed symbols, documented logic, invariants or side effects, and pitfalls that no longer apply. Add a new non-obvious constraint if the change introduces one.
- If you cannot tell whether a file is still accurate, tell the user. Do not follow a file you suspect is stale, and do not rewrite it without saying so.
```

## Notes for rulify implementers

- The directory `.claude/rules/memory/` may not exist; create it.
- Do not modify or merge into an existing `keep-current.md` — if the file is there, the user owns it.
- After writing, mention the new rule in the Step 7 report so the user knows it was bootstrapped.
- Keep `paths` out of the payload: see the explanation above.
