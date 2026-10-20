# Plan template

Use this structure for every plan; omit a section only when it genuinely does not
apply (e.g. Integration contracts in a single-module change). Write the whole plan,
headings included, in the user's language.

Blocks inside `<example>` tags are illustrative: copy their field structure, not
their content, and leave the tags out of the plan.

```markdown
# Plan: <title>

## Problem
<the problem space as understood: what hurts today, why, and its boundaries.
Written to be contradicted — if this understanding is wrong, the user corrects it
here, before any solution builds on it>

## Objective
<one paragraph: what will exist after this plan that does not exist now>

## Key decisions (most likely to change on review)
<data models, type interfaces, user-facing behavior — the parts to react to>

## Alternatives considered
| Design | Approach | Opens | Closes | Outcome |
|---|---|---|---|---|
<one row per design lens explored (minimal, balanced, ideal). Outcome: chosen, or
the reason it was not. If the design step was skipped, say why in one line instead>

## Skill roster
| Skill | Phase | Purpose |
|---|---|---|

## Dependencies
| Problem | Decision | Justification |
|---|---|---|
<one row per standard problem. Decision: the chosen lib, or "manual".
Justification: one line, the reason for the lib or for going manual>

## Integration contracts
<new abstractions (interfaces, types, API endpoints) plus a connection preview,
in pseudo-code if needed: how existing code calls or implements them — caller,
arguments, order, handling of results and errors>

## Guards and gotchas
<what to be careful with, as "if X, then Y" lines: invalid states and how they
are rejected, undefined behavior and the chosen behavior, data formats (types,
units, encodings, nullability, ordering), concurrency and ordering hazards,
traps in the existing code the executor would step on>

## Files
| Path | Action | Description |
|---|---|---|

## Branching
<branch name, worktree location (default: `.claude/worktrees/<name>`, relative
to the repo; state any other location and why), base ref, and the merge
conditions: the verifications from the Verification section that must pass, and
any other gate (review, approval), as "the branch merges if and only if ..."
lines. Name the branch following the `branching` skill when it is available>

<example>
- Branch: `feat/notifier-adapters`
- Worktree: `.claude/worktrees/notifier-adapters`
- Base ref: `main` at the commit where the plan was approved
- Merge conditions:
  - The branch merges if and only if `npm run build` and `npm test` pass in the worktree.
  - If Phase 4 changed `src/checkout/service.ts`, the checkout integration test must also pass.
  - The merge waits for the user's explicit approval of the diff.
</example>

## Phases
<the breakdown, contract-defining phases first and mechanical work last. Per
phase: depends on (phases whose output it consumes, or none), files it touches,
and if sequential, the reason as "B waits for A because ...". Close with an
ASCII diagram of the execution waves: phases that can run together side by
side, arrows toward the ones that wait>

<example>
### Phase 1 - Define the `Notifier` contract
- Depends on: none
- Files: `src/notify/notifier.ts`, `src/notify/types.ts`
- Sequential: yes. Phases 2 and 3 use the `Notifier` interface this phase defines.

### Phase 2 - Email adapter
- Depends on: Phase 1
- Files: `src/notify/email.ts`, `src/notify/email.test.ts`
- Parallel with: Phase 3 (no shared files, neither consumes the other's output)

### Phase 3 - SMS adapter
- Depends on: Phase 1
- Files: `src/notify/sms.ts`, `src/notify/sms.test.ts`
- Parallel with: Phase 2

### Phase 4 - Wire adapters into checkout
- Depends on: Phases 2 and 3
- Files: `src/checkout/service.ts`
- Sequential: yes. It selects an adapter from Phases 2 and 3, so both must exist.

Execution waves:

    [1] --> [2] --+
        \         +--> [4]
         `-> [3] -+
</example>

## Verification
<per phase: how the result is verified by execution (build, tests, local run).
Local resources unrestricted; remote writes prohibited; read-only remote access,
if needed, declared here for approval. Ambiguous methods marked as such — written
to be contradicted>

## Assumptions and open unknowns
<what was assumed, what remains ambiguous and would change the plan if resolved
differently>
```