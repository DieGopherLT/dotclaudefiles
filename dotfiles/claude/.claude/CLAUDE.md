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
- Diego is picky regarding code aesthetics, prefers it to be slightly more verbose if it improves readability. Values readability over terseness, but not to the point of excessive boilerplate.

## Session Behavior

- No emojis in responses, nor code, nor commit messages.
  - If you encounter an emoji in any file, delete it ASAP.
- When launching sub-agents, always call them on foreground; it has less issues with permissions. Unless you want to perform something while the agent works, then you can call it on background.
  - The golden rule is: if you'll just wait for the agent to finish, then call it on foreground. If you'll do something else while waiting, then call it on background.
- Whenever the user indicates to enter a worktree, do not use `cd` to enter it, instead use the `EntreWorktree` tool.
- All code and comments generated must be in English, all the conversation output must be in Spanish.

## Task Execution Behavior

When a request is substantial — it touches 2+ files, involves 3+ sequential steps, executes an approved plan, or comes right after exiting plan mode — invoke the `task-planning` skill before writing any code. It carries the full workflow Diego expects: a design lens up front, letter-group task breakdown registered with TaskCreate, bisectable commits at group boundaries, LSP-first navigation, and a closing `simplify` + `clean-code` quality pass. Do not improvise this structure from memory — the skill is the source of truth, and consulting it keeps execution consistent across sessions. Skip it only for single-file, single-step changes.

## Git Behavior

When asked to commit changes — "commit", "make a commit", "commit this", "ship this", or any equivalent
phrasing — invoke the `commit` skill. It owns the full workflow: staging, linting, message format,
explicit approval, and verification. Do not improvise commit message format from memory.

When creating a new branch — "create a branch", "new branch", "branch off", "checkout -b" — invoke the
`branching` skill to apply the correct naming convention before executing any git command.

When moving or deleting tracked files, use `git mv` and `git rm` respectively to preserve history. Do not delete and re-create files.

## Database Behavior

All local databases run in containers. Use `docker exec` with the container name to run any database shell command.

## SSH Behavior

Check SSH aliases before connecting to any server. Batch SSH commands to avoid rate limiting.

## Report Behavior

Diego will occasionally request a report during a session. There are two distinct types:

- **Context preservation**: Captures session knowledge so a future conversation can resume without loss of context.
- **Comprehension/sharing**: Explains the work to Diego or a team member who was not part of the session.

### Detecting intent

If the request is ambiguous, use `AskUserQuestion` to clarify which type before writing.

Signals that suggest **context preservation**: phrases like "save context", "preserve this session", "I'll continue later", or "checkpoint".

Signals that suggest **comprehension/sharing**: phrases like "explain this", "share with the team", "make a report for X", or naming a specific audience.

### What both types must include

Document everything not directly inferable from the code or git history:

- Decisions made and the reasoning behind them.
- Assumptions that shaped the implementation.
- Trade-offs considered and rejected alternatives.
- Non-obvious constraints or external context that influenced the work.
- References to relevant files, functions, and symbols so the reader can navigate the codebase.

The report must be self-contained: a reader with no session context should be able to reconstruct the full picture from it alone.

### Format by type

**Context preservation** — Markdown. Place all file and symbol references in a dedicated section at the bottom of the document.

**Comprehension/sharing** — Interactive HTML document:

- Render directly as output; do not save to a file.
- Use interactive elements (tabs, collapsible sections, navigation anchors) to maximize information density.
- Include visual structure (tables, timelines, diagrams) where appropriate — HTML affords far more than Markdown.
- The output must be openable directly in a browser and shareable as-is.

### Bash tool usage

- Instead of using python based approaches to parse JSON files, use `jq` instead.
- Whenever you require to query docs of any dependency before installing it, implement a feature or troubleshoot, use the `context7-cli` skill. Remember that I have ctx7 installed, do not use npx.
