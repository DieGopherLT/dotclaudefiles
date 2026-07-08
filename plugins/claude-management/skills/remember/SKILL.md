---
name: remember
description: Esta skill debe usarse cuando el usuario pide "recuerda que", "guarda
  esto", "anota esto", "no olvides que", "remember this", "save this", "store this",
  "keep in mind", "where should I save", "donde guardo esto", o menciona querer persistir
  informacion del proyecto. Proporciona clasificacion automatica al destino correcto
  de memoria de Claude Code segun la naturaleza del contenido.
argument-hint: "<information to store>"
version: 1.0.0
---

# Remember

Given a piece of information, classify its nature and write it to the correct Claude Code memory location for the current project.

## Scope

Project-level only. The five valid destinations are:

- `CLAUDE.local.md` — local environment, never versioned
- `CLAUDE.md` — always-loaded project context, versioned
- `.claude/rules/` — on-demand conventions (path-scoped or always-on), versioned
- `.claude/skills/` — reproducible flows Claude can execute, versioned
- `Memory` — project context not derivable from code, machine-local

User-global destinations (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) are out of scope.

## Reference files (read on demand)

- `references/storage-decision-guide.md` — full spec for each destination: when to use, when not to, write format, and a concrete example. Read when the classification table below doesn't resolve the case.

## Decision sequence

Apply these questions in order. Stop at the first `yes`.

| Question | Destination |
|---|---|
| Is it a secret, credential, or API key? | **Refuse** — warn the user; none of these systems are appropriate |
| Does it only apply on your local machine (localhost URLs, local paths, personal dev overrides)? | `CLAUDE.local.md` |
| Is it project orientation Claude needs before opening any file (overview, structure, build/run commands)? | `CLAUDE.md` |
| Does it apply only to certain file types or directories in the project? | `.claude/rules/` with `paths` frontmatter |
| Is it a cross-cutting coding standard for the whole project (naming, error handling, control flow)? | `.claude/rules/` without frontmatter |
| Is it a step-by-step procedure or workflow that Claude should execute reproducibly? | `.claude/skills/` |
| Is it project context not derivable from the code (infra, stakeholders, historical decisions, external constraints)? | `Memory` (topic file under `~/.claude/projects/<project>/memory/`) |

If the information fits two buckets equally, use `AskUserQuestion` to clarify before writing.

## Workflow

### Step 1: Classify

Apply the decision sequence above. Use `$ARGUMENTS` as the information to store if provided; otherwise use the user's last message.

Check for secrets first: URLs with credentials, tokens, passwords, private keys. If found, stop and warn — do not write.

If the information applies to all of the user's projects (not just this one), it belongs in `~/.claude/CLAUDE.md` or `~/.claude/rules/`. This skill does not write to user-global destinations — tell the user and stop.

### Step 2: Resolve ambiguity

Proceed without asking for clear cases. Ask only when:

- The information could plausibly go to two different destinations and the choice changes how it behaves (e.g., "applies to all TypeScript" vs "applies to all code in the project").
- The destination file is near its size limit and writing would make it worse (CLAUDE.md approaching 200 lines).

### Step 3: Write

For each destination, see `references/storage-decision-guide.md` for the exact write format. Abbreviated rules:

- **CLAUDE.local.md**: verify `CLAUDE.local.md` is listed in `.gitignore` before writing; if not, warn the user and stop. Append at end; create file if absent.
- **CLAUDE.md**: insert under the most relevant existing section; never create a new top-level section unless no section fits. If the file is at or above 180 lines, suggest running `rulify` first and stop.
- **.claude/rules/ (path-scoped)**: check for an existing rule whose `paths` covers the same scope; merge into it if found, otherwise create a new file under `.claude/rules/<category>/<topic>.md` with `paths` frontmatter.
- **.claude/rules/ (always-on)**: check for an existing rule covering the same standard; merge if found. Create new file without any frontmatter if no match. Never start the file with `---` — that converts it to a path-scoped rule with no triggers and it will never load.
- **`.claude/skills/`**: check for an existing skill covering the same flow; merge into it if found. Otherwise create `.claude/skills/<skill-name>/SKILL.md`. See `references/storage-decision-guide.md` for format details.
- **Memory**: write to a topic file (`~/.claude/projects/<project>/memory/<topic>.md`) using three-field frontmatter (`name`, `description`, `metadata.type`) plus body. Add or update the pointer line in `MEMORY.md`.

If the new information contradicts existing content in the target file, overwrite the stale entry rather than appending. Report the replacement in Step 4.

**Verification clause for transferable practices.** When the information to persist is a practice about an external tool, framework, or language (as opposed to a project-internal fact or convention), launch the `practice-verifier` agent with the claim before writing — what just worked in this session may be version-specific, incomplete, or accidentally right, and a persisted mistake propagates to every future session. Persist only `confirmed` or `adjusted` verdicts with confidence >= 80, applying corrections first; report refuted claims to the user with the verifier's evidence. Skip verification for project-internal facts — the codebase, not the internet, is their authority, and the session just observed them directly.

### Step 4: Report

One sentence: what was saved, where, and the deciding criterion.

Example: `Saved to .claude/rules/code-standards/naming.md (always-on) — cross-cutting naming convention that applies to all project code.`
