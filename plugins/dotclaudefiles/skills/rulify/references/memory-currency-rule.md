# Memory-Currency Rule (Asset)

This file is the **content** that rulify writes into target projects at `.claude/rules/memory/keep-current.md` during Step 0 of the workflow. It is not a reference about how rulify works — it is the literal payload.

When Step 0 runs:

1. Check whether `<project>/.claude/rules/memory/keep-current.md` already exists.
2. If yes, leave it alone (idempotent — user may have customized it).
3. If no, write the file below verbatim, including the frontmatter.

## Why this rule belongs in every project

Module CLAUDE.md and AGENTS.md files rot. They describe the code at the moment they were written; the code keeps moving. Once they drift, they become worse than no documentation — they actively mislead the agent.

Hardcoding "remember to update me" inside every generated CLAUDE.md was the old approach (see the previous claudify template). That paid the cost N times: every memory file carried the same paragraph of motivational text, loaded into every session that touched that module.

Path-scoped rules let the same commitment exist **once**, load **only when a memory file is actually being read or edited**, and apply to **every** CLAUDE.md and AGENTS.md in the project — not just the ones claudify generated. Strictly better.

## The file rulify writes

Write this exact content (everything between the fences below) to `<project>/.claude/rules/memory/keep-current.md`:

```markdown
---
paths:
  - "**/CLAUDE.md"
  - "**/AGENTS.md"
---

# Memory File Currency

These files are the map this agent navigates by. A wrong map means lost navigation, broken assumptions, and bugs introduced because the documented behavior no longer matches the code.

## When you read a CLAUDE.md or AGENTS.md

Treat it as a hypothesis, not as truth. Before relying on a fact from the file:

- Verify symbol references resolve (`file::Symbol` should be reachable via LSP `goToDefinition`).
- Verify file paths still exist.
- Spot-check at least one claim against the actual code.

If the file disagrees with the code, the code wins — and the file is now your responsibility to fix.

## When you modify code in a module that has a CLAUDE.md or AGENTS.md

Updating the memory file is part of the same change, not a follow-up task. Specifically:

- If you changed a symbol referenced in the memory file, update the reference (or remove it if it no longer matters).
- If you changed business logic, an invariant, or a side effect documented in the file, update that section.
- If you removed a pitfall, remove it from the pitfalls list — do not let solved problems linger as warnings.
- If the change introduces a new non-obvious constraint, add it.

Outdated documentation is a critical bug, not a style issue. A future agent (you, in a fresh context) will trust this file. Make sure the file deserves that trust.

## When in doubt

If you cannot tell whether a memory file is still accurate, say so to the user. Do not silently follow a file you suspect is stale; do not silently rewrite a file without flagging that you did. Either path silently corrupts the project's institutional memory.
```

## Notes for rulify implementers

- The directory `.claude/rules/memory/` may not exist; create it.
- Do not modify or merge into an existing `keep-current.md` — if the file is there, the user owns it.
- After writing, mention the new rule in the Step 7 report so the user knows it was bootstrapped.
- The `**/CLAUDE.md` and `**/AGENTS.md` globs intentionally cover both root and nested files. Do not narrow them — the whole point is uniform coverage.
