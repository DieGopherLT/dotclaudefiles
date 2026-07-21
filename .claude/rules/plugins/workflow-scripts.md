---
paths:
  - "plugins/*/skills/*/scripts/*.js"
---

# Workflow Scripts

A `scripts/workflow.js` shipped inside a skill is a Dynamic Workflow script: plain JavaScript the
Workflow tool executes to orchestrate sub-agents. It runs in a restricted sandbox, and its job is to
own every deterministic decision so the invoking skill step stays mechanical.

## Sandbox constraints

No `Date.now()`, no `new Date()`, no `Math.random()`, no filesystem access. The first three are
blocked because they would break resume semantics — a resumed run replays cached agent results and
must reach the same decisions. There is no TypeScript: type annotations, interfaces, and generics
fail to parse.

Anything the script cannot compute is passed in as an explicit arg:

- Timestamps — the invoking skill step captures them (`date -u +%Y-%m-%dT%H:%M:%SZ`) and passes them.
- Repo root — passed as an explicit `repoRoot` arg.

## The script owns normalization and serialization

Path normalization to repo-relative happens once, inside the script, for the domain path **and for
each individual finding's file path**. The calling agent never re-does it ad hoc.

The script returns a fully serialized `files: [{ path, content }]` array, with `path` being the
complete target path rather than a slug the agent has to assemble. That reduces the corresponding
`SKILL.md` step to a single literal instruction: *write each entry of the returned array verbatim*.
Every piece of assembly left to the agent is a place where two runs diverge.

## One script, one data table

Variability across a small number of related orchestration variants — effort bands, review depths,
per-mode agent rosters — belongs in a data table inside one script. Do not duplicate near-identical
workflow scripts per variant; the copies drift and only one of them gets the next fix.
