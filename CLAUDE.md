# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins** containing eleven specialized plugins:

1. **dotclaudefiles** - Skills plugin for structured task execution (task-planning, team-setup, claude-code-agent-creator, workflow-creator, create-report)
2. **dotclaudehooks** - Standalone hooks plugin (LSP-first navigation nudges)
3. **claude-management** - Claude Code memory file management and self-improvement harness (rulify, claudify, remember, end-session, stabilize, suggestion hooks)
4. **document-api** - API contract documentation (REST endpoints, socket.io events) for frontend handoff
5. **react-dev** - React development helpers (conditional JSX refactoring, component splitting)
6. **testing** - Retrofit testing pipeline for existing code (testability auditing, seams, characterization tests, test-quality auditing)
7. **typescript-migration** - Autonomous JS-to-TS migration pipeline (audit, tooling setup, shared types extraction, parallel per-chunk typing, progressive strict-mode consolidation)
8. **git-toolkit** - Git workflow enforcement (commit standards, branch naming, conflict resolution for rebases and merges, squash planning for interactive rebases)
9. **domain-restructure** - Autonomous layer-first to feature-first restructurer (strategic-DDD domain discovery, subdomain classification, parallel per-domain moves, import consolidation with build gate)
10. **spec-kit** - Spec-driven workflow toolkit (closed self-contained specs, design-closure loop via closed-design-enforcer, implement-spec dispatcher across direct/agent-waves/workflow strategies)
11. **refactoring-guru** - Reactive code-smell analysis and guided refactoring over the refactoring.guru taxonomy (parallel per-category smell-scan, smell→technique mapping, step-by-step refactor applier)

Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Repository Structure

To see the current repository structure, run:

```bash
tree -L 3 -I '.git|.claude' .
```

Key directories:

- **`plugins/`**: Contains the 11 plugins (dotclaudefiles, dotclaudehooks, claude-management, document-api, react-dev, testing, typescript-migration, git-toolkit, domain-restructure, spec-kit, refactoring-guru)
- **`dotfiles/claude/`**: Stow-managed configuration files
- **`scripts/`**: Stow setup scripts for bash, fish, and PowerShell

## Plugin Descriptions

### dotclaudefiles

Skills plugin for structured task execution and team setup:

- **Skills**: `task-planning` (letter-group breakdown, TaskCreate registration, LSP-first nav, group-boundary commits, Phase 3 quality review: simplify + clean-code + parallel domain auditors discovered from available agents), `team-setup`, `claude-code-agent-creator` (scaffolds sub-agent markdown files with least-privilege tools, archetype selection, and model+effort calibration), `workflow-creator` (authors and audits dynamic Workflow-tool scripts with emphasis on per-role thinking load: pipeline vs parallel, schema, quality patterns, budget scaling, plus an audit checklist with severity rubric), `create-report` (produces Markdown for context preservation or interactive HTML for comprehension/sharing; self-contained, navigable, zero external deps)

### dotclaudehooks

Standalone hooks plugin for LSP-first navigation enforcement:

- **Hooks**:
  - `lsp-nudge` (PreToolUse on `Grep|Glob|Bash`) — nudges symbol-shaped searches toward the LSP tool: blocks until it's loaded via `ToolSearch`, warns once when loaded-but-unused, goes silent for the rest of the session after that warning or once used; only fires when a matching LSP plugin is actually enabled (global/project/local `settings.json`) for a language present in the project; every terminal outcome is session-cached so the underlying checks run at most once

### document-api

Skills for documenting API contracts for frontend handoff:

- **Skills**: `document-endpoints` (structured markdown contracts from REST routes), `document-sockets` (socket.io event contracts from handlers)

### react-dev

Helpers for React development:

- **Commands**: `/refactor-conditional-jsx` (clsx + conditional rendering cleanup)
- **Skills**: `split-component` (split large components into manageable pieces)

### claude-management

Skills, hooks, and agents for managing Claude Code memory files — a self-improvement harness where deterministic hooks detect the moment and suggest the right skill, and a quality gate verifies knowledge before it becomes permanent:

- **Skills**: `rulify` (split heavy CLAUDE.md into on-demand `.claude/rules/` files), `claudify` (generate token-efficient module-level CLAUDE.md documentation), `remember` (classify and route a piece of information to the correct memory destination), `end-session` (manual-only session closing: commits + context doc), `stabilize` (mine harvested session transcripts for recurring flows/conventions, verify them, materialize survivors as project skills or rules)
- **Agents**: `transcript-digester` (read-only distiller: one per transcript, reduces a JSONL session to flows + conventions via jq projections), `practice-verifier` (read-only quality gate: verifies transferable practices against official docs/ctx7 and internal conventions against the codebase; confirmed/adjusted/refuted with confidence >= 80 to materialize)
- **Hooks** (suggestion-only, never block or commit): `claudemd-size` (PostToolUse: CLAUDE.md over 200 lines → suggest rulify), `failure-scan` (Stop: repeated same-family Bash/MCP failures in the transcript → suggest remember), `contextualizable-dirs` (Stop: substantial work in an undocumented module directory → suggest claudify), `session-harvest` (Stop: queue long autonomous sessions per repo; at threshold → suggest stabilize), `session-marker` (SessionStart: timestamp for session-scoped scans)
- **Config**: optional per-project `.claude/claude-management.local.json` — keys: `claudemd_ceiling`, `failure_min_repeats`, `contextualizable.always_exclude`/`.always_include`/`.min_source_files`/`.min_touched_files`/`.source_extensions`/`.iac_extensions`, `harvest.queue_threshold`/`.min_transcript_bytes`/`.max_user_messages`; harvest queue state in `~/.claude/claude-management/harvest/`

### testing

Retrofit testing pipeline that puts existing code under tests autonomously (NOT test-first TDD):

- **Agents**: `testability-auditor` (testability 1-10 + confidence), `testing-deps-investigator`, `testing-code-adapter` (Feathers seams), `testing-scaffolder` (shared test utilities, DRY cross-file), `test-implementer` (characterization + behavior tests + build gate), `test-input-auditor` (test-quality via mutation-thinking + type-validity)
- **Skill**: `retrofit-testing` (thin orchestrator: enters a dedicated worktree, runs a deterministic end-to-end Workflow over the 6 agents, hands back for merge)
- **References**: coverage strategies, test anti-patterns, frontend component-testing patterns (React seam model + RTL), project rules template (bundled inside the skill)
- **Frontend mode**: when targets are React components/hooks (`.tsx`/`.jsx`), the agents switch to a frontend seam model (vi.mock/props/providers/MSW) and React Testing Library assertions instead of backend constructor DI

### git-toolkit

Git workflow enforcement for commit standards, branch naming, conflict resolution, and squash planning:

- **Skills**: `commit` (staged deliberately, formatted, message crafted with explicit approval before execution), `branching` (naming convention enforcement before any `git checkout -b`), `conflict-resolver` (resolves rebase and merge conflicts via parallel branch history analysis — agnostic to operation type), `squash-suggester` (analyzes branch commit history and produces a squash plan markdown file — pick/squash/fixup per commit — preserving atomicity and bisectability)
- **Agents**: `git-history-retriever` (read-only historian: analyzes commits for a single branch within a bounded range `merge-base..branch-tip`, infers intent per conflicting file; one instance per branch, all launched in parallel by conflict-resolver), `squash-planner` (read-only analyst: groups commits by semantic intent and assigns squash actions maintaining git bisect safety; invoked by squash-suggester)

### typescript-migration

Autonomous pipeline that migrates an existing JavaScript project to TypeScript. Runs inside a dedicated worktree:

- **Agents**: `migration-auditor` (detects project type, maps dep graph leaf-first, plans chunks, selects fixture), `migration-setup` (installs tooling, applies tsconfig fixture, git mv all JS files, base compile gate), `shared-types-extractor` (extracts cross-chunk interfaces to `src/types/` before parallel typing), `typer` (types a single chunk in isolation, scoped compile gate), `migration-consolidator` (fixes cross-chunk errors, enables strict progressively, final build gate)
- **Skill**: `typescript-migration` (orchestrator: enters a dedicated worktree, runs the 5-phase Workflow, hands back for merge)
- **Fixtures**: tsconfig templates for `react-vite`, `nextjs`, `node`, and `generic` projects — auditor selects the right one automatically

### domain-restructure

Autonomous structural refactor that reshapes a codebase from layer-first (top-level `controllers/`, `services/`, `models/`) into feature-first screaming architecture (`modules/<domain>/<layer>`). Pure relocation — zero functional change. Runs inside a dedicated worktree:

- **Agents**: `contract-auditor` (detects stack, layer taxonomy, current axis, target convention, import strategy, build gate), `domain-scanner` (identifies bounded contexts via ubiquitous language, flags low-confidence names), `domain-grouper` (buckets a domain's files by layer, one per domain), `reconciler` (classifies core/supporting/generic subdomains, resolves shared/orphan/collision, emits the path map + membership map), `domain-mover` (plain `mv` + intra-domain import fixes, one per domain, enforcing the single-owner invariant), `consolidator` (`git add -A` rename detection, fixes cross-cutting imports + barrels + config, build gate loop, asserts a pure-refactor diff)
- **Skill**: `domain-restructure` (orchestrator: enters a dedicated worktree, runs the 6-phase Workflow, hands back for merge in a single green commit)
- **Strategic DDD only**: discovers bounded contexts and classifies subdomains to decide where files belong; never touches tactical constructs (entities, aggregates, events) inside file contents

### spec-kit

Spec-driven workflow toolkit that carries a feature from raw idea to verified implementation over a single source of truth (the spec). Pairs with the `/goal` command:

- **Agent**: `closed-design-enforcer` (read-only design-gap auditor: detects missing/ambiguous/unverifiable design decisions, returns structured findings with a conceptual `closes_when`, never a concrete solution; spawned fresh each round, no closure authority)
- **Skills**: `create-specification` / `update-specification` (augmented copies: closed, self-contained specs ready for cold `/goal` execution, with a managed Design Gaps section), `close-design` (loop-until-dry orchestrator: sole writer of the Design Gaps section and stateful seen-set holder; spawns a fresh enforcer per round until zero net-new gaps, then runs a single human arbitration gate), `implement-spec` (Template Method + Strategy dispatcher: selects write-directly / agent-waves / workflow by two axes — context-budget scale and orchestration closure — then executes, quality-gates, and verifies)
- **Closure philosophy**: the design is closed (no unresolved gaps) before implementation; the dispatcher picks workflow only when coordination is decision-closed, baking the quality gate into the script

### refactoring-guru

Turns passive Clean Code reference into a reactive analysis of real code: given a file, directory, or symbol, it detects concrete smells from the refactoring.guru taxonomy, maps them to named techniques, and applies the chosen transformation step by step. Neither skill dispatches by scale anymore: `smell-scan` always fans out through a `Workflow` regardless of domain count (detection is read-only, so there is no worktree-isolation reason to special-case a single domain); `refactor` always enters a dedicated worktree (unless already inside one) and always runs the full 4-phase Workflow, since worktree isolation is useful independent of scale and the whole-project build gate protects a single-finding change exactly as it protects a multi-domain one:

- **Agents**: `smell-detector` (read-only Auditor, one per category, runs per domain inside the smell-scan Workflow's per-domain pipeline; confidence-scored located findings at >=80 with a `resolution_plan` per finding, never modifies files), `refactoring-applier` (Implementer: applies ONE named technique to ONE location following the playbook mechanics, preserves observable behavior, reports the verification; frozen, never touches git), `refactoring-reconciler` (Bash-capable: owns all git/build mechanics inside the refactor Workflow's Mark and Reconcile phases — ephemeral rollback commit, whole-project build gate, reset on failure — never edits code)
- **Skills**: `smell-scan` (always pipelines every domain — one or many — through a 5-`smell-detector` batch each via a `Workflow`, then assigns globally-unique reference codes B1/OO1/CP1/D1/C1 over the aggregated findings and persists one source-of-truth JSON file per domain under `.claude/refactoring-guru/findings/`), `refactor` (resolves a finding code, explicit technique+location, or a broader multi-domain request; always enters a dedicated worktree — skipped if already inside one — and always runs the full 4-phase Workflow: parallel intra-domain appliers, cross-cutting smells reconciled serially with a build gate, collapsed to one `refactor:` commit)
- **References**: `smell-catalog.md` (26 smells: detection criteria + mapped techniques), `refactoring-techniques.md` (67 techniques: when + mechanics), `technique-playbooks.md` (per-group execution steps), `workflow.md` (safe test → refactor → test → commit cycle)
- **Taxonomy**: 26 smells in 5 categories (Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers); 67 techniques in 6 groups. OOP-specific smells and techniques are kept marked, not suppressed — they apply in C# and TypeScript class code

## Choosing the Right Plugin

**Use claude-management when:**

- CLAUDE.md has grown past 200 lines and needs splitting into `.claude/rules/` files
- Generating or updating a module-level CLAUDE.md with non-obvious documentation
- Deciding where to persist a piece of project information (local env, project-wide context, path-scoped rule, or memory)
- A harness hook suggests it: repeated failures worth remembering, an oversized CLAUDE.md, an undocumented module, or a full stabilize queue
- Mining past session transcripts for recurring mechanical flows to crystallize as project skills or rules (`stabilize`)
- Closing a work session with commits and a context document (`end-session` — user-invoked only)

**Use dotclaudefiles when:**

- Starting a substantial request that touches 2+ files or involves 3+ sequential steps
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
- Running the `task-planning` Phase 3 quality pass over the files a task actually modified, instead of a passive Clean Code reading
- Working in C# or TypeScript class hierarchies where OOP-specific smells and techniques (Refused Bequest, Replace Conditional with Polymorphism, the whole Generalization group) apply

## Installing Plugins

Each plugin can be installed independently:

```bash
# Add marketplace (once)
/plugin marketplace add https://github.com/DieGopherLT/dotclaudefiles diegopher

# Install individual plugins
/plugin install dotclaudefiles@diegopher
/plugin install dotclaudehooks@diegopher
/plugin install claude-management@diegopher
/plugin install document-api@diegopher
/plugin install react-dev@diegopher
/plugin install testing@diegopher
/plugin install typescript-migration@diegopher
/plugin install git-toolkit@diegopher
/plugin install domain-restructure@diegopher
/plugin install spec-kit@diegopher
/plugin install refactoring-guru@diegopher
```

## Configuration Files

Each plugin has its own configuration:

- **`plugins/<plugin-name>/.claude-plugin/plugin.json`**: Plugin metadata (name, version, description, keywords)
- **`plugins/testing/skills/retrofit-testing/references/*.md`**: Coverage strategies, test anti-patterns, and project rules template
- **`plugins/typescript-migration/skills/typescript-migration/fixtures/*.json`**: tsconfig templates per project type (react-vite, nextjs, node, generic)
- **`.claude/settings.local.json`**: Plugin-specific settings (in repo root for local development)
- **`.gitignore`**: Excludes `.claude/` directory (local development sandbox)

## Skill Authoring

For skill creation, modification, structure, frontmatter fields, and writing conventions, invoke `/skill-creator` — it is the single source of truth.

