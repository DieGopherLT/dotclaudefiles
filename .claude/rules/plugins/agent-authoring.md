---
paths:
  - "plugins/*/agents/**"
  - ".claude/agents/**"
---

# Sub-Agent Authoring

Conventions for writing a new sub-agent `.md` file, whether it ships inside a plugin or lives at
project level under `.claude/agents/`.

## Frontmatter

Field order is `name` -> `description` -> `tools` -> `model` -> `effort` -> `color`, with `memory`
last when present. `effort` and `memory` are optional; when absent the remaining fields keep their
relative order. This order holds across every agent file in the repo.

Write `description` as a `>` block. For a read-only agent, the block ends with the literal sentence
`Never modifies any file.` — this is the convention for new agents. Older families
(`domain-restructure`, `testing`, `typescript-migration`) use plain non-`>` Spanish descriptions
with equivalent wording; leave them as they are, but do not copy that shape into new work.

## Tools: least privilege, not least capability

A read-only agent **never gets `Write` or `Edit`**. That part is absolute — no exceptions, not even
to "let the reviewer note something down".

`Bash` is not banned for read-only agents. Several in this repo combine "never modifies files" with
`Bash` because their investigation genuinely needs it: `domain-restructure`'s scanners and auditors,
`typescript-migration`'s `migration-auditor`, `testing`'s `testing-deps-investigator`, and
`claude-management`'s own `transcript-digester` and `practice-verifier`. What decides the tool list
is what the agent must *read*, not a blanket prohibition.

`task-harness`'s diff auditors omit `Bash` for a specific reason worth understanding: the patch is
generated once by the orchestrating skill and passed to them by path, so there is nothing left to
shell out for. Absence of `Bash` there is a consequence of the design, not a rule about auditors.

A skill that runs forked and backgrounded (`context: fork`) and whose deliverable is a **written
file** must be backed by an agent whose `tools` include `Write` and `Edit`. The forked sub-agent is
the one producing the artifact; there is no channel by which the parent writes it on the agent's
behalf. `claude-management`'s `module-documenter` is the worked example.

## Persistent memory

Use the native `memory: user|project|local` frontmatter field. It provisions a scoped directory
(`.claude/agent-memory/<agent-name>/` for `project`), injects that directory's `MEMORY.md` into the
system prompt, and auto-enables `Read`, `Write`, and `Edit`. Never hand-roll a notes file the agent
reads and writes itself.

Caveat worth checking on a memory-enabled agent: an explicit `tools:` allowlist that omits
`Write`/`Edit` has been reported to silently override the auto-grant, leaving `MEMORY.md` never
created (anthropics/claude-code#57507, reproduced on v2.1.137, closed as inactive rather than
fixed). If the agent's memory directory stays empty in practice, list `Write` and `Edit` explicitly
despite the docs saying it is redundant.

## Model and effort

Calibrate by how deterministic the task is, not by how important it feels:

- Mechanical scans and extraction: `sonnet` + `low`/`medium`. This is sonnet's whole range here.
- Adversarial judgment, design reasoning, cross-file inference — anything needing `high` or above:
  `opus`. Not "sonnet unless it struggles" — `opus` from the start.

**`sonnet` never gets `effort: high`.** Operationally, sonnet at `high` costs more per task than
opus does, so the combination buys a weaker model at a higher price. The moment a role needs `high`,
the model decision is already made: use `opus`. `sonnet` + `xhigh`/`max` is worse still and never
correct.

The repo already reflects this: `task-harness`'s five `effort: high` roles — `removed-behavior-auditor`,
`cross-file-tracer`, `altitude-auditor`, `gap-sweeper`, `finding-verifier` — run on `opus`, while
the mechanical angles stay on `sonnet`.

The full per-model effort support matrix lives in the `claude-code-agent-creator` skill at
`references/thinking-load.md` — read it there rather than restating it here.

## Body

Keep the system prompt to the agent's own methodology. Step-by-step orchestration mechanics belong
in the `SKILL.md` that becomes the agent's task prompt; duplicating them in the agent body creates
two sources of truth that drift.
