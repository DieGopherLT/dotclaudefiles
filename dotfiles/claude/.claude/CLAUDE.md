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

## User coding style

- Diego values legibility over everything else. Even if it implies additional lines of code and/or abstraction layers, the way he evaluates code as 'legible' is by how fluid it reads, Uncle Bob said it best: "The code you write should read like well-written prose."
- Diego prefers to use Facades at flow entry points — the code that consumes a service or kicks off a flow, what refactoring.guru diagrams label as "client code" — to hide complexity, improve readability, and reduce cognitive load when reading main flow code.
- Immutability is the default. The only exception is when it would break the language's idiomatic style (e.g. Go's pointer receivers, `append` on slices) — exceptions come from the language, never from convenience. It makes it easier to debug and trace data flow.
- Diego's pragmatic when it comes to dependencies: instead of re-writing the wheel, he'll look for a dependency that already solves the problem. He dislikes frameworks unless the project will use one from the beginning. Instead, using small dependencies for specific problems is preferred — especially ones that trivialize a recurring problem or whose API reads like well-written prose, cutting the cognitive load of the calling code (see "Library API taxonomy" below for how that reads-like-prose quality is achieved). Reference examples of that bar: react-hook-form, zustand, samber/lo, chi. He'll avoid dependencies that are no longer maintained.
- Manual solutions only apply when there is a requirement to have full control over the implementation, or when the problem is so specific that no dependency can solve it.
- Diego tends to combine Object-Oriented and Functional programming paradigms, using the strengths of each in a pragmatic way. OOP holds structure and state: complex domains representable as objects, where design patterns live. FP handles data transformation: whenever a loop is a transformation, express it with map/filter/reduce or a pipeline of chained functions instead of an imperative loop. Extract pure helper functions when the logic recurs; a one-off transformation stays inline (YAGNI).
- He dislikes camel case, especially for file names, but it'll be used if that is the language convention. If possible, use kebab case for file names.
- Diego will use `Screaming architecture` whenever it's possible to make the organization easier to fit into the mind of humans and agents.
- He mainly uses `logs` to debug, so, it's relevant to write proper logs of multiple events to trace the flow of data and understand the state of the system. He prefers to use structured logs, with a consistent format and relevant information, to make it easier to analyze and search for specific events.

## Library API taxonomy

The trait Diego values in a dependency is that call sites read like well-written prose. Three distinct mechanisms produce that quality — name the right one when discussing or designing an API:

- **Facade**: hides a complex subsystem behind two or three orchestrating functions (GoF sense). Examples: react-hook-form over form state/validation, zustand over global state.
- **Fluent Interface**: methods return `this` (or an equivalent object) enabling chained calls that read as a sentence. Example: chi's routing groups.
- **Internal DSL**: the API as a whole feels like a mini-language embedded in the host language.

Most prose-like libraries combine two or three of these. When evaluating a dependency or designing a public API, classify by mechanism: hides a subsystem → Facade; chains on the same object → Fluent Interface; reads as its own language → Internal DSL.

## Session Behavior

- No emojis in responses, nor code, nor commit messages.
  - If you encounter an emoji in any file, delete it ASAP.
- All code and comments generated must be in English, all the conversation output must be in Spanish.
- Parse JSON via `jq`, never Python-based approaches.
- Before installing a dependency, implementing a feature, or troubleshooting, query docs via the `context7-cli` skill. `ctx7` is installed; do not use `npx`.

## Planning Behavior

Enter `plan mode` when a prompt describes a non-trivial problem — trust your judgment to tell trivial from non-trivial. A secondary trigger: if you're mid-task and realize the scope is larger than expected, enter plan mode for the remaining work — do not re-litigate what's already been done.

- Use all agentic resources available to collect as much information as possible to diminish uncertainty and ambiguity before proposing a plan.
  - It means looking at skills, sub-agents whose domains might fit into the problem. For example, if the plan requires a migration and the project has a migration skill, use it!
  - Does the plan involve some domain and there is an agent that specializes in that domain? Use it!
- Do not include code snippets on plans unless an agent without this session's context would struggle to infer them.
- Always include a summary of files to create and modify, with paths and brief description of the changes.
- When a plan involves connecting multiple modules, components, or services, include contract previews, interface definitions, and/or API endpoints to clarify how they integrate and communicate with each other.
- Before presenting any plan to the user, go through this checklist:
  - Does the plan start by invoking the `task-planning` skill, so the breakdown is registered before any code is written?
  - Is the plan detailed enough that an agent without this session's context could execute it without further clarification? If not, add more details; especially on how different modules and components integrate and/or communicate with each other.
  - Does the plan include a clear and concise summary of files to create and modify, with paths and a brief description of the changes? If not, add it.

## Task Execution Behavior

When a request is substantial — it touches 2+ files, involves 3+ sequential steps, executes an approved plan (or spec), or comes right after exiting plan mode — invoke the `task-planning` skill before writing any code. It registers the breakdown and then chains into `task-execution`, which closes the cycle by invoking `task-quality-gate` over the finished changeset.

Each of the three is invocable on its own: `task-execution` to resume an already-registered plan, and `task-quality-gate` to review any branch without going through the other two.

## Sub-agent behavior

- The golden rule for foreground vs background: if you'll just wait for the agent to finish, call it on foreground. If you'll do something else while waiting, call it on background.
- By default, invoke sub-gents on foreground.
- Before launching a sub-agent, decide whether to split into multiple focused agents. Apply the same rules as real concurrent systems:
  - **Read-only agents**: launch as many as needed in parallel — no coordination required. This includes multi-perspective investigation: if a problem benefits from distinct angles (e.g. security vs. performance vs. correctness), split one agent per angle.
  - **Write agents**: ensure no two agents modify the same files. If overlap is unavoidable, isolate each agent in its own worktree (`isolation: "worktree"`) and combine the changes afterwards.
  - **Sequential dependency**: if agent B needs the output of agent A, do not split — run them sequentially or keep them as one agent.

## Git Behavior

By default do not `push`, nor create `pull requests` without user explicit indication on their messages.

When asked to commit changes — "commit", "make a commit", "commit this", "ship this", or any equivalent
phrasing — invoke the `commit` skill.

When creating a new branch — "create a branch", "new branch", "branch off", "checkout -b" — invoke the
`branching` skill to apply the correct naming convention before executing any git command.

When moving or deleting tracked files, use `git mv` and `git rm` respectively to preserve history. Do not delete and re-create files.

## Database Behavior

All local databases run in containers. Use `docker exec` with the container name to run any database shell command.

## SSH Behavior

Check SSH aliases before connecting to any server. Batch SSH commands to avoid rate limiting.

## Memory Behavior

- When writing memory entries, always include a reference so the knowledge is auditable and traceable. Use a file path as the minimum; extend to `path::symbol` when the fact is tied to a specific symbol, or a commit SHA when the fact is about a specific change in history.
- For transient memories — features in progress, pending branches, temporary decisions — add a `stale_when` field to the frontmatter with a short condition (a date, a branch event, or a one-line condition). Omit it for evergreen knowledge.

## Compaction Behavior

Prioritize saving knowledge proportional to the effort required to acquire it, especially when it is non-obvious from reading files — meaning it required deeper inference or additional context from the user.

Knowledge that is easy to re-derive from reading files can be omitted; include a file path reference so it can be found again if needed.
