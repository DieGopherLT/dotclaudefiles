# User Preferences for Claude

## User Identity

- **Name**: Diego
- **GitHub**: DieGopherLT
- **Role**: Software Engineer
- **Email**: <diego@diegopher.dev>

## User relevant information

- **Preferred programming languages**: Go, TypeScript, C#
- He has strong expertise with GoF design patterns and applies them frequently. Reference pattern names as shared vocabulary — do not explain them from scratch. When proposing solutions, proactively frame them in GoF terms when a pattern applies.
  - **Not fully experienced in**: Mediator, Memento, State, Template Method, Visitor, Flyweight, Proxy, Composite — explain these when they come up rather than assuming familiarity.
- When managing situations where multiple states are implied, go by default with a Finite State Machine approach, unless the problem clearly calls for a different pattern.

## Session Behavior

- No emojis in responses, code, or commit messages. Remove them from files you are already editing in repos owned by DieGopherLT; leave other repos alone.
- All code and comments generated must be in English.
- Parse JSON via `jq`, never Python-based approaches.
- In repos owned by DieGopherLT, HansLove, or TaloonStudio, tighten the comments and docs you edit: same information in fewer words and plain language, never dropping a non-obvious fact to save words.
- If that tightening changes more than a fifth of a CLAUDE.md's lines, rewrite the whole file in the same style so no inconsistencies remain, and commit it on its own with the `commit` skill.

## Planning Behavior

- Before acting on a non-trivial request (trust your judgment to tell trivial from non-trivial), decide the path first:
  - Involves UI: mock it on `claude-design` and agree on it with the user, then enter plan mode with the mock URL in the plan.
  - No UI: enter plan mode directly.
- Plan mode blocks mocking, so if UI surfaces mid-plan, ask the user to exit, mock, then re-enter.
- In plan mode, invoke `plan-constraints` before drafting.

## Task Execution Behavior

Substantial requests go through the `task-planning` skill.

## Sub-agent behavior

The main agent's context is the scarce resource: it keeps business logic, documentation, and decisions, and delegates the rest. Every dispatch goes through `subagent-dispatch`.

- Mechanical work that can be fully specified and easily checked (tests, exploration, gathering references, bulk renames, checking a hypothesis) goes to a cheap model.
- When several angles materially matter (correctness, security, performance, UX, migration cost...), run one read-only agent per angle on a reasoning model and synthesize their reports yourself.
- Write agents never share files; sub-agents never commit.
- Review every deliverable before it counts as done. If it falls short, resume the same agent once with corrections; after that, start a fresh one.

## Git Behavior

- Use `commit` skill to commit changes. Either by request or autonomously.
- Use `branching`  skill to create new branches or worktrees. Either by request or autonomously.
- When moving or deleting tracked files, use `git mv` and `git rm` respectively to preserve history. Do not delete and re-create files.

## Database Behavior

All local databases run in containers. Use `docker exec` with the container name to run any database shell command.

## SSH Behavior

- Check SSH aliases before connecting to any server.
- Batch SSH commands to avoid rate limiting.

## Memory Behavior

- Every memory entry carries a reference so it is auditable: a file path at minimum, `path::Symbol` when tied to a symbol, a commit SHA when about a specific change.
- Transient memories (features in progress, pending branches, temporary decisions) carry a `stale_when` frontmatter field with a short condition: a date, a branch event, or one line. Evergreen knowledge omits it.
- When a memory goes stale, distill whatever is still useful into a new evergreen entry without `stale_when`, then delete the original. Delete outright when nothing remains that the repo does not already record (code, git history, CLAUDE.md) or when the fact turned out to be wrong.

## Compaction Behavior

Prioritize saving knowledge proportional to the effort required to acquire it, especially when it is non-obvious from reading files — meaning it required deeper inference or additional context from the user.

Knowledge that is easy to re-derive from reading files can be omitted; include a file path reference so it can be found again if needed.
