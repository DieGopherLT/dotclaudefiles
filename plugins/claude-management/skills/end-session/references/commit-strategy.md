# Commit Strategy

Classification guide for Phase 1 of the `end-session` skill.

---

## File Classification

### Always commit

- Modified tracked files of any type (the project already owns them)
- Untracked source files that represent new business logic: `.go`, `.ts`, `.tsx`, `.cs`, `.js`, `.py`, `.sh`, `.sql`, plugin files (`.md` inside plugin directories), config files (`.json`, `.yaml`, `.toml`)
- Untracked documentation that lives inside the plugin or module it documents (e.g., `plugins/foo/skills/bar/SKILL.md`)
- Untracked files within `.claude/` that are **project-agnostic**: skills, agents, or commands that do not reference local paths, personal tokens, or machine-specific configuration and would work identically on any machine

### Always skip (do not stage)

- Files already excluded by `.gitignore` — skipped automatically by git; do not force-add them
- `.claude/settings.local.json` — local permission and environment overrides, never versioned
- `.claude/worktrees/` — ephemeral worktree metadata
- `.claude/` entries that are **environment-specific**: agents or skills that reference local filesystem paths, personal credentials, or machine-specific tooling
- **Session artifacts** — untracked `.md` and `.html` files at the project root created during the session with no counterpart in git history: PR description files, context preservation documents, session notes, scratch pads, HTML reports. Most session artifacts will have one of these two extensions. These are tied to the session that produced them and contaminate the project history
- Temp files: `*.tmp`, `*.log`, `*.bak`, debug output files

### When in doubt for untracked files

Check git history: `git log --oneline --all -- <file>`. If the file has never appeared in any commit, it was created this session. Apply two tests:

1. **Session-local?** Was it produced as a side effect of session work (a doc capturing context, a temp note, a PR body)? Most session artifacts are `.md` or `.html` files at the project root — treat those with extra suspicion. If yes, skip it.
2. **Environment-specific?** Does it reference paths, tokens, or settings that only work on this machine? If yes, skip it.

If neither applies, it belongs to the project — commit it. Use your session context to answer these questions directly; you were part of the session.

---

## Determining WIP vs Complete

### Primary signal: session context

You participated in the session. Use that knowledge directly:
- The user said "we're not done with X" or "let's continue this later" → `wip:`
- A feature was started but not integrated, tested, or wired up → `wip:`
- The session was interrupted mid-implementation → `wip:`
- The work reached a stable, tested, functioning state → conventional prefix

### Secondary signals (scan modified files if session context is insufficient)

| Signal | Interpretation |
|---|---|
| `TODO`, `FIXME`, `HACK` comments added in this session | WIP |
| Functions with empty bodies or placeholder returns | WIP |
| Imports of symbols that do not exist yet | WIP |
| Tests added but not passing | WIP |
| Feature implemented + tests pass + wired to entry point | Complete |
| Refactor with no behavioral changes + clean diff | Complete |
| Config or documentation update standing on its own | Complete |

### Mixed state (some groups complete, some WIP)

Commit them separately. A complete `feat:` commit followed by a `wip:` commit is correct. Never merge a finished piece into a WIP commit just to reduce the number of commits.

---

## Atomicity: What Counts as One Commit

Target: one logical change per commit, granular enough for `git bisect`.

**Group together:**
- A feature and the tests that verify it
- A refactor and the renames it requires
- A config change and the code that depends on it

**Keep separate:**
- Two unrelated features, even if both are complete
- A bugfix and an unrelated cleanup in the same file
- A complete piece of work and an unrelated WIP piece

**Practical heuristic:** if reverting the commit would leave the codebase in a sensible intermediate state, the atomicity is right. If reverting it would leave dangling imports or half-wired features, the commit is too large.

---

## Commit Message Format

```
<prefix>(<scope>): <description>
```

- Max 96 characters, single line, no body, no bullet points
- No emojis, no co-author attribution, no "CLAUDE" mentions
- `<scope>` is optional; use it when the change is clearly scoped to one plugin, module, or subsystem

| Situation | Prefix |
|---|---|
| New feature or capability | `feat:` |
| Bug fix | `fix:` |
| Code restructure without behavior change | `refactor:` |
| Tests only | `test:` |
| Documentation only | `docs:` |
| Tooling, config, version bumps | `chore:` |
| Incomplete or interrupted work | `wip:` |
