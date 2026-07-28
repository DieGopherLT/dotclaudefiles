# User Preferences for Claude

## User Identity

- **Name**: Diego
- **GitHub**: DieGopherLT
- **Role**: Software Engineer
- **Email**: <diego@diegopher.dev>

## User relevant information

- **Preferred programming languages**: Go, TypeScript, C#
- Preferred and default shell is **fish**.
- He has strong expertise with GoF design patterns and applies them frequently. Reference pattern names as shared vocabulary — do not explain them from scratch. When proposing solutions, proactively frame them in GoF terms when a pattern applies.
  - **Creational**: Factory Method, Abstract Factory, Builder, Prototype, Singleton
  - **Structural**: Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy
  - **Behavioral**: Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor
  - **Not fully experienced in**: Mediator, Memento, State, Template Method, Visitor, Flyweight, Proxy, Composite — explain these when they come up rather than assuming familiarity.
- When managing situations where multiple states are implied, go by default with a Finite State Machine approach, unless the problem clearly calls for a different pattern.

## Planning Behavior

- Enter `plan mode` when a prompt describes a non-trivial problem — trust your
  judgment to tell trivial from non-trivial.
- In plan mode, invoke the `plan-constraints` skill before drafting any plan — it
  defines the research phase, the required structure, and the template.

## Task Execution Behavior

When a request is substantial — it touches 2+ files, involves 3+ sequential steps, executes an approved plan,
or comes right after exiting plan mode: invoke `task-planning` skill to start organizing tasks.

## Sub-agent behavior

- The golden rule for foreground vs background: if you'll just wait for the agent to finish, call it on foreground. If you'll do something else while waiting, call it on background.
- By default, invoke sub-gents on foreground.
- Before launching a sub-agent, decide whether to split into multiple focused agents. Apply the same rules as real concurrent systems:
  - **Read-only agents**: launch as many as needed in parallel — no coordination required. This includes multi-perspective investigation: if a problem benefits from distinct angles (e.g. security vs. performance vs. correctness), split one agent per angle.
  - **Write agents**: ensure no two agents modify the same files. If overlap is unavoidable, isolate each agent in its own worktree (`isolation: "worktree"`) and combine the changes afterwards.
  - **Sequential dependency**: if agent B needs the output of agent A, do not split — run them sequentially or keep them as one agent.

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

- When writing memory entries, always include a reference so the knowledge is auditable and traceable. Use a file path as the minimum; extend to `path::symbol` when the fact is tied to a specific symbol, or a commit SHA when the fact is about a specific change in history.
- For transient memories — features in progress, pending branches, temporary decisions — add a `stale_when` field to the frontmatter with a short condition (a date, a branch event, or a one-line condition). Omit it for evergreen knowledge.
- When a stale memory is spotted, judge if it's workth keeping it in another form of memory or create another entry shorter with a summary of the knowledge without a `stale_when` field. If the knowledge is no longer relevant, delete it.

## Compaction Behavior

Prioritize saving knowledge proportional to the effort required to acquire it, especially when it is non-obvious from reading files — meaning it required deeper inference or additional context from the user.

Knowledge that is easy to re-derive from reading files can be omitted; include a file path reference so it can be found again if needed.
