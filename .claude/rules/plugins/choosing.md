---
paths:
  - "plugins/**"
  - ".claude-plugin/**"
---

# Choosing the Right Plugin

Which plugin owns which job. Check here before adding a capability, so a new skill does not overlap one that already exists.

**Use claude-management when:**

- CLAUDE.md has grown past 200 lines and needs splitting into `.claude/rules/` files
- Generating or updating a module-level CLAUDE.md with non-obvious documentation
- Deciding where to persist a piece of project information (local env, project-wide context, path-scoped rule, or memory)
- A harness hook suggests it: repeated failures worth remembering, an oversized CLAUDE.md, or an undocumented module (a full stabilize queue is announced to the user directly, not suggested to the agent)
- Mining past session transcripts for recurring mechanical flows to crystallize as project skills or rules (`stabilize`)
- Closing a work session with commits and a context document (`end-session` — user-invoked only)

**Use task-harness when:**

- Starting a substantial request that touches 2+ files or involves 3+ sequential steps (`task-planning`)
- Resuming work already registered with `TaskCreate`, or executing an approved plan (`task-execution`)
- Reviewing a finished changeset — this is the main standalone case: `task-quality-gate` runs against any branch with commits and a base ref, with no plan or task list required
- You want a review that fans out ten independent angles and adversarially verifies every finding, rather than one inline pass
- Note: `/code-review` is no longer invocable by the model, which is why the gate reimplements that engine as a dynamic `Workflow`

**Use dotclaudefiles when:**

- Setting up a team or project structure with shared conventions
- Scaffolding a Claude Code sub-agent (`claude-code-agent-creator`)
- Authoring a dynamic workflow / orchestrating subagents at scale with `ultracode` (`workflow-creator`)
- Creating an on-demand report or shareable artifact mid-session — without git workflow involvement (`create-report`)

**Use dotclaudehooks when:**

- You want symbol-shaped Grep/Glob/grep-Bash calls nudged toward the LSP tool when a matching language server plugin is installed
- Installing hooks independently on a machine or project

**Use document-api when:**

- Documenting REST endpoints or socket.io events as contracts for a frontend team
- Generating structured markdown API contracts from route/handler code

**Use react-dev when:**

- Refactoring messy conditional JSX (clsx + conditional rendering)
- Splitting an oversized React component into smaller pieces

**Use testing when:**

- Adding tests to existing, untested (or under-tested) production code
- You need a testability audit before writing tests
- Code must be made testable (seams, dependency breaking) without changing behavior
- You want characterization + behavior tests with a real test-quality gate, not just coverage
- The whole flow should run autonomously inside an isolated worktree

**Use git-toolkit when:**

- Committing changes — the `commit` skill owns staging, linting, message format, and requires explicit approval
- Creating a new branch — the `branching` skill applies naming conventions before `git checkout -b`
- Mid-rebase or mid-merge with conflicts — the `conflict-resolver` skill analyzes every branch's history in parallel via `git-history-retriever` before touching any conflict marker
- Wanting to compact a branch's commit history before merging or opening a PR — the `squash-suggester` skill invokes `squash-planner` and produces a `squash-plan-<branch>.md` file with the rebase -i action table

**Use typescript-migration when:**

- Migrating an existing JavaScript project (or a directory within one) to TypeScript
- The codebase has no `tsconfig.json` yet and needs initial TypeScript setup
- You want an incremental, leaf-first migration that stays compilable at every step
- You want shared types extracted before parallel typing agents run, avoiding duplicated interfaces
- You want progressive strict mode (`strictNullChecks` → `noImplicitAny` → `strict`) applied automatically after typing

**Use domain-restructure when:**

- A project is organized layer-first (top-level `controllers/`, `services/`, `models/`) and you want it feature-first so the structure screams the business
- You want files regrouped into `modules/<domain>/<layer>` by bounded context, with shared/generic concerns distilled into a `core` module
- You need the move done as a pure structural refactor — relocations and import rewrites only, with a build gate proving zero functional change
- You want it run autonomously inside an isolated worktree, ending in a single green commit ready to review
- Note: this is strategic-DDD placement only; it never rewrites tactical constructs (entities, aggregates, events) inside files

**Use spec-kit when:**

- Authoring a closed, self-contained spec meant to be executed cold via `/goal` (`create-specification`)
- Hardening a spec's design before implementation — finding and resolving design gaps until none remain (`close-design` + `closed-design-enforcer`)
- Keeping a spec in sync as work evolves, folding accepted gaps into the body (`update-specification`)
- Implementing a closed spec and wanting the execution strategy chosen automatically by scale and orchestration closure (`implement-spec`)
- Running the whole create → close-design → implement cycle over one source of truth alongside the `/goal` command

**Use refactoring-guru when:**

- Scanning a specific file, directory, function, or class for code smells — `smell-scan` produces located, confidence-scored findings mapped to concrete techniques, not generic Clean Code advice
- Auditing code quality reactively against the full refactoring.guru taxonomy (26 smells across 5 categories)
- Applying a named refactoring technique to a specific location — `refactor` carries the finding into a safe test → refactor → test → commit cycle via the `refactoring-applier` agent
- Auditing the files a task actually modified for smells, instead of a passive Clean Code reading
- Working in C# or TypeScript class hierarchies where OOP-specific smells and techniques (Refused Bequest, Replace Conditional with Polymorphism, the whole Generalization group) apply
