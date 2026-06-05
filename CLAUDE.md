# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **mono-repo for Claude Code plugins** containing seven specialized plugins:

1. **dotclaudefiles** - Core productivity plugin (agents, commands, skills, output-styles)
2. **dotclaudehooks** - Standalone hooks plugin (commit validation, auto-formatting)
3. **claude-management** - Claude Code memory file management (rulify, claudify, remember)
4. **document-api** - API contract documentation (REST endpoints, socket.io events) for frontend handoff
5. **react-dev** - React development helpers (conditional JSX refactoring, component splitting)
6. **testing** - Retrofit testing pipeline for existing code (testability auditing, seams, characterization tests, test-quality auditing)
7. **typescript-migration** - Autonomous JS-to-TS migration pipeline (audit, tooling setup, shared types extraction, parallel per-chunk typing, progressive strict-mode consolidation)

Each plugin is independently installable and can be distributed across devices. Development happens in `~/.claude/` before promotion to the repository.

Context-specific instructions are organized in `.claude/rules/` and loaded automatically when working on relevant files.

## Repository Structure

To see the current repository structure, run:

```bash
tree -L 3 -I '.git|.claude' .
```

Key directories:

- **`plugins/`**: Contains the 7 plugins (dotclaudefiles, dotclaudehooks, claude-management, document-api, react-dev, testing, typescript-migration)
- **`dotfiles/claude/`**: Stow-managed configuration files
- **`scripts/`**: Stow setup scripts for bash, fish, and PowerShell

## Plugin Descriptions

### dotclaudefiles

Core productivity plugin with daily-use commands, quality agents, and specialized workflows:

- **Agents**: `dependency-docs-collector`
- **Commands**: `/claudify`, `/dry-run`, `/explain-like-senior`, `/git-context`, `/journal`, `/language-evaluation`, `/predict-issues`, `/refactor-conditional-jsx`, `/remove-comments`
- **Skills**: `check-third-party-docs`, `deep-reason`, `document`, `team-setup`
- **Output Styles**: `mentor`, `personal-preference`
- **MCP Servers**: Sequential-thinking server for deep reasoning

### dotclaudehooks

Standalone hooks plugin for automated quality enforcement:

- **Hooks**:
  - `commit-validator` (PreToolUse on `git commit`) — enforces conventional commits, blocks emojis and co-author attribution, integrates with commitlint if available
  - `format-dispatcher` (PostToolUse on `Edit|Write`) — auto-runs ESLint, Prettier, gofmt, markdownlint based on project config detection

### document-api

Skills for documenting API contracts for frontend handoff:

- **Skills**: `document-endpoints` (structured markdown contracts from REST routes), `document-sockets` (socket.io event contracts from handlers)

### react-dev

Helpers for React development:

- **Commands**: `/refactor-conditional-jsx` (clsx + conditional rendering cleanup)
- **Skills**: `split-component` (split large components into manageable pieces)

### claude-management

Skills for managing Claude Code memory files:

- **Skills**: `rulify` (split heavy CLAUDE.md into on-demand `.claude/rules/` files), `claudify` (generate token-efficient module-level CLAUDE.md documentation), `remember` (classify and route a piece of information to the correct memory destination)

### testing

Retrofit testing pipeline that puts existing code under tests autonomously (NOT test-first TDD):

- **Agents**: `testability-auditor` (testability 1-10 + confidence), `testing-deps-investigator`, `testing-code-adapter` (Feathers seams), `testing-scaffolder` (shared test utilities, DRY cross-file), `test-implementer` (characterization + behavior tests + build gate), `test-input-auditor` (test-quality via mutation-thinking + type-validity)
- **Skill**: `retrofit-testing` (thin orchestrator: enters a dedicated worktree, runs a deterministic end-to-end Workflow over the 6 agents, hands back for merge)
- **References**: coverage strategies, test anti-patterns, frontend component-testing patterns (React seam model + RTL), project rules template (bundled inside the skill)
- **Frontend mode**: when targets are React components/hooks (`.tsx`/`.jsx`), the agents switch to a frontend seam model (vi.mock/props/providers/MSW) and React Testing Library assertions instead of backend constructor DI

### typescript-migration

Autonomous pipeline that migrates an existing JavaScript project to TypeScript. Runs inside a dedicated worktree:

- **Agents**: `migration-auditor` (detects project type, maps dep graph leaf-first, plans chunks, selects fixture), `migration-setup` (installs tooling, applies tsconfig fixture, git mv all JS files, base compile gate), `shared-types-extractor` (extracts cross-chunk interfaces to `src/types/` before parallel typing), `typer` (types a single chunk in isolation, scoped compile gate), `migration-consolidator` (fixes cross-chunk errors, enables strict progressively, final build gate)
- **Skill**: `typescript-migration` (orchestrator: enters a dedicated worktree, runs the 5-phase Workflow, hands back for merge)
- **Fixtures**: tsconfig templates for `react-vite`, `nextjs`, `node`, and `generic` projects — auditor selects the right one automatically

## Choosing the Right Plugin

**Use claude-management when:**

- CLAUDE.md has grown past 200 lines and needs splitting into `.claude/rules/` files
- Generating or updating a module-level CLAUDE.md with non-obvious documentation
- Deciding where to persist a piece of project information (local env, project-wide context, path-scoped rule, or memory)

**Use dotclaudefiles when:**

- Doing code reviews, refactoring, or daily development tasks
- Checking third-party documentation or integrating libraries
- Creating pull requests with structured descriptions
- Deep reasoning on complex architectural decisions
- Documenting patterns, problems, or decisions

**Use dotclaudehooks when:**

- You want automatic commit message validation without the rest of dotclaudefiles
- You want auto-formatting after file edits (ESLint, Prettier, gofmt, markdownlint)
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

**Use typescript-migration when:**

- Migrating an existing JavaScript project (or a directory within one) to TypeScript
- The codebase has no `tsconfig.json` yet and needs initial TypeScript setup
- You want an incremental, leaf-first migration that stays compilable at every step
- You want shared types extracted before parallel typing agents run, avoiding duplicated interfaces
- You want progressive strict mode (`strictNullChecks` → `noImplicitAny` → `strict`) applied automatically after typing

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
```

## Configuration Files

Each plugin has its own configuration:

- **`plugins/<plugin-name>/.claude-plugin/plugin.json`**: Plugin metadata (name, version, description, keywords)
- **`plugins/dotclaudefiles/.mcp.json`**: MCP server configurations (sequential-thinking server)
- **`plugins/testing/skills/retrofit-testing/references/*.md`**: Coverage strategies, test anti-patterns, and project rules template
- **`plugins/typescript-migration/skills/typescript-migration/fixtures/*.json`**: tsconfig templates per project type (react-vite, nextjs, node, generic)
- **`.claude/settings.local.json`**: Plugin-specific settings (in repo root for local development)
- **`.gitignore`**: Excludes `.claude/` directory (local development sandbox)

## MCP Servers

The `dotclaudefiles` plugin includes the `sequential-thinking` MCP server configured in `plugins/dotclaudefiles/.mcp.json`. This enables deep reasoning for complex problems through dynamic thought processes. Use the `/deep-reason` skill to leverage this capability with structured analysis and documentation generation.
